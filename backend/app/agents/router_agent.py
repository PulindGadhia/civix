import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


class RouterAgent:
    """
    Determines issue category and maps it to the responsible municipal department.
    """

    def __init__(self, gemini_api_key: str):
        self.api_key = gemini_api_key

    async def classify_and_route(
        self, text_description: str, visual_category: str
    ) -> Dict[str, Any]:
        logger.info(f"Routing issue: {text_description[:30]}...")
        return {
            "category": visual_category or "other",
            "suggested_department": "MUNICIPAL_ROADS_DEPARTMENT",
            "confidence_score": 0.94,
        }
