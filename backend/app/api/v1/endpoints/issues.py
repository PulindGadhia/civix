import json
import math
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Any, List, Optional
import uuid
import traceback
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.dependencies import get_current_user, get_current_admin, get_current_officer, verify_issue_access
from app.services.database import DatabaseService
from app.services.storage import StorageService

logger = logging.getLogger(__name__)
router = APIRouter()


# --------------------------------------------------------------------------- #
# Module 3 — Duplicate Complaint Detection                                    #
# --------------------------------------------------------------------------- #

def _text_similarity(a: str, b: str) -> float:
    """Ratio of similarity between two strings (0.0-1.0)."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in metres between two lat/lng coordinates."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def detect_duplicate_issue(
    new_issue: dict,
    existing_issues: List[dict],
    distance_threshold_m: float = 500,
    time_window_days: int = 7,
) -> Optional[dict]:
    """
    Compare new_issue against existing_issues.
    Returns a duplicate status dict if a probable duplicate is found.
    Scoring:
      - Category match:   25 pts
      - Title similarity: 30 pts (scaled)
      - Desc similarity:  30 pts (scaled)
      - Distance:         15 pts (within 500 m)
    Score >= 60 → probable duplicate.
    """
    new_lat = new_issue.get("latitude") or 0
    new_lng = new_issue.get("longitude") or 0
    new_title = new_issue.get("title", "")
    new_desc = new_issue.get("description", "")
    new_cat = (new_issue.get("category") or "").lower()
    cutoff = datetime.now() - timedelta(days=time_window_days)

    best_score = 0
    best_match = None
    best_distance = None

    for issue in existing_issues:
        # Skip issues that are too old
        created_at = issue.get("createdAt")
        if created_at:
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except ValueError:
                    pass
            if isinstance(created_at, datetime) and created_at < cutoff:
                continue

        score = 0

        # Category match (+25)
        if (issue.get("category") or "").lower() == new_cat:
            score += 25

        # Title similarity (+30)
        score += _text_similarity(new_title, issue.get("title", "")) * 30

        # Description similarity (+30)
        score += _text_similarity(new_desc, issue.get("description", "")) * 30

        # Spatial proximity (+15)
        dist = _haversine_distance_m(
            new_lat, new_lng,
            issue.get("latitude") or 0,
            issue.get("longitude") or 0,
        )
        if dist <= distance_threshold_m:
            score += 15

        if score > best_score:
            best_score = score
            best_match = issue
            best_distance = round(dist)

    if best_score >= 60 and best_match:
        similarity_pct = min(round(best_score), 99)
        return {
            "isDuplicate": True,
            "similarityScore": similarity_pct,
            "matchedIssueId": best_match.get("id"),
            "matchedIssueTitle": best_match.get("title"),
            "distanceMeters": best_distance,
            "recommendation": (
                f"This issue appears {similarity_pct}% similar to issue "
                f"#{(best_match.get('id') or '')[-6:].upper()} reported recently. "
                "Please review before submitting to avoid duplication."
            ),
        }
    return None



class IssueResponse(BaseModel):
    id: str
    citizenId: str
    title: str
    description: str
    latitude: float
    longitude: float
    address: str
    category: str
    severity: str
    priorityScore: int
    status: str
    upvotesCount: int
    createdAt: datetime
    publicImageUrl: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    locality: Optional[str] = None
    pincode: Optional[str] = None
    houseNumber: Optional[str] = None
    apartment: Optional[str] = None
    buildingName: Optional[str] = None
    landmark: Optional[str] = None
    street: Optional[str] = None
    floor: Optional[str] = None
    wingBlock: Optional[str] = None
    streetNumber: Optional[str] = None
    nearbyShop: Optional[str] = None
    addressNotes: Optional[str] = None
    specialDirections: Optional[str] = None
    department: Optional[str] = None
    officer_id: Optional[str] = None
    officer_name: Optional[str] = None
    aiConfidence: Optional[float] = None
    aiAnalysis: Optional[str] = None
    aiSummary: Optional[str] = None
    duplicateStatus: Optional[dict] = None
    technician_name: Optional[str] = None
    inspection_date: Optional[str] = None
    material_used: Optional[str] = None
    completion_notes: Optional[str] = None
    resolution_date: Optional[datetime] = None
    resolver_officer_name: Optional[str] = None
    estimated_cost: Optional[float] = None
    citizen_verified: Optional[bool] = None


@router.post("", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def report_issue(
    title: str = Form(...),
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    address: str = Form(...),
    category: str = Form(...),
    image: Optional[UploadFile] = File(None),
    country: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    locality: Optional[str] = Form(None),
    pincode: Optional[str] = Form(None),
    houseNumber: Optional[str] = Form(None),
    apartment: Optional[str] = Form(None),
    buildingName: Optional[str] = Form(None),
    landmark: Optional[str] = Form(None),
    street: Optional[str] = Form(None),
    floor: Optional[str] = Form(None),
    wingBlock: Optional[str] = Form(None),
    streetNumber: Optional[str] = Form(None),
    nearbyShop: Optional[str] = Form(None),
    addressNotes: Optional[str] = Form(None),
    specialDirections: Optional[str] = Form(None),
    severity: Optional[str] = Form(None),
    priorityScore: Optional[int] = Form(None),
    department: Optional[str] = Form(None),
    aiConfidence: Optional[float] = Form(None),
    aiAnalysis: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
) -> Any:
    """
    Report a new civic issue with form fields and optional before-image.
    """
    trace_id = str(uuid.uuid4())
    try:
        # Upload photo if provided
        public_image_url = None
        if image:
            try:
                public_image_url = await StorageService.upload_file(image)
            except Exception as e:
                # Don't block report creation if upload fails, log it
                logger.error(f"[{trace_id}] Image upload failed during report: {e}")

        owner_uid = current_user.get("uid", "anonymous")
        owner_name = current_user.get("name", "Anonymous User")
        owner_email = current_user.get("email", "anonymous@hero.com")

        new_issue = {
            "citizenId": owner_uid,
            "ownerUid": owner_uid,
            "ownerName": owner_name,
            "ownerEmail": owner_email,
            "createdBy": owner_name,
            "title": title,
            "description": description,
            "latitude": latitude,
            "longitude": longitude,
            "address": address,
            "category": category,
            "severity": severity or "low",
            "priorityScore": priorityScore or 10,
            "status": "reported",
            "upvotesCount": 0,
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
            "assignedOfficer": "",
            "publicImageUrl": public_image_url,
            "country": country,
            "state": state,
            "district": district,
            "city": city,
            "locality": locality,
            "pincode": pincode,
            "houseNumber": houseNumber,
            "apartment": apartment,
            "buildingName": buildingName,
            "landmark": landmark,
            "street": street,
            "floor": floor,
            "wingBlock": wingBlock,
            "streetNumber": streetNumber,
            "nearbyShop": nearbyShop,
            "addressNotes": addressNotes,
            "specialDirections": specialDirections,
            "department": department,
            "aiConfidence": aiConfidence,
            "aiAnalysis": aiAnalysis,
        }

        # ----------------------------------------------------------------- #
        # Extract aiSummary from AI analysis JSON (if present)               #
        # ----------------------------------------------------------------- #
        ai_summary = None
        if aiAnalysis:
            try:
                ai_json = json.loads(aiAnalysis)
                ai_summary = ai_json.get("summary")
            except (json.JSONDecodeError, AttributeError):
                pass
        new_issue["aiSummary"] = ai_summary

        saved_issue = await DatabaseService.create_issue(new_issue)

        # ----------------------------------------------------------------- #
        # Module 3 — Duplicate detection (non-blocking)                     #
        # ----------------------------------------------------------------- #
        duplicate_status = None
        try:
            all_issues = await DatabaseService.list_issues()
            # Exclude the freshly created issue from comparison
            existing = [i for i in all_issues if i.get("id") != saved_issue.get("id")]
            duplicate_status = await detect_duplicate_issue(new_issue, existing)
            if duplicate_status:
                logger.info(
                    f"[{trace_id}] Duplicate detected: "
                    f"score={duplicate_status['similarityScore']}%, "
                    f"match={duplicate_status['matchedIssueId']}"
                )
        except Exception as dup_err:
            logger.warning(f"[{trace_id}] Duplicate detection failed (non-fatal): {dup_err}")

        if duplicate_status:
            saved_issue["duplicateStatus"] = duplicate_status

        return saved_issue
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in report_issue: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to create issue report.",
                "trace_id": trace_id
            }
        )



@router.get("", response_model=List[IssueResponse])
async def list_issues(
    category: Optional[str] = None,
    status: Optional[str] = None,
    department: Optional[str] = None,
    officer_id: Optional[str] = None,
    priority: Optional[str] = None,
    city: Optional[str] = None,
    date: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """
    List reported issues with advanced filtering.
    """
    trace_id = str(uuid.uuid4())
    try:
        role = current_user.get("role", "citizen")
        
        # Enforce role-based boundaries on data queries
        owner_uid = None
        officer_dept = None
        officer_user_id = None
        
        if role == "citizen":
            owner_uid = current_user.get("uid")
        elif role == "department_officer":
            officer_dept = current_user.get("department")
            officer_user_id = current_user.get("uid")

        issues = await DatabaseService.list_issues(
            category=category,
            status=status,
            department=department,
            officer_id=officer_id,
            priority=priority,
            city=city,
            date_str=date,
            severity=severity,
            owner_uid=owner_uid,
            officer_dept=officer_dept,
            officer_user_id=officer_user_id,
        )
        return issues
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in list_issues: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve issues list.",
                "trace_id": trace_id
            }
        )


@router.post("/{issue_id}/assign-department")
async def assign_department(
    issue_id: str,
    department: str = Form(...),
    current_user: dict = Depends(get_current_admin)
) -> Any:
    """
    Manually assign or reassign a department to an issue (Admin only).
    """
    trace_id = str(uuid.uuid4())
    try:
        updated_issue = await DatabaseService.assign_issue_department(issue_id, department)
        if not updated_issue:
            raise HTTPException(status_code=404, detail="Issue not found")
        return {"success": True, "issue": updated_issue}
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in assign_department: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.post("/{issue_id}/assign-officer")
async def assign_officer(
    issue_id: str,
    officer_id: str = Form(...),
    officer_name: str = Form(...),
    current_user: dict = Depends(get_current_officer)
) -> Any:
    """
    Manually assign or reassign an officer to an issue.
    Admins can assign anyone. Officers can claim issues by assigning to themselves.
    """
    trace_id = str(uuid.uuid4())
    try:
        # First verify the requesting user has access to the issue
        await verify_issue_access(issue_id, current_user)

        role = current_user.get("role", "citizen")
        # Enforce that department officers can only assign to themselves (claim case)
        if role == "department_officer" and current_user.get("uid") != officer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Officers can only claim issues by assigning to themselves."
            )
            
        updated_issue = await DatabaseService.assign_issue_officer(issue_id, officer_id, officer_name)
        if not updated_issue:
            raise HTTPException(status_code=404, detail="Issue not found")
        return {"success": True, "issue": updated_issue}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in assign_officer: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: str, current_user: dict = Depends(get_current_user)) -> Any:
    """
    Get detailed information for a specific issue.
    """
    trace_id = str(uuid.uuid4())
    try:
        # verify_issue_access checks ownership and raises 403/404 accordingly
        issue = await verify_issue_access(issue_id, current_user)
        return issue
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_issue: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve issue details.",
                "trace_id": trace_id
            }
        )


@router.post("/{issue_id}/upvote")
async def upvote_issue(
    issue_id: str, current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Upvote an existing issue.
    """
    trace_id = str(uuid.uuid4())
    try:
        # verify_issue_access verifies ownership and access permissions
        await verify_issue_access(issue_id, current_user)

        new_upvotes = await DatabaseService.upvote_issue(issue_id)
        if new_upvotes is None:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": "Not Found",
                    "details": f"Issue with ID '{issue_id}' not found.",
                    "trace_id": trace_id
                }
            )
        return {"status": "success", "upvotes": new_upvotes}
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in upvote_issue: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to upvote issue.",
                "trace_id": trace_id
            }
        )

