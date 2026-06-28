import logging
import uuid
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.dependencies import get_current_user, verify_issue_access
from app.services.database import DatabaseService
from app.services.storage import StorageService

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{issue_id}/lifecycle")
async def get_issue_lifecycle_history(
    issue_id: str,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get the complete chronological status history logs for an issue.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        history = await DatabaseService.list_status_history(issue_id)
        return history
    except HTTPException as he:
        raise he
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_issue_lifecycle_history: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve status history.",
                "trace_id": trace_id
            }
        )

@router.get("/{issue_id}/notifications")
async def get_issue_notifications(
    issue_id: str,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get all notification logs for an issue.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        notifications = await DatabaseService.list_notifications(issue_id)
        return notifications
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_issue_notifications: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve notifications.",
                "trace_id": trace_id
            }
        )

@router.post("/{issue_id}/status")
async def update_issue_lifecycle_status(
    issue_id: str,
    status_val: str = Form(..., alias="status"),
    updated_by: str = Form(...),
    notes: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    progress_percentage: Optional[int] = Form(None),
    estimated_completion_date: Optional[str] = Form(None),
    estimated_cost: Optional[float] = Form(None),
    technician_name: Optional[str] = Form(None),
    inspection_date: Optional[str] = Form(None),
    material_used: Optional[str] = Form(None),
    citizen_verified: Optional[bool] = Form(None),
    officer_id: Optional[str] = Form(None),
    officer_name: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    severity: Optional[str] = Form(None),
    deadline: Optional[str] = Form(None),
    escalated: Optional[bool] = Form(None),
    internal_notes: Optional[str] = Form(None),
    rating: Optional[int] = Form(None),
    feedback: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Transition issue status, log history, and trigger toast notifications.
    Enforces RBAC validation and supports file uploads for media evidence.
    """
    trace_id = str(uuid.uuid4())
    try:
        # 1. Fetch and authorize access to the issue
        issue = await verify_issue_access(issue_id, current_user)

        # 2. Check Role-Based Access Controls
        role = current_user.get("role", "citizen")
        user_dept = current_user.get("department")

        if role == "citizen":
            # Citizens can ONLY update verification status
            if citizen_verified is not None:
                # Citizens are allowed to verify/unverify
                pass
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Citizens cannot transition issue statuses or modify department parameters."
                )
        elif role == "department_officer":
            # Officers must belong to the department of the issue if set
            issue_dept = issue.get("department")
            if issue_dept and user_dept and issue_dept.lower() != user_dept.lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Officer belongs to '{user_dept}' department but the issue is assigned to '{issue_dept}'."
                )

        # 3. Validate status against allowed progression stages
        valid_statuses = [
            "reported", "ai_analysis_completed", "pending_administrator_review",
            "department_assigned", "officer_assigned", "officer_accepted", "officer_rejected",
            "inspection_scheduled", "inspection_completed", "work_in_progress", "repair_completed",
            "citizen_verification_pending", "citizen_rejected", "reopened", "closed", "resolved"
        ]
        
        normalized_status = status_val.lower().replace(" ", "_")
        if normalized_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{status_val}'. Must be one of {valid_statuses}."
            )
            
        # Process files
        media_urls = []
        if files:
            for file in files:
                if file.filename:
                    url = await StorageService.upload_file(file)
                    media_urls.append(url)
                    
        # Set default progress percentages if not manually specified
        status_progress_mapping = {
            "reported": 10,
            "ai_analysis_completed": 20,
            "pending_administrator_review": 25,
            "department_assigned": 35,
            "officer_assigned": 40,
            "officer_accepted": 45,
            "officer_rejected": 35,
            "inspection_scheduled": 55,
            "inspection_completed": 65,
            "work_in_progress": 75,
            "repair_completed": 85,
            "citizen_verification_pending": 90,
            "citizen_rejected": 75,
            "reopened": 75,
            "closed": 100,
            "resolved": 100
        }
        
        final_progress = progress_percentage
        if final_progress is None:
            final_progress = status_progress_mapping.get(normalized_status, 10)
            
        lifecycle_data = {
            "status": normalized_status,
            "updated_by": updated_by,
            "notes": notes or "",
            "progress_percentage": final_progress,
            "media_urls": media_urls
        }
        
        if department:
            lifecycle_data["department"] = department
        if estimated_completion_date:
            lifecycle_data["estimated_completion_date"] = estimated_completion_date
        if technician_name:
            lifecycle_data["technician_name"] = technician_name
        if inspection_date:
            lifecycle_data["inspection_date"] = inspection_date
        if material_used:
            lifecycle_data["material_used"] = material_used
        if estimated_cost is not None:
            lifecycle_data["estimated_cost"] = estimated_cost
        if citizen_verified is not None:
            lifecycle_data["citizen_verified"] = citizen_verified
        if officer_id:
            lifecycle_data["officer_id"] = officer_id
        if officer_name:
            lifecycle_data["officer_name"] = officer_name
        if category:
            lifecycle_data["category"] = category
        if priority:
            lifecycle_data["priority"] = priority
        if severity:
            lifecycle_data["severity"] = severity
        if deadline:
            lifecycle_data["deadline"] = deadline
        if escalated is not None:
            lifecycle_data["escalated"] = escalated
        if internal_notes:
            lifecycle_data["internal_notes"] = internal_notes
        if rating is not None:
            lifecycle_data["rating"] = rating
        if feedback:
            lifecycle_data["feedback"] = feedback
            
        updated_issue = await DatabaseService.update_issue_lifecycle(issue_id, lifecycle_data)
        if not updated_issue:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Issue with ID '{issue_id}' not found."
            )
            
        return {
            "success": True,
            "status": normalized_status,
            "progress_percentage": final_progress,
            "issue": updated_issue
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in update_issue_lifecycle_status: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to update lifecycle status.",
                "trace_id": trace_id
            }
        )

