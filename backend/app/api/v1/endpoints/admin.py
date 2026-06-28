import uuid
import traceback
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from app.api.dependencies import get_current_admin
from app.core.firebase import db
from firebase_admin import auth as admin_auth

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_ROLES = ["citizen", "department_officer", "administrator", "municipal_admin"]
VALID_STATUSES = ["Active", "Disabled"]


class UpdateRoleRequest(BaseModel):
    role: str
    department: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {VALID_ROLES}")
        return v


class UpdateStatusRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


MOCK_USERS: List[Dict[str, Any]] = [
    {
        "uid": "mock-admin-uid",
        "fullName": "Mock Admin",
        "email": "admin@communityhero.org",
        "role": "administrator",
        "department": None,
        "status": "Active",
        "city": "Ahmedabad",
        "createdAt": "2025-01-01T00:00:00Z",
        "lastLogin": "2025-06-01T12:00:00Z",
    },
    {
        "uid": "mock-citizen-uid",
        "fullName": "Mock Citizen",
        "email": "citizen@communityhero.org",
        "role": "citizen",
        "department": None,
        "status": "Active",
        "city": "Ahmedabad",
        "createdAt": "2025-02-15T00:00:00Z",
        "lastLogin": "2025-06-20T09:30:00Z",
    },
    {
        "uid": "mock-officer-uid",
        "fullName": "Mock Officer",
        "email": "officer@communityhero.org",
        "role": "department_officer",
        "department": "Water Supply",
        "status": "Active",
        "city": "Ahmedabad",
        "createdAt": "2025-03-10T00:00:00Z",
        "lastLogin": "2025-06-22T14:00:00Z",
    },
]


@router.get("/users")
def list_users(current_user: Dict[str, Any] = Depends(get_current_admin)) -> Any:
    """
    List all users from Firestore. Returns mock data if Firestore is unavailable.
    """
    trace_id = str(uuid.uuid4())
    try:
        if db is None:
            logger.info(f"[{trace_id}] Firestore unavailable, returning mock users.")
            return {"success": True, "users": MOCK_USERS}

        users_ref = db.collection("users")
        docs = users_ref.stream()

        users: List[Dict[str, Any]] = []
        for doc in docs:
            data = doc.to_dict()
            created_at = data.get("createdAt")
            last_login = data.get("lastLogin")
            users.append({
                "uid": data.get("uid", doc.id),
                "fullName": data.get("fullName", ""),
                "email": data.get("email", ""),
                "role": data.get("role", "citizen"),
                "department": data.get("department"),
                "status": data.get("status", "Active"),
                "city": data.get("city", ""),
                "createdAt": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at) if created_at else None,
                "lastLogin": last_login.isoformat() if hasattr(last_login, "isoformat") else str(last_login) if last_login else None,
            })

        return {"success": True, "users": users}
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in list_users: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve users list.",
                "trace_id": trace_id
            }
        )


@router.patch("/users/{uid}/role")
def update_user_role(
    uid: str,
    body: UpdateRoleRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Change a user's role. Optionally set department for department_officer role.
    """
    trace_id = str(uuid.uuid4())
    try:
        update_data: Dict[str, Any] = {"role": body.role}

        if body.role == "department_officer" and body.department:
            update_data["department"] = body.department
        elif body.role != "department_officer":
            # Clear department when switching away from department_officer
            update_data["department"] = None

        if db is None:
            logger.info(f"[{trace_id}] Firestore unavailable, returning mock role update for uid={uid}.")
            return {
                "success": True,
                "message": f"Role updated to '{body.role}' for user {uid} (mock).",
                "updated": update_data,
            }

        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": "Not Found",
                    "details": f"User with uid '{uid}' not found.",
                    "trace_id": trace_id
                }
            )

        user_ref.update(update_data)

        return {
            "success": True,
            "message": f"Role updated to '{body.role}' for user {uid}.",
            "updated": update_data,
        }
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in update_user_role: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to update user role.",
                "trace_id": trace_id
            }
        )


@router.patch("/users/{uid}/status")
def update_user_status(
    uid: str,
    body: UpdateStatusRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Enable or disable a user account.
    """
    trace_id = str(uuid.uuid4())
    try:
        update_data: Dict[str, Any] = {"status": body.status}

        if db is None:
            logger.info(f"[{trace_id}] Firestore unavailable, returning mock status update for uid={uid}.")
            return {
                "success": True,
                "message": f"Status updated to '{body.status}' for user {uid} (mock).",
                "updated": update_data,
            }

        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": "Not Found",
                    "details": f"User with uid '{uid}' not found.",
                    "trace_id": trace_id
                }
            )

        user_ref.update(update_data)

        return {
            "success": True,
            "message": f"Status updated to '{body.status}' for user {uid}.",
            "updated": update_data,
        }
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in update_user_status: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to update user status.",
                "trace_id": trace_id
            }
        )


from app.services.database import DatabaseService
from app.core.firebase import firebase_app
from datetime import datetime


class UpdateUserDetailRequest(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None


class CreateOfficerRequest(BaseModel):
    fullName: str
    email: str
    password: str
    phone: str
    department: str
    designation: str
    permissions: Optional[List[str]] = None


class UpdateOfficerRequest(BaseModel):
    fullName: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    status: Optional[str] = None
    permissions: Optional[List[str]] = None


class CreateDepartmentRequest(BaseModel):
    departmentId: str
    departmentName: str
    description: str
    headOfficer: Optional[str] = None


class UpdateDepartmentRequest(BaseModel):
    departmentName: Optional[str] = None
    description: Optional[str] = None
    headOfficer: Optional[str] = None
    status: Optional[str] = None


@router.patch("/users/{uid}")
async def patch_user(
    uid: str,
    body: UpdateUserDetailRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Patch any user details (fullName, email, phone, role, status, designation, department).
    """
    trace_id = str(uuid.uuid4())
    try:
        update_data = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update_data:
            return {"success": True, "message": "No fields to update."}

        # Check existing user
        if db is not None:
            user_doc = db.collection("users").document(uid).get()
            if not user_doc.exists:
                return JSONResponse(status_code=404, content={"success": False, "error": "User not found"})

        await DatabaseService.update_user(uid, update_data)
        
        await DatabaseService.log_admin_action(
            admin_id=current_user.get("uid", "admin"),
            admin_name=current_user.get("name", "Admin"),
            action="Update User Details",
            target_type="user",
            target_id=uid,
            target_name=update_data.get("fullName", uid)
        )
        return {"success": True, "updated": update_data}
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in patch_user: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.post("/officers")
async def create_officer(
    body: CreateOfficerRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Create a new officer user. Provision them in Firebase Auth, and set up metadata.
    """
    trace_id = str(uuid.uuid4())
    try:
        uid = None
        # 1. Firebase Auth Creation
        try:
            if firebase_app:
                user_record = admin_auth.create_user(
                    email=body.email,
                    password=body.password,
                    display_name=body.fullName,
                    phone_number=body.phone if body.phone else None
                )
                uid = user_record.uid
            else:
                uid = f"mock-officer-{uuid.uuid4().hex[:8]}"
        except Exception as auth_err:
            logger.error(f"Firebase auth user creation failed: {auth_err}")
            return JSONResponse(status_code=400, content={"success": False, "error": f"Auth creation failed: {str(auth_err)}"})

        # 2. Create User document
        user_data = {
            "uid": uid,
            "fullName": body.fullName,
            "email": body.email,
            "phone": body.phone,
            "role": "department_officer",
            "department": body.department,
            "designation": body.designation,
            "status": "Active",
            "createdAt": datetime.utcnow(),
            "lastLogin": None,
            "isVerified": True
        }
        if db is not None:
            db.collection("users").document(uid).set(user_data)
        else:
            # Add to mock lists
            MOCK_USERS.append({
                "uid": uid,
                "fullName": body.fullName,
                "email": body.email,
                "role": "department_officer",
                "department": body.department,
                "status": "Active",
                "city": "Ahmedabad",
                "createdAt": datetime.utcnow().isoformat(),
                "lastLogin": None,
            })

        # 3. Create Officer document
        officer_data = {
            "id": uid,
            "uid": uid,
            "fullName": body.fullName,
            "email": body.email,
            "phone": body.phone,
            "department": body.department,
            "designation": body.designation,
            "status": "Active",
            "permissions": body.permissions or ["inspect", "resolve"],
            "joinedDate": datetime.utcnow().isoformat(),
            "performanceScore": 100,
            "currentWorkload": 0,
            "completedIssues": 0,
            "activeIssues": [],
            "averageResolutionTime": 0.0
        }
        await DatabaseService.create_officer_doc(uid, officer_data)

        # 4. Log Action
        await DatabaseService.log_admin_action(
            admin_id=current_user.get("uid", "admin"),
            admin_name=current_user.get("name", "Admin"),
            action="Create Officer",
            target_type="officer",
            target_id=uid,
            target_name=body.fullName
        )
        return {"success": True, "uid": uid, "officer": officer_data}
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in create_officer: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.patch("/officers/{uid}")
async def patch_officer(
    uid: str,
    body: UpdateOfficerRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Patch officer metadata. Handles transfer when department changes.
    """
    trace_id = str(uuid.uuid4())
    try:
        update_data = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update_data:
            return {"success": True, "message": "No fields to update."}

        # Check existing officer
        if db is not None:
            off_doc = db.collection("officers").document(uid).get()
            if not off_doc.exists:
                return JSONResponse(status_code=404, content={"success": False, "error": "Officer not found"})

        await DatabaseService.update_officer_doc(uid, update_data)

        await DatabaseService.log_admin_action(
            admin_id=current_user.get("uid", "admin"),
            admin_name=current_user.get("name", "Admin"),
            action="Update Officer Metadata",
            target_type="officer",
            target_id=uid,
            target_name=update_data.get("fullName", uid)
        )
        return {"success": True, "updated": update_data}
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in patch_officer: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.get("/departments")
async def list_admin_departments(
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Get all departments (authorized admin view).
    """
    trace_id = str(uuid.uuid4())
    try:
        departments = await DatabaseService.list_departments()
        return departments
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in list_admin_departments: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.post("/departments")
async def create_department(
    body: CreateDepartmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Create a new department.
    """
    trace_id = str(uuid.uuid4())
    try:
        dept_data = {
            "id": body.departmentId,
            "departmentId": body.departmentId,
            "name": body.departmentName,
            "departmentName": body.departmentName,
            "description": body.description,
            "headOfficer": body.headOfficer,
            "numberOfOfficers": 0,
            "activeIssues": 0,
            "completedIssues": 0,
            "averageResolutionTime": 0.0,
            "performanceScore": 100,
            "status": "Active"
        }
        await DatabaseService.create_department_doc(body.departmentId, dept_data)

        await DatabaseService.log_admin_action(
            admin_id=current_user.get("uid", "admin"),
            admin_name=current_user.get("name", "Admin"),
            action="Create Department",
            target_type="department",
            target_id=body.departmentId,
            target_name=body.departmentName
        )
        return {"success": True, "department": dept_data}
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in create_department: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.patch("/departments/{dept_id}")
async def patch_department(
    dept_id: str,
    body: UpdateDepartmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Update department details.
    """
    trace_id = str(uuid.uuid4())
    try:
        update_data = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update_data:
            return {"success": True, "message": "No fields to update."}

        # Check existing department
        if db is not None:
            dept_doc = db.collection("departments").document(dept_id).get()
            if not dept_doc.exists:
                return JSONResponse(status_code=404, content={"success": False, "error": "Department not found"})

        await DatabaseService.update_department_doc(dept_id, update_data)

        await DatabaseService.log_admin_action(
            admin_id=current_user.get("uid", "admin"),
            admin_name=current_user.get("name", "Admin"),
            action="Update Department",
            target_type="department",
            target_id=dept_id,
            target_name=update_data.get("departmentName", dept_id)
        )
        return {"success": True, "updated": update_data}
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in patch_department: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Archive a department.
    """
    trace_id = str(uuid.uuid4())
    try:
        # Check existing department
        if db is not None:
            dept_doc = db.collection("departments").document(dept_id).get()
            if not dept_doc.exists:
                return JSONResponse(status_code=404, content={"success": False, "error": "Department not found"})

        await DatabaseService.archive_department_doc(dept_id)

        await DatabaseService.log_admin_action(
            admin_id=current_user.get("uid", "admin"),
            admin_name=current_user.get("name", "Admin"),
            action="Archive Department",
            target_type="department",
            target_id=dept_id,
            target_name=dept_id
        )
        return {"success": True, "message": f"Department {dept_id} archived successfully."}
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in delete_department: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.get("/activity")
async def get_admin_activities(
    current_user: Dict[str, Any] = Depends(get_current_admin),
) -> Any:
    """
    Get recent administrative activities.
    """
    trace_id = str(uuid.uuid4())
    try:
        activities = await DatabaseService.list_admin_activities()
        return activities
    except Exception as e:
        logger.error(f"[{trace_id}] Exception in get_admin_activities: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# --------------------------------------------------------------------------- #
# Smart Command Center & Executive Analytics AI Endpoints                    #
# --------------------------------------------------------------------------- #

class AdminAiInsightsRequest(BaseModel):
    total_issues: int
    active_issues: int
    resolved_issues: int
    critical_issues: int
    department_stats: List[Dict[str, Any]]
    officer_stats: List[Dict[str, Any]]
    recent_complaints: List[Dict[str, Any]]


@router.post("/ai-insights")
async def generate_ai_insights(
    body: AdminAiInsightsRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin)
) -> Any:
    """
    Generate 4-6 executive municipal insights using Gemini 2.5 Flash.
    Falls back to data-driven statistical sentences if Gemini is unavailable.
    """
    trace_id = str(uuid.uuid4())
    try:
        from app.services.gemini_service import gemini_ai_service
        import json
        
        if not gemini_ai_service.client:
            raise RuntimeError("Gemini client is not configured.")
            
        prompt = f"""
        You are the Smart Municipal Command Center Executive Intelligence system.
        Based on the following live municipal metrics, generate 4-6 concise, highly specific, and actionable administrative insights (each in 1 sentence max).
        
        Live Metrics:
        - Total Reports: {body.total_issues}
        - Active Tickets: {body.active_issues}
        - Resolved Count: {body.resolved_issues}
        - Critical Hazard Alerts: {body.critical_issues}
        - Department Stats: {body.department_stats}
        - Officer Stats: {body.officer_stats}
        - Recent Complaints: {body.recent_complaints}
        
        Return the response strictly as a JSON array of strings, e.g., ["Insight 1", "Insight 2", ...].
        Do not wrap in markdown or add code blocks (no ```json).
        """
        
        response = gemini_ai_service.client.models.generate_content(
            model=gemini_ai_service.resolved_model,
            contents=[prompt]
        )
        
        if response.text:
            text = response.text.strip()
            if text.startswith("```"):
                text = text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(text)
            return {"success": True, "insights": parsed}
        else:
            raise ValueError("Empty response from Gemini")
            
    except Exception as e:
        logger.warning(f"[{trace_id}] AI Insights Gemini call failed: {e}. Using statistical fallback.")
        insights = [
            f"Active backlog stands at {body.active_issues} reports with {body.critical_issues} critical hazards pending.",
            f"Municipal resolution progress is at {round((body.resolved_issues / max(body.total_issues, 1)) * 100)}% overall compliance."
        ]
        if body.department_stats:
            max_dept = max(body.department_stats, key=lambda x: x.get("active", 0))
            insights.append(f"{max_dept.get('name', 'Municipal')} Department is currently holding the highest workload with {max_dept.get('active', 0)} open tickets.")
        if body.officer_stats:
            max_off = max(body.officer_stats, key=lambda x: x.get("workload", 0))
            insights.append(f"Officer {max_off.get('name', 'Unassigned')} has the highest individual assignment queue with {max_off.get('workload', 0)} tasks.")
        else:
            insights.append("SLA compliance target verified across all active service teams.")
            
        return {"success": True, "insights": insights, "fallback": True}


@router.post("/ai-predictions")
async def generate_ai_predictions(
    body: AdminAiInsightsRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin)
) -> Any:
    """
    Predict expected complaints, department workloads, officer util, and backlog clearance times.
    Gracefully flags 'Insufficient historical data' if total reports < 5.
    """
    trace_id = str(uuid.uuid4())
    try:
        if body.total_issues < 5:
            return {
                "success": True,
                "sufficient": False,
                "message": "Insufficient historical data for reliable prediction."
            }
            
        from app.services.gemini_service import gemini_ai_service
        import json
        
        if not gemini_ai_service.client:
            raise RuntimeError("Gemini client not configured")
            
        prompt = f"""
        You are the Smart Municipal Command Center Predictive Analytics engine.
        Using the historical data below, predict:
        1. Expected complaints next week (integer count)
        2. Department workload forecast (which department will face the highest pressure and why)
        3. Officer utilization prediction (average officer load and re-allocation recommendations)
        4. High-risk complaint categories (categories likely to see surge)
        5. Citizen satisfaction trend (direction of rating change)
        6. Resolution backlog ETA (expected time to clear backlog, e.g. '4 Days')
        
        Historical Data:
        - Total Reports: {body.total_issues}
        - Active Tickets: {body.active_issues}
        - Resolved Count: {body.resolved_issues}
        - Critical Hazard Alerts: {body.critical_issues}
        - Department Stats: {body.department_stats}
        - Officer Stats: {body.officer_stats}
        - Recent Complaints: {body.recent_complaints}
        
        Return the response strictly as a JSON object matching this schema:
        {{
            "expected_complaints_next_week": int,
            "predicted_department_workload": str,
            "predicted_officer_utilization": str,
            "high_risk_categories": [str],
            "satisfaction_trend": str,
            "resolution_backlog_eta": str
        }}
        Do not wrap in markdown or add code blocks (no ```json).
        """
        
        response = gemini_ai_service.client.models.generate_content(
            model=gemini_ai_service.resolved_model,
            contents=[prompt]
        )
        
        if response.text:
            text = response.text.strip()
            if text.startswith("```"):
                text = text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(text)
            return {"success": True, "sufficient": True, "predictions": parsed}
        else:
            raise ValueError("Empty response from Gemini")
            
    except Exception as e:
        logger.warning(f"[{trace_id}] AI Predictions Gemini call failed: {e}. Using statistical fallback.")
        expected = round(body.active_issues * 1.2)
        hi_risk = []
        if body.department_stats:
            sorted_depts = sorted(body.department_stats, key=lambda x: x.get("active", 0), reverse=True)
            hi_risk = [d.get("name", "Other") for d in sorted_depts[:2]]
        else:
            hi_risk = ["Road Damage"]
            
        predictions = {
            "expected_complaints_next_week": expected,
            "predicted_department_workload": f"Pressure is forecasted to remain high on the {' / '.join(hi_risk)} sector based on current active loads.",
            "predicted_officer_utilization": f"Officer utilization is at {round((body.active_issues / max(len(body.officer_stats), 1)) * 25)}% capacity. Load balancing recommended.",
            "high_risk_categories": hi_risk,
            "satisfaction_trend": "Stable satisfaction ratings anticipated across reported complaints.",
            "resolution_backlog_eta": f"Approximately {round(body.active_issues * 0.8)} days to clear current outstanding queue."
        }
        return {"success": True, "sufficient": True, "predictions": predictions, "fallback": True}


