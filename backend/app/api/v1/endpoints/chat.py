import uuid
import time
import logging
import traceback
import base64
from typing import Any, List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from google.genai import types

from app.api.dependencies import get_current_user, verify_issue_access
from app.services.gemini_service import gemini_ai_service
from app.services.database import DatabaseService
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

SYSTEM_PROMPT = """
You are "CiviX AI", a friendly, professional, intelligent, and patient AI Civic Assistant for the CiviX platform.
CiviX is an AI-powered civic platform designed to help citizens report, track, and resolve community infrastructure issues (like potholes, streetlights, garbage, water leaks) using a multi-agent AI system.

Your personality:
- Friendly, conversational, positive, and human-like (never sound robotic).
- Patient, helpful, and clear, explaining things in simple language.
- Concise when appropriate, but detailed when complex platform features or AI decisions need explanation.
- Greet users naturally (e.g., "Hello!", "Hi there!", "Welcome back!", "How can I help you today?").

Primary Responsibilities:
Help users with:
- Reporting civic issues (potholes, street damage, garbage dumps, water leaks, broken streetlights, drainage problems, etc.).
- Understanding AI image analysis and the confidence score.
- Explaining categories, severity levels, and department assignments.
- Tracking report status (e.g., reported, in progress, resolved).
- Using maps, uploading media evidence, and navigating platform features.
- Navigating the dashboard statistics and platform features.
- Providing troubleshooting and platform guidance.

General Knowledge:
You are also a fully capable AI assistant that can answer general knowledge questions naturally (technology, science, programming, history, mathematics, travel, education, etc.). Do not limit yourself only to CiviX, but act as a general helpful companion.

Rules:
1. Use the provided Application Context (current page, coordinates, address, draft details, active issue, AI analysis) to give smart, context-aware answers.
2. If the user is currently creating a report (e.g., has a draft report), offer to help improve their title, write a descriptive complaint explanation, recommend the category, or explain the severity.
3. If an image/video has already been uploaded, reference the AI analysis results. Don't invent or assume details.
4. Never generate fake/fabricated information or hallucinate. If you are uncertain about something, clearly say so.
5. If the user asks in Hindi ("hi") or Gujarati ("gu"), respond in that language.
"""

class ChatHistoryItem(BaseModel):
    role: str  # 'user' or 'model'
    text: str

class ChatContextLocation(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

class ChatContextAiAnalysis(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[float] = None
    severity: Optional[str] = None
    department: Optional[str] = None
    classification: Optional[str] = None

class ChatContextDraftReport(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None

class ChatContextActiveIssue(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None
    officer_name: Optional[str] = None
    estimated_completion_date: Optional[str] = None

class ChatContext(BaseModel):
    currentPage: Optional[str] = None
    location: Optional[ChatContextLocation] = None
    aiAnalysis: Optional[ChatContextAiAnalysis] = None
    draftReport: Optional[ChatContextDraftReport] = None
    activeIssue: Optional[ChatContextActiveIssue] = None

class ChatRequest(BaseModel):
    message: str
    preferred_language: str = "en"
    history: Optional[List[ChatHistoryItem]] = None
    context: Optional[ChatContext] = None
    image: Optional[str] = None  # Base64 image
    image_mime_type: Optional[str] = None
    stream: bool = False

class ChatResponse(BaseModel):
    response: str
    language: str

def format_application_context(context: Optional[ChatContext]) -> str:
    if not context:
        return ""
    
    lines = ["Current Application State Context:"]
    if context.currentPage:
        lines.append(f"- Current active view/page in UI: {context.currentPage}")
    
    if context.location:
        loc = context.location
        lines.append("- Current Map Location:")
        if loc.lat is not None and loc.lng is not None:
            lines.append(f"  * Coordinates: ({loc.lat}, {loc.lng})")
        if loc.address:
            lines.append(f"  * Address: {loc.address}")
        if loc.city:
            lines.append(f"  * City/Town: {loc.city}")
        if loc.district:
            lines.append(f"  * District: {loc.district}")
        if loc.state:
            lines.append(f"  * State: {loc.state}")
        if loc.country:
            lines.append(f"  * Country: {loc.country}")
            
    if context.aiAnalysis:
        ai = context.aiAnalysis
        lines.append("- Current AI Image/Video Analysis Results:")
        if ai.classification:
            lines.append(f"  * Classification: {ai.classification}")
        if ai.title:
            lines.append(f"  * Generated Title: {ai.title}")
        if ai.description:
            lines.append(f"  * Generated Description: {ai.description}")
        if ai.category:
            lines.append(f"  * Detected Category: {ai.category}")
        if ai.confidence is not None:
            lines.append(f"  * Confidence Score: {ai.confidence:.2f}")
        if ai.severity:
            lines.append(f"  * Calculated Severity: {ai.severity}")
        if ai.department:
            lines.append(f"  * Municipal Department: {ai.department}")
            
    if context.draftReport:
        draft = context.draftReport
        lines.append("- Current User's Draft Incident Report (before submission):")
        if draft.title:
            lines.append(f"  * Title: {draft.title}")
        if draft.description:
            lines.append(f"  * Description: {draft.description}")
        if draft.category:
            lines.append(f"  * Category Selected: {draft.category}")

    if context.activeIssue:
        issue = context.activeIssue
        lines.append("- Current Active/Selected Incident Report Details:")
        if issue.id:
            lines.append(f"  * Issue ID: {issue.id}")
        if issue.title:
            lines.append(f"  * Title: {issue.title}")
        if issue.description:
            lines.append(f"  * Description: {issue.description}")
        if issue.category:
            lines.append(f"  * Category: {issue.category}")
        if issue.severity:
            lines.append(f"  * Severity: {issue.severity}")
        if issue.status:
            lines.append(f"  * Status: {issue.status}")
            
    return "\n".join(lines)


async def fetch_issue_rich_context(issue_id: str) -> str:
    """
    Fetches rich context for a specific issue including:
    - Status timeline history
    - Comments
    - Verification summary
    Returns a formatted string to inject into the chatbot system instructions.
    """
    lines = ["--- Rich Issue Context ---"]
    try:
        timeline = await DatabaseService.list_status_history(issue_id)
        if timeline:
            lines.append("Timeline / Workflow Events:")
            for entry in timeline[-8:]:  # Last 8 events to avoid overflow
                ts = entry.get("timestamp", "")
                if hasattr(ts, "strftime"):
                    ts = ts.strftime("%Y-%m-%d %H:%M")
                lines.append(
                    f"  [{ts}] Status: {entry.get('status', '?')} — "
                    f"{entry.get('notes', '')} (By: {entry.get('updated_by', '?')})"
                )
    except Exception as e:
        logger.debug(f"fetch_issue_rich_context: timeline fetch failed: {e}")

    try:
        comments = await DatabaseService.list_comments(issue_id)
        if comments:
            lines.append("Recent Comments:")
            for c in comments[-5:]:
                lines.append(
                    f"  [{c.get('author_name', 'User')}]: {c.get('text', '')}"
                )
    except Exception as e:
        logger.debug(f"fetch_issue_rich_context: comments fetch failed: {e}")

    try:
        verification_data = await DatabaseService.get_issue_with_verifications(issue_id)
        if verification_data:
            vcount = len(verification_data.get("verifications", []))
            citizen_v = verification_data.get("citizen_verified", False)
            rating = verification_data.get("citizen_rating")
            feedback = verification_data.get("citizen_feedback")
            lines.append(f"Verification Summary: {vcount} public verifications.")
            if citizen_v:
                lines.append("  Citizen has VERIFIED the repair work as complete.")
            if rating:
                lines.append(f"  Citizen rating: {rating}/5")
            if feedback:
                lines.append(f"  Citizen feedback: \"{feedback}\"")
    except Exception as e:
        logger.debug(f"fetch_issue_rich_context: verification fetch failed: {e}")

    return "\n".join(lines) if len(lines) > 1 else ""

@router.post("", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest, current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Interact with the Gemini Citizen Companion with memory, context, and optional streaming.
    """
    trace_id = str(uuid.uuid4())
    start_time = time.time()
    
    try:
        # Secure the assistant endpoint by verifying that the requesting user has access to the attached activeIssue context if provided
        if request.context and request.context.activeIssue and request.context.activeIssue.id:
            await verify_issue_access(request.context.activeIssue.id, current_user)

        model_name = gemini_ai_service.resolved_model
        
        # Build contents list
        contents = []
        
        # Add history (limit last 10 messages)
        if request.history:
            for item in request.history[-10:]:
                role = "user" if item.role == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=item.text)]
                    )
                )
        
        # Add base64 image if attached
        user_parts = [types.Part.from_text(text=request.message)]
        if request.image and request.image_mime_type:
            try:
                # Remove data uri prefix if present
                img_b64 = request.image
                if "," in img_b64:
                    img_b64 = img_b64.split(",")[1]
                img_data = base64.b64decode(img_b64)
                user_parts.append(
                    types.Part.from_bytes(
                        data=img_data,
                        mime_type=request.image_mime_type
                    )
                )
            except Exception as img_err:
                logger.error(f"[{trace_id}] Failed to decode attached chat image: {img_err}")
        
        # Append the new user message
        contents.append(
            types.Content(
                role="user",
                parts=user_parts
            )
        )
        
        # Format context and system instructions
        formatted_context = format_application_context(request.context)

        # -------------------------------------------------------------- #
        # Module 8 — Enrich with live issue history / timeline / comments #
        # -------------------------------------------------------------- #
        rich_issue_context = ""
        if request.context and request.context.activeIssue and request.context.activeIssue.id:
            try:
                rich_issue_context = await fetch_issue_rich_context(
                    request.context.activeIssue.id
                )
            except Exception as rich_err:
                logger.debug(f"[{trace_id}] Rich issue context fetch failed (non-fatal): {rich_err}")
        
        user_role = current_user.get("role", "citizen")
        user_name = current_user.get("name", "User")
        user_dept = current_user.get("department", "")

        role_instruction = ""
        if user_role == "citizen":
            role_instruction = (
                f"You are currently assisting a Citizen named {user_name}.\n"
                "Help them with: reporting new issues, image/video AI analysis, checking the public incident map, tracking complaint progress, voting in community verifications, leaving comments, and earning Civic Points / checking the Leaderboard."
            )
        elif user_role == "department_officer":
            role_instruction = (
                f"You are currently assisting a Department Officer named {user_name} (Department: {user_dept or 'municipal'}).\n"
                "Help them manage their operational workspace: view assigned issues, manage department queues, schedule inspections, update status controls, record repair costs, log resolution notes, and check pending tasks.\n"
                "When they ask about workflow steps, reference the current issue status and next expected lifecycle transition."
            )
        elif user_role in ["administrator", "municipal_admin"]:
            role_instruction = (
                f"You are currently assisting a Municipal Administrator named {user_name}.\n"
                "Help them review executive analytics: audit total/critical reports, assign/reassign departments/officers, monitor system health, check Firestore/Gemini/API status logs, and view officer/department performance metrics.\n"
                "When showing critical issues, mention department assignments and estimated completion dates."
            )

        system_instruction = f"{SYSTEM_PROMPT}\n\n{role_instruction}"
        if formatted_context:
            system_instruction += "\n\n" + formatted_context
        if rich_issue_context:
            system_instruction += "\n\n" + rich_issue_context
            
        config = types.GenerateContentConfig(
            system_instruction=system_instruction
        )
        
        # Check if Gemini client is configured
        if not gemini_ai_service.client:
            logger.warning(f"[{trace_id}] Gemini client not configured — GEMINI_API_KEY is missing.")
            return {
                "response": "The AI assistant is not available because GEMINI_API_KEY is not configured. Please set your Gemini API key in the backend .env file.",
                "language": request.preferred_language
            }
            
        # Streaming response
        if request.stream:
            async def response_streamer():
                try:
                    response_stream = gemini_ai_service.client.models.generate_content_stream(
                        model=model_name,
                        contents=contents,
                        config=config
                    )
                    for chunk in response_stream:
                        if chunk.text:
                            yield chunk.text
                    
                    duration = time.time() - start_time
                    logger.info(f"[{trace_id}] Streaming chat complete in {duration:.2f}s using model {model_name}")
                except Exception as stream_err:
                    err_str = str(stream_err)
                    logger.error(f"[{trace_id}] Error in streaming chat: {stream_err}")
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                        yield "\nThe AI assistant is currently unavailable because the Gemini API quota has been exceeded. Please enable billing on your Google Cloud project to restore AI functionality."
                    else:
                        yield f"\nAI service temporarily unavailable. ({err_str[:120]})"
                    
            return StreamingResponse(response_streamer(), media_type="text/plain")
            
        # Non-streaming response
        response = gemini_ai_service.client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config
        )
        
        response_text = response.text or ""
        
        # Log response metrics
        duration = time.time() - start_time
        tokens_info = ""
        if response.usage_metadata:
            tokens_info = f" (Tokens: prompt={response.usage_metadata.prompt_token_count}, candidates={response.usage_metadata.candidates_token_count})"
        logger.info(f"[{trace_id}] Chat completed in {duration:.2f}s using model {model_name}{tokens_info}")
        
        return {
            "response": response_text,
            "language": request.preferred_language
        }
        
    except Exception as e:
        err_str = str(e)
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in chat_with_assistant: {e}\nStack:\n{stack}")
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
            user_message = "The AI assistant is currently unavailable because the Gemini API quota has been exceeded. Please enable billing on your Google Cloud project to restore AI functionality."
        else:
            user_message = f"AI service temporarily unavailable. ({err_str[:120]})"
        return {
            "response": user_message,
            "language": request.preferred_language
        }
