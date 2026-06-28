import logging
from typing import Optional

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

client = None

# Initialize the Gemini GenAI Client if API key is present
if settings.GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("Google GenAI client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize GenAI client: {e}")
else:
    logger.warning(
        "GEMINI_API_KEY environment variable is empty. GenAI client in fallback mode."
    )


class GeminiService:
    """
    Service wrapper for Google Gemini API operations.
    Supports structured text prompts, vision model inputs, and audio digestion.
    """

    @staticmethod
    async def generate_content(
        prompt: str,
        model: Optional[str] = None,
        response_schema: Optional[type] = None,
    ) -> str:
        """
        Sends content generation query to Gemini.
        Falls back to dummy mock response if API is unconfigured.
        """
        if not model:
            try:
                from app.services.gemini_service import gemini_ai_service
                model = gemini_ai_service.resolved_model
            except Exception:
                model = settings.GEMINI_MODEL or "models/gemini-2.5-flash"
        if not client:
            logger.info(f"[Fallback Mock] Prompt: {prompt[:30]}...")
            return "Mock response. Configure GEMINI_API_KEY to get actual results."

        try:
            config = None
            if response_schema:
                config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=response_schema,
                )

            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
            return response.text or ""
        except Exception as e:
            logger.error(f"Gemini API generation error: {e}")
            if response_schema:
                return "{}"
            return "AI service temporarily unavailable."
