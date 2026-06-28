import logging
from datetime import datetime
from typing import Any, Dict, Optional

from google.api_core.exceptions import GoogleAPICallError, ResourceExhausted

logger = logging.getLogger(__name__)

from fastapi import Depends, HTTPException, Security, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as admin_auth
from app.core.firebase import firebase_app, db

reusable_oauth2 = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    token: Optional[HTTPAuthorizationCredentials] = Security(reusable_oauth2),
) -> Dict[str, Any]:
    """
    Get the currently authenticated user from Firebase Auth ID Token or custom headers.
    Returns a mock user for boilerplate testing if no token is provided.
    """
    # 1. Real Firebase Token Verification (when configured and token is present)
    if token and firebase_app:
        # ── Step 1: Verify the Firebase ID token (failure here is a real 401) ──
        try:
            id_token = token.credentials
            decoded_token = admin_auth.verify_id_token(id_token)
        except Exception as e:
            logger.warning("[Auth] Token verification failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Could not validate credentials: {str(e)}",
            )

        uid = decoded_token["uid"]
        email = decoded_token.get("email")
        name = decoded_token.get("name", "Google User")
        role = "citizen"
        department = None

        # ── Step 2: Fetch profile from Firestore (failure here is NOT a 401) ──
        if db:
            try:
                user_doc_ref = db.collection("users").document(uid)
                user_doc = user_doc_ref.get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    role = user_data.get("role", "citizen")
                    department = user_data.get("department")
                    name = user_data.get("fullName", name)
                else:
                    # Automatically provision a Firestore skeleton user doc
                    user_data = {
                        "uid": uid,
                        "fullName": name,
                        "email": email,
                        "role": "citizen",
                        "city": "Ahmedabad",
                        "status": "Active",
                        "isVerified": decoded_token.get("email_verified", False),
                        "createdAt": datetime.utcnow(),
                        "lastLogin": datetime.utcnow(),
                        "notificationPreferences": {"email": True, "push": True},
                        "theme": "dark",
                        "language": "en"
                    }
                    try:
                        user_doc_ref.set(user_data)
                    except GoogleAPICallError as write_err:
                        # Log but don't block — user is still authenticated
                        logger.warning(
                            "[Auth] Could not provision Firestore user doc for uid=%s: %s",
                            uid, write_err
                        )
            except (ResourceExhausted, GoogleAPICallError) as fs_err:
                # Firestore quota/infra error — log and degrade gracefully.
                # The Firebase token is valid; don't convert this into a 401.
                logger.error(
                    "[Auth] Firestore unavailable for uid=%s (role defaults to 'citizen'): %s",
                    uid, fs_err
                )
            except Exception as fs_err:
                # Any other unexpected Firestore error — same graceful degradation.
                logger.error(
                    "[Auth] Unexpected Firestore error for uid=%s: %s",
                    uid, fs_err
                )

        return {
            "uid": uid,
            "name": name,
            "email": email,
            "role": role,
            "department": department
        }

    # 2. Mock Fallback (when Firebase is offline/not configured, or headers are present)
    x_role = request.headers.get("x-user-role")
    x_uid = request.headers.get("x-user-uid")
    x_name = request.headers.get("x-user-name")
    x_dept = request.headers.get("x-user-department")

    if x_role or x_uid:
        return {
            "uid": x_uid or "mock-citizen-uid",
            "name": x_name or f"Mock {x_role.replace('_', ' ').title() if x_role else 'User'}",
            "email": f"{x_role or 'citizen'}@communityhero.org",
            "role": x_role or "citizen",
            "department": x_dept
        }

    # Boilerplate mock user fallback
    return {
        "uid": "mock-citizen-uid",
        "name": "Mock Citizen",
        "email": "citizen@communityhero.org",
        "role": "citizen",
    }



async def get_current_officer(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Dependency to restrict endpoint access to department/municipal officers.
    """
    if current_user.get("role") not in [
        "department_officer",
        "municipal_admin",
        "administrator",
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have department officer privileges",
        )
    return current_user


async def get_current_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Dependency to restrict endpoint access to administrators.
    """
    if current_user.get("role") not in ["municipal_admin", "administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have administrator privileges",
        )
    return current_user


async def verify_issue_access(issue_id: str, current_user: dict) -> dict:
    """
    Verifies that the current user has access to the specified issue based on their role.
    - Admin: Full access.
    - Officer: Access if issue department matches their department, or if assigned to them.
    - Citizen: Access only if they own the issue (ownerUid or citizenId matches their uid).
    """
    from app.services.database import DatabaseService
    issue = await DatabaseService.get_issue(issue_id)
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue with ID '{issue_id}' not found."
        )
        
    role = current_user.get("role", "citizen")
    uid = current_user.get("uid")
    
    if role in ["administrator", "municipal_admin"]:
        return issue
        
    if role == "department_officer":
        issue_dept = issue.get("department")
        user_dept = current_user.get("department")
        assigned_officer_id = issue.get("officer_id")
        
        dept_match = issue_dept and user_dept and issue_dept.lower() == user_dept.lower()
        officer_match = assigned_officer_id == uid
        
        if not (dept_match or officer_match):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Officers can only access issues assigned to their department or themselves."
            )
        return issue
        
    # Default: citizen role
    owner_uid = issue.get("ownerUid") or issue.get("citizenId")
    if owner_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Citizens can only access their own issues."
        )
    return issue

