import uuid
import traceback
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/verify")
def verify_auth_token(current_user: Dict[str, Any] = Depends(get_current_user)) -> Any:
    """
    Verify Firebase authentication token.
    """
    trace_id = str(uuid.uuid4())
    try:
        return {"status": "success", "message": "Token verified", "user": current_user}
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in verify_auth_token: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to verify auth token.",
                "trace_id": trace_id
            }
        )


@router.get("/me")
def get_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)) -> Any:
    """
    Get profile information of the currently authenticated user.
    """
    trace_id = str(uuid.uuid4())
    try:
        return current_user
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_user_profile: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve user profile.",
                "trace_id": trace_id
            }
        )
