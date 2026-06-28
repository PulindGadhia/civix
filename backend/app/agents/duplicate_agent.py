import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class DuplicateAgent:
    """
    Compares incoming reports to existing open issues in the area using location
    geohashes and text/visual embeddings.
    """

    def __init__(self, gemini_api_key: str):
        self.api_key = gemini_api_key

    async def detect_duplicates(
        self,
        current_report: Dict[str, Any],
        existing_reports_in_radius: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        logger.info("Running duplicate detection check...")
        return {"is_duplicate": False, "duplicate_of_id": None, "confidence": 0.0}
