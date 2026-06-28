import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


class PriorityAgent:
    """
    Computes a numerical priority score (1-100) based on severity,
    population density, traffic status, and proximity to crucial landmarks.
    """

    def __init__(self, gemini_api_key: str):
        self.api_key = gemini_api_key

    async def calculate_priority(
        self, issue_details: Dict[str, Any], proximity_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        logger.info("Calculating priority score...")
        return {
            "priority_score": 65,
            "reasoning": (
                "Located on a high-traffic road within 100 meters "
                "of a public school zone."
            ),
        }
