import logging
import time
from typing import List, Optional
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from app.core.config import settings

logger = logging.getLogger(__name__)

# Define Pydantic schema for structured output
class GeminiCivicAnalysis(BaseModel):
    classification: str = Field(..., description="Classification of the image content: 'Civic Issue', 'Not a Civic Issue', or 'Uncertain'.")
    issue_type: str = Field(..., description="Specific type of civic issue, or 'Not a Civic Issue', or 'Uncertain'.")
    category: str = Field(..., description="Standard category: 'Road Damage', 'Water Leakage', 'Garbage', 'Streetlight', 'Drainage', 'Traffic Signal', 'Illegal Dumping', 'Public Infrastructure', or 'Other'.")
    subcategory: Optional[str] = Field(None, description="Detailed subcategory of the issue (e.g. 'Pothole', 'Burst Pipe', 'Plastic Waste', 'Clogged Drain Grate').")
    severity: str = Field(..., description="Calculated severity: 'Low', 'Medium', 'High', 'Critical', or 'None'.")
    confidence: float = Field(..., description="Confidence score of the analysis between 0.0 and 1.0.")
    priority: str = Field(..., description="Calculated priority: 'Low', 'Medium', 'High', 'Critical', or 'None'.")
    department: str = Field(..., description="Recommended municipal department, or 'None'.")
    title: str = Field(..., description="A professional, descriptive title detailing the issue type and location hazard.")
    description: str = Field(..., description="A professional, detailed complaint description outlining the visible observations, safety risks, likely impact, urgency, and recommended actions based on the media files.")
    summary: str = Field(..., description="Concise administrative summary of the issue.")
    estimated_resolution: str = Field(..., description="Estimated resolution time (e.g. '3 Days').")
    estimated_repair_time: str = Field(..., description="Estimated active repair duration (e.g. '48 Hours').")
    estimated_repair_cost_range: str = Field(..., description="Predicted repair cost category (e.g., '$100 - $500', '$1000 - $5000').")
    risk_level: str = Field(..., description="Evaluated danger risk level: 'low', 'moderate', 'severe', 'extreme'.")
    hazard_level: str = Field(..., description="Hazard assessment matching risk level: 'low', 'moderate', 'severe', 'extreme'.")
    public_safety_impact: str = Field(..., description="Evaluation of the safety threats posed to the public (e.g., pedestrian collision risk, electric shock risk).")
    traffic_impact: str = Field(..., description="Evaluation of traffic obstruction severity (e.g., blocks lane, slows down flow, pedestrian walk blockage).")
    environmental_impact: str = Field(..., description="Evaluation of any ecological or environmental damage (e.g. soil contamination, water loss).")
    accessibility_impact: str = Field(..., description="Evaluation of access barriers for disabled, elderly, or general pedestrians.")
    primary_department: str = Field(..., description="Primary municipal department recommended to resolve this issue.")
    secondary_department: Optional[str] = Field(None, description="Optional secondary department associated with the issue.")
    supporting_department: Optional[str] = Field(None, description="Optional supporting department required for resolution.")
    department_recommendation_reasoning: str = Field(..., description="Detailed explanation of why these departments are recommended.")
    department_recommendation_confidence: float = Field(..., description="Confidence in department assignment.")
    estimated_inspection_time: str = Field(..., description="ETA for initial site inspection (e.g. '24 Hours').")
    estimated_verification_time: str = Field(..., description="ETA for final work verification (e.g. '12 Hours').")
    estimated_overall_eta: str = Field(..., description="Combined total resolution ETA (e.g. '3 Days').")
    resolution_intelligence_confidence: float = Field(..., description="Confidence score in the estimated completion times.")
    suggested_officer_skills: List[str] = Field(..., description="List of required officer/technician technical skills (e.g. 'Asphalt Laying', 'Electrical Wiring', 'Pipe Welding').")
    suggested_immediate_action: str = Field(..., description="Recommended immediate temporary action (e.g. 'Place barricade', 'Shut off main water valve').")
    recommended_action: str = Field(..., description="Suggested final worker action to repair the issue.")
    long_term_recommendation: str = Field(..., description="Proactive long-term suggestion (e.g., resurface entire road, replace old pipeline).")
    possible_cause: str = Field(..., description="Possible root cause of the issue.")
    citizen_advice: str = Field(..., description="Direct safety guidelines for citizen self-protection around this hazard.")
    safety_advice: str = Field(..., description="Safety advice guidelines matching citizen advice.")
    tags: List[str] = Field(..., description="List of relevant search tags.")
    reason: Optional[str] = Field(None, description="The reason for the classification, especially when not a civic issue or uncertain.")
    suggestion: Optional[str] = Field(None, description="Actionable suggestion or recommendation for the user.")

class GeminiServiceWrapper:
    def __init__(self):
        self.client = None
        self.resolved_model = "models/gemini-2.5-flash"  # Default fallback
        if settings.GEMINI_API_KEY:
            try:
                self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
                logger.info("Gemini GenAI client successfully initialized in GeminiServiceWrapper.")
                self.resolved_model = self._resolve_gemini_model()
            except Exception as e:
                logger.error(f"Failed to initialize Gemini GenAI client: {e}")
        else:
            logger.warning("GEMINI_API_KEY environment variable is empty. AI features will be unavailable.")

    def _resolve_gemini_model(self) -> str:
        if not self.client:
            return settings.GEMINI_MODEL or "models/gemini-2.5-flash"

        try:
            available_models = list(self.client.models.list())
            available_names = [m.name for m in available_models]

            logger.info("Available Gemini models: " + ", ".join(available_names[:5]) + "...")

            def verify_model_capabilities(model_obj, is_explicit: bool = False) -> bool:
                name = model_obj.name
                actions = model_obj.supported_actions or []
                if not is_explicit and "preview" in name.lower():
                    return False
                if "generateContent" not in actions:
                    return False
                if not name.startswith("models/gemini-"):
                    return False
                exclude_keywords = ["embedding", "tts", "aqa", "live-translate", "robotics", "computer-use"]
                if any(kw in name.lower() for kw in exclude_keywords):
                    return False
                return True

            model_map = {m.name: m for m in available_models}
            configured_model = settings.GEMINI_MODEL

            if configured_model:
                normalized_configured = configured_model
                if not normalized_configured.startswith("models/"):
                    normalized_configured = f"models/{normalized_configured}"

                if normalized_configured in model_map:
                    model_obj = model_map[normalized_configured]
                    if verify_model_capabilities(model_obj, is_explicit=True):
                        logger.info(f"[Gemini] Selected model: {normalized_configured} (explicitly configured)")
                        return normalized_configured
                    else:
                        logger.warning(f"[Gemini] Configured model {normalized_configured} does not meet requirements. Checking fallbacks.")
                else:
                    logger.warning(f"[Gemini] Configured model {normalized_configured} not found. Checking fallbacks.")

            # Fallback 1: models/gemini-2.5-flash
            fallback_1 = "models/gemini-2.5-flash"
            if fallback_1 in model_map and verify_model_capabilities(model_map[fallback_1]):
                logger.info(f"[Gemini] Selected model: {fallback_1} (fallback 1)")
                return fallback_1

            # Fallback 2: models/gemini-2.0-flash
            fallback_2 = "models/gemini-2.0-flash"
            if fallback_2 in model_map and verify_model_capabilities(model_map[fallback_2]):
                logger.info(f"[Gemini] Selected model: {fallback_2} (fallback 2)")
                return fallback_2

            # Last resort: find any non-preview gemini model that supports generateContent
            for name, m in model_map.items():
                if verify_model_capabilities(m):
                    logger.info(f"[Gemini] Selected model: {name} (auto-detected fallback)")
                    return name

            logger.warning(f"[Gemini] No suitable model found. Defaulting to: {fallback_1}")
            return fallback_1

        except Exception as e:
            logger.error(f"[Gemini] Error listing models: {e}. Defaulting to models/gemini-2.5-flash")
            return "models/gemini-2.5-flash"

    async def analyze_media(
        self,
        media_parts: List[types.Part],
        latitude: float,
        longitude: float,
        address: str,
        notes: Optional[str] = None
    ) -> str:
        """
        Sends media to Gemini for civic analysis.
        Raises an exception on failure — the endpoint layer decides how to handle failures.
        Returns a JSON string on success.
        """
        if not self.client:
            raise RuntimeError("Gemini client is not configured. Set GEMINI_API_KEY in your .env file.")

        prompt = f"""
        Analyze the uploaded media for civic/public infrastructure issues.
        Metadata Context:
        - Selected coordinates: Latitude {latitude}, Longitude {longitude}
        - Selection address: {address}
        - Current timestamp: {time.strftime('%Y-%m-%d %H:%M:%S GMT', time.gmtime())}
        - Optional citizen notes: {notes or 'None'}

        Core Tasks:
        1. Determine the image classification: 'Civic Issue', 'Not a Civic Issue', or 'Uncertain'.
        2. If it is a Civic Issue:
           - Supported Categories to map into: 'Road Damage', 'Water Leakage', 'Garbage', 'Streetlight', 'Drainage', 'Traffic Signal', 'Illegal Dumping', 'Public Infrastructure', or 'Other'.
           - Supported Civic Issues: Potholes, Road Cracks, Garbage, Illegal Dumping, Water Leakage, Drainage Problems, Broken Streetlights, Traffic Signal Damage, Footpath Damage, Construction Damage, Public Property Damage, Flooding, Blocked Roads, Vegetation Overgrowth, and Other Civic Infrastructure Issues.
           - Ensure the title is a professional, descriptive title (e.g. "A large pothole approximately one meter wide is visible in the center of the roadway, creating a potential hazard for two-wheelers."). Do not use single word titles like "Pothole".
           - The description must reference only visible objects in the uploaded image. Never generate generic descriptions.
        3. If it is NOT a Civic Issue (e.g. People only, Animals, Food, Cars without visible issues, Selfies, Documents, Indoor scenes, Products, Nature, Buildings without visible damage, Random objects, Screenshots, Memes):
           - Map strictly to classification='Not a Civic Issue'.
           - Ensure description, title, severity, priority, department, reason, and suggestion match the required 'Not a Civic Issue' defaults.
        4. If it is Uncertain:
           - Map to classification='Uncertain'.
           - Return confidence < 0.60.
           - Suggestion must be 'Manual verification required.'
        """

        contents = [prompt]
        contents.extend(media_parts)

        config = types.GenerateContentConfig(
            system_instruction=(
                "You are an expert municipal infrastructure inspector and municipal decision-support system.\n\n"
                "Rules:\n"
                "1. Analyze ONLY the uploaded image(s) or video. Do not assume or invent information. Never hallucinate.\n"
                "2. Base all conclusions strictly on visible evidence. If you are uncertain or the image is blurry/dark/unclear, return a confidence score below 0.60, set classification to 'Uncertain', and set suggestion to 'Manual review recommended.'.\n"
                "3. Classify the upload into one of three classifications: 'Civic Issue', 'Not a Civic Issue', or 'Uncertain'.\n"
                "4. Follow these classification actions:\n"
                "   - If classification is 'Civic Issue': Identify the issue and populate all schema fields dynamically. Do not use generic placeholders. For each field, provide realistic, context-aware values:\n"
                "     * category: Map to one of 'Road Damage', 'Water Leakage', 'Garbage', 'Streetlight', 'Drainage', 'Traffic Signal', 'Illegal Dumping', 'Public Infrastructure', or 'Other'.\n"
                "     * subcategory: A precise subcategory of the issue.\n"
                "     * title: A professional, descriptive title (e.g., 'Significant pothole on a major arterial corridor'). Do not use single word titles.\n"
                "     * description: A detailed, professional complaint description detailing visible objects, safety risks, and recommended actions.\n"
                "     * summary: A concise 1-2 sentence executive/administrative summary of the issue.\n"
                "     * estimated_resolution / estimated_overall_eta: Combined resolution ETA (e.g. '3 Days', '7 Days').\n"
                "     * estimated_repair_time: Active repair duration (e.g. '48 Hours', '24 Hours').\n"
                "     * estimated_repair_cost_range: Cost range estimate (e.g. '$100 - $500', '$500 - $1000', '$1000 - $5000').\n"
                "     * risk_level / hazard_level: Must match and be 'low', 'moderate', 'severe', or 'extreme'.\n"
                "     * public_safety_impact: The physical danger or threat to citizen safety.\n"
                "     * traffic_impact: The impact on road lane blockage or pedestrian flow.\n"
                "     * environmental_impact: Environmental concerns, resource wastage (e.g. water leakage), or contamination.\n"
                "     * accessibility_impact: Barrier or blockage details for wheelchairs, elderly, or disabled citizens.\n"
                "     * primary_department: Map to one of 'roads', 'sanitation', 'electrical', 'water', 'sewer', 'garden', or 'civil'.\n"
                "     * secondary_department / supporting_department: Optional secondary/supporting departments.\n"
                "     * department_recommendation_reasoning: Detailed reasoning explaining the department recommendations.\n"
                "     * department_recommendation_confidence: Confidence score of department recommendations.\n"
                "     * estimated_inspection_time: ETA to inspect (e.g. '24 Hours').\n"
                "     * estimated_verification_time: ETA to verify after repair (e.g. '12 Hours').\n"
                "     * resolution_intelligence_confidence: Confidence score in predictions.\n"
                "     * suggested_officer_skills: List of technical skills required (e.g. 'Asphalt Patching', 'Pipe Repair').\n"
                "     * suggested_immediate_action: Immediate temporary safety action (e.g., 'Place temporary barricading').\n"
                "     * recommended_action: Worker repair action.\n"
                "     * long_term_recommendation: Proactive long-term solution.\n"
                "     * possible_cause: Root cause analysis.\n"
                "     * citizen_advice / safety_advice: Safety instructions for citizens.\n"
                "   - If classification is 'Not a Civic Issue' (e.g. selfies, animals, food, documents, indoor scenes, products, nature, memes, screenshots, or buildings/cars without visible damage): Return:\n"
                "     * category: 'Other'\n"
                "     * subcategory: 'None'\n"
                "     * issue_type: 'Not a Civic Issue'\n"
                "     * severity: 'None'\n"
                "     * priority: 'None'\n"
                "     * department: 'None'\n"
                "     * primary_department: 'None'\n"
                "     * title: 'Image does not contain a civic issue.'\n"
                "     * description: 'The uploaded image does not appear to contain a reportable public infrastructure or community issue.'\n"
                "     * summary: 'Not a civic issue.'\n"
                "     * estimated_resolution / estimated_overall_eta: 'None'\n"
                "     * estimated_repair_time: 'None'\n"
                "     * estimated_repair_cost_range: 'None'\n"
                "     * risk_level / hazard_level: 'low'\n"
                "     * public_safety_impact: 'None'\n"
                "     * traffic_impact: 'None'\n"
                "     * environmental_impact: 'None'\n"
                "     * accessibility_impact: 'None'\n"
                "     * department_recommendation_reasoning: 'None'\n"
                "     * department_recommendation_confidence: 1.0\n"
                "     * estimated_inspection_time: 'None'\n"
                "     * estimated_verification_time: 'None'\n"
                "     * resolution_intelligence_confidence: 1.0\n"
                "     * suggested_officer_skills: []\n"
                "     * suggested_immediate_action: 'None'\n"
                "     * recommended_action: 'None'\n"
                "     * long_term_recommendation: 'None'\n"
                "     * possible_cause: 'None'\n"
                "     * citizen_advice / safety_advice: 'None'\n"
                "     * confidence: confidence score (float between 0.0 and 1.0)\n"
                "     * reason: detailed explanation of why it is not a civic issue\n"
                "     * suggestion: 'Please upload an image showing a public infrastructure issue such as a pothole, garbage dumping, water leakage, broken streetlight, drainage problem, damaged road, traffic signal issue, or another civic concern.'\n"
                "   - If classification is 'Uncertain': Return:\n"
                "     * category: 'Other'\n"
                "     * subcategory: 'Uncertain'\n"
                "     * issue_type: 'Uncertain'\n"
                "     * confidence: score below 0.60 (e.g. 0.40)\n"
                "     * severity: 'None' or 'Low'\n"
                "     * priority: 'None' or 'Low'\n"
                "     * department: 'None'\n"
                "     * primary_department: 'None'\n"
                "     * title: 'Uncertain: Manual verification required.'\n"
                "     * description: 'The inspector is uncertain whether a civic issue is present in this media.'\n"
                "     * summary: 'Uncertain case.'\n"
                "     * estimated_resolution / estimated_overall_eta: 'None'\n"
                "     * estimated_repair_time: 'None'\n"
                "     * estimated_repair_cost_range: 'None'\n"
                "     * risk_level / hazard_level: 'low'\n"
                "     * public_safety_impact: 'None'\n"
                "     * traffic_impact: 'None'\n"
                "     * environmental_impact: 'None'\n"
                "     * accessibility_impact: 'None'\n"
                "     * department_recommendation_reasoning: 'None'\n"
                "     * department_recommendation_confidence: 0.0\n"
                "     * estimated_inspection_time: 'None'\n"
                "     * estimated_verification_time: 'None'\n"
                "     * resolution_intelligence_confidence: 0.0\n"
                "     * suggested_officer_skills: []\n"
                "     * suggested_immediate_action: 'None'\n"
                "     * recommended_action: 'None'\n"
                "     * long_term_recommendation: 'None'\n"
                "     * possible_cause: 'None'\n"
                "     * citizen_advice / safety_advice: 'None'\n"
                "     * reason: explanation of uncertainty (e.g., poor lighting, blurry image)\n"
                "     * suggestion: 'Manual review recommended.'\n"
                "5. Return structured JSON matching the requested response schema. Never return Markdown (do not wrap in ```json). Never return plain text."
            ),
            response_mime_type="application/json",
            response_schema=GeminiCivicAnalysis,
        )

        # Retry logic with exponential backoff for transient failures (Module 3)
        max_retries = 3
        backoff_delay = 1.0  # seconds
        for attempt in range(1, max_retries + 1):
            try:
                response = self.client.models.generate_content(
                    model=self.resolved_model,
                    contents=contents,
                    config=config
                )
                if response.text:
                    return response.text
                else:
                    raise ValueError("Gemini returned an empty text response.")
            except Exception as e:
                logger.warning(f"Gemini generate_content attempt {attempt} failed: {e}")
                if attempt == max_retries:
                    raise e
                # Wait before retrying
                time.sleep(backoff_delay)
                backoff_delay *= 2.0

gemini_ai_service = GeminiServiceWrapper()
