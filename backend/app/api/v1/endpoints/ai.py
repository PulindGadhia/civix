import hashlib
import logging
import json
import traceback
import uuid
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from app.services.gemini_service import gemini_ai_service, GeminiCivicAnalysis
from google.genai import types

logger = logging.getLogger(__name__)
router = APIRouter()

# --------------------------------------------------------------------------- #
# Module 10 — In-memory analysis cache (avoids duplicate Gemini calls)         #
# Key: MD5 hash of image bytes. Value: serialised GeminiCivicAnalysis dict.   #
# --------------------------------------------------------------------------- #
_ANALYSIS_CACHE: Dict[str, Any] = {}

def _compute_images_hash(raw_bytes_list: List[bytes]) -> str:
    """Compute a deterministic MD5 over all uploaded image bytes."""
    h = hashlib.md5()
    for b in raw_bytes_list:
        h.update(b)
    return h.hexdigest()


@router.post("/analyze")
async def analyze_civic_issue(
    files: List[UploadFile] = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    address: str = Form(...),
    notes: Optional[str] = Form(None)
):
    """
    Accepts uploaded media files and analyzes them with Gemini Vision API.
    Returns a GeminiCivicAnalysis JSON object on success.
    Returns {"success": false, "aiAvailable": false} on quota/API failure.
    Implements image-hash caching (Module 10) to avoid duplicate Gemini calls.
    """
    trace_id = str(uuid.uuid4())

    logger.info(
        f"[{trace_id}] /analyze called: {len(files)} file(s), "
        f"lat={latitude}, lng={longitude}, address='{address}'"
    )

    if not files:
        return JSONResponse(status_code=400, content={
            "success": False,
            "aiAvailable": False,
            "error": "No files uploaded."
        })

    # ---------------------------------------------------------------------- #
    # Read & validate files                                                   #
    # ---------------------------------------------------------------------- #
    media_parts: List[types.Part] = []
    raw_bytes_list: List[bytes] = []

    for idx, file in enumerate(files):
        content_type = file.content_type or "image/jpeg"
        file_bytes = await file.read()

        if not file_bytes:
            logger.warning(
                f"[{trace_id}] File {idx} ('{file.filename}') is empty — skipping."
            )
            continue

        logger.info(
            f"[{trace_id}] File {idx}: name='{file.filename}', "
            f"mime='{content_type}', size={len(file_bytes)} bytes"
        )

        raw_bytes_list.append(file_bytes)
        media_parts.append(
            types.Part.from_bytes(data=file_bytes, mime_type=content_type)
        )

    if not media_parts:
        return JSONResponse(status_code=400, content={
            "success": False,
            "aiAvailable": False,
            "error": "All uploaded files were empty."
        })

    # ---------------------------------------------------------------------- #
    # Module 10 — Cache lookup by image hash                                  #
    # ---------------------------------------------------------------------- #
    cache_key = _compute_images_hash(raw_bytes_list)
    if cache_key in _ANALYSIS_CACHE:
        logger.info(f"[{trace_id}] Cache HIT for key {cache_key[:12]}... — returning cached analysis.")
        return _ANALYSIS_CACHE[cache_key]

    # ---------------------------------------------------------------------- #
    # Check Gemini client is available                                        #
    # ---------------------------------------------------------------------- #
    if not gemini_ai_service.client:
        logger.warning(f"[{trace_id}] Gemini client not configured — AI unavailable.")
        return JSONResponse(status_code=503, content={
            "success": False,
            "aiAvailable": False,
            "error": "AI service is not configured. Please set GEMINI_API_KEY."
        })

    # ---------------------------------------------------------------------- #
    # Call Gemini Vision                                                       #
    # ---------------------------------------------------------------------- #
    try:
        logger.info(
            f"[{trace_id}] Calling Gemini model: {gemini_ai_service.resolved_model}"
        )
        raw_response = await gemini_ai_service.analyze_media(
            media_parts=media_parts,
            latitude=latitude,
            longitude=longitude,
            address=address,
            notes=notes
        )
        logger.info(
            f"[{trace_id}] Raw Gemini response (first 400 chars): {raw_response[:400]}"
        )
    except Exception as e:
        error_str = str(e)
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
            user_message = (
                "AI analysis quota exceeded. Please enable billing on your "
                "Google Cloud project to use Gemini Vision."
            )
        elif "not configured" in error_str.lower():
            user_message = "AI service is not configured."
        else:
            user_message = "AI service temporarily unavailable."

        logger.error(f"[{trace_id}] Gemini call failed: {e}")
        logger.debug(traceback.format_exc())
        return JSONResponse(status_code=503, content={
            "success": False,
            "aiAvailable": False,
            "error": user_message
        })

    # ---------------------------------------------------------------------- #
    # Parse JSON                                                               #
    # ---------------------------------------------------------------------- #
    try:
        parsed_json = json.loads(raw_response)
    except Exception as parse_err:
        logger.error(f"[{trace_id}] Failed to parse Gemini JSON response: {parse_err}")
        return JSONResponse(status_code=503, content={
            "success": False,
            "aiAvailable": False,
            "error": f"AI returned an unreadable response. Raw: {raw_response[:200]}"
        })

    # ---------------------------------------------------------------------- #
    # Module 9 — If confidence is low, force suggestion                       #
    # ---------------------------------------------------------------------- #
    confidence = parsed_json.get("confidence", 0.0)
    if isinstance(confidence, (int, float)) and confidence < 0.60:
        parsed_json["suggestion"] = "Manual review recommended."

    # ---------------------------------------------------------------------- #
    # Validate against schema                                                  #
    # ---------------------------------------------------------------------- #
    try:
        validated = GeminiCivicAnalysis.model_validate(parsed_json)
        logger.info(
            f"[{trace_id}] Analysis complete: classification={validated.classification}, "
            f"category={validated.category}, confidence={validated.confidence}"
        )
        # Store in cache for future identical uploads
        _ANALYSIS_CACHE[cache_key] = validated
        return validated
    except Exception as val_err:
        logger.error(f"[{trace_id}] Pydantic validation failed: {val_err}")
        return JSONResponse(status_code=503, content={
            "success": False,
            "aiAvailable": False,
            "error": f"AI response did not match expected schema: {val_err}"
        })
