import logging
import uuid
import traceback
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.dependencies import get_current_user
from app.services.database import DatabaseService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/departments")
async def get_departments(current_user: dict = Depends(get_current_user)) -> Any:
    """
    Get all municipal departments and their performance stats.
    """
    trace_id = str(uuid.uuid4())
    try:
        departments = await DatabaseService.list_departments()
        return departments
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_departments: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve departments list.",
                "trace_id": trace_id
            }
        )


@router.get("/officers")
async def get_officers(
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get all municipal officers, optionally filtered by department.
    """
    trace_id = str(uuid.uuid4())
    try:
        officers = await DatabaseService.list_officers(department=department)
        return officers
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_officers: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve officers list.",
                "trace_id": trace_id
            }
        )


@router.get("/notifications")
async def get_global_notifications(current_user: dict = Depends(get_current_user)) -> Any:
    """
    Get all global issue notification updates across the platform (for dashboards/monitoring).
    """
    trace_id = str(uuid.uuid4())
    try:
        role = current_user.get("role", "citizen")
        if role in ["administrator", "municipal_admin"]:
            notifications = await DatabaseService.list_all_notifications()
        elif role == "department_officer":
            notifications = await DatabaseService.list_all_notifications(department=current_user.get("department"))
        else:
            # citizen
            notifications = await DatabaseService.list_all_notifications(owner_uid=current_user.get("uid"))
        return notifications
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_global_notifications: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve global notifications.",
                "trace_id": trace_id
            }
        )
