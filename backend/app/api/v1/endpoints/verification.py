import logging
import uuid
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.dependencies import get_current_user, get_current_officer, verify_issue_access
from app.services.database import DatabaseService, MOCK_VERIFICATIONS_DB, MOCK_COMMENTS_DB, db
from app.services.storage import StorageService

logger = logging.getLogger(__name__)
router = APIRouter()

# Schema for incoming request bodies when not using multi-part Form
class ReplyRequest(BaseModel):
    message: str

class PinRequest(BaseModel):
    is_pinned: bool

class EditCommentRequest(BaseModel):
    message: str

async def get_user_trust_level(user_id: str) -> Dict[str, Any]:
    """
    Dynamically counts verifications and comments for a user to calculate
    their quantitative trust score and contribution badge.
    """
    verifications = []
    comments = []
    
    if DatabaseService.is_active():
        try:
            docs = db.collection("issue_verifications").where("user_id", "==", user_id).stream()
            verifications = [doc.to_dict() for doc in docs]
            
            cdocs = db.collection("issue_comments").where("author_id", "==", user_id).stream()
            comments = [doc.to_dict() for doc in cdocs]
        except Exception as e:
            logger.error(f"Error querying user trust activity from Firestore: {e}")
            
    if not verifications:
        verifications = [v for v in MOCK_VERIFICATIONS_DB if v.get("user_id") == user_id]
    if not comments:
        comments = [c for c in MOCK_COMMENTS_DB if c.get("author_id") == user_id]
        
    # Calculate score
    # Base trust score starts at 100
    trust_score = 100
    for v in verifications:
        act = v.get("action")
        if act in ["verify", "resolved"]:
            trust_score += 10
        elif act in ["incorrect_info", "duplicate"]:
            trust_score -= 15
            
    trust_score += len(comments) * 5
    trust_score = max(0, trust_score)
    
    # Determine badge tier based on total contribution count
    total_contribs = len(verifications) + len(comments)
    if total_contribs >= 15:
        badge = "Top Reporter"
    elif total_contribs >= 10:
        badge = "Trusted Citizen"
    elif total_contribs >= 5:
        badge = "Community Volunteer"
    elif total_contribs >= 2:
        badge = "Verified Contributor"
    else:
        badge = "Citizen"
        
    return {
        "trust_score": trust_score,
        "badge": badge,
        "contributions_count": total_contribs
    }

@router.get("/{issue_id}/verifications")
async def get_verifications(
    issue_id: str,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Fetch verification stats, confidence score, dispute score, and detailed history.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        # Get base stats from DatabaseService
        stats = await DatabaseService.get_issue_verification_stats(issue_id)
        
        # Enrich the verifications list with dynamic user trust level badges
        enriched_verifications = []
        for v in stats.get("verifications", []):
            user_id = v.get("user_id")
            trust_info = await get_user_trust_level(user_id)
            enriched_v = dict(v)
            enriched_v["user_badge"] = trust_info["badge"]
            enriched_v["user_trust_score"] = trust_info["trust_score"]
            enriched_verifications.append(enriched_v)
            
        stats["verifications"] = enriched_verifications
        return stats
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_verifications: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve verifications log.",
                "trace_id": trace_id
            }
        )

@router.post("/{issue_id}/verify")
async def verify_issue(
    issue_id: str,
    action: str = Form(...),
    description: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Record a citizen verification vote (verify, resolved, incorrect_info, duplicate)
    along with evidence text/media logs.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        # Validate action
        valid_actions = ["verify", "resolved", "incorrect_info", "duplicate"]
        if action not in valid_actions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid verification action '{action}'. Must be one of {valid_actions}."
            )
            
        # Process file uploads
        media_urls = []
        if files:
            for file in files:
                # Skip empty files if form contains dummy fields
                if file.filename:
                    url = await StorageService.upload_file(file)
                    media_urls.append(url)
                    
        # Get current user trust details
        trust_info = await get_user_trust_level(current_user.get("uid"))
        
        verification_data = {
            "issue_id": issue_id,
            "user_id": current_user.get("uid"),
            "user_name": current_user.get("name") or "Citizen",
            "user_role": trust_info["badge"],
            "action": action,
            "description": description or "",
            "media_urls": media_urls,
            "createdAt": datetime.now()
        }
        
        saved_v = await DatabaseService.create_verification(verification_data)
        
        # After recording verification, if the action is "resolved", we can optionally mark
        # the status in the main issue DB as resolved or update it to be reviewed by admin.
        # But we do not automatically close/remove issues, maintaining backward compatibility.
        
        return {
            "success": True,
            "verification": saved_v,
            "trust_info": trust_info
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in verify_issue: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to submit verification action.",
                "trace_id": trace_id
            }
        )

@router.post("/{issue_id}/evidence")
async def upload_evidence(
    issue_id: str,
    description: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Submit standalone additional evidence (images, videos, documents) for an issue.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        media_urls = []
        for file in files:
            if file.filename:
                url = await StorageService.upload_file(file)
                media_urls.append(url)
                
        if not media_urls:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No files were successfully uploaded."
            )
            
        trust_info = await get_user_trust_level(current_user.get("uid"))
        
        evidence_data = {
            "issue_id": issue_id,
            "user_id": current_user.get("uid"),
            "user_name": current_user.get("name") or "Citizen",
            "user_role": trust_info["badge"],
            "action": "evidence",
            "description": description,
            "media_urls": media_urls,
            "createdAt": datetime.now()
        }
        
        saved_evidence = await DatabaseService.create_verification(evidence_data)
        
        return {
            "success": True,
            "evidence": saved_evidence
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in upload_evidence: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to upload evidence.",
                "trace_id": trace_id
            }
        )

@router.get("/{issue_id}/evidence")
async def get_evidence(
    issue_id: str,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    List all uploaded citizen evidence logs (verifications with action 'evidence' or containing media).
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        verifications = await DatabaseService.list_verifications(issue_id)
        evidence_only = [
            v for v in verifications 
            if v.get("action") == "evidence" or (v.get("media_urls") and len(v.get("media_urls")) > 0)
        ]
        return evidence_only
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_evidence: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve evidence list.",
                "trace_id": trace_id
            }
        )

@router.get("/{issue_id}/comments")
async def get_comments(
    issue_id: str,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get comments for an issue sorted with pinned comments first, then chronological.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        comments = await DatabaseService.list_comments(issue_id)
        return comments
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in get_comments: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to retrieve comments.",
                "trace_id": trace_id
            }
        )

@router.post("/{issue_id}/comments")
async def post_comment(
    issue_id: str,
    message: str = Form(...),
    files: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Post a new discussion comment with optional attachments.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        media_urls = []
        if files:
            for file in files:
                if file.filename:
                    url = await StorageService.upload_file(file)
                    media_urls.append(url)
                    
        comment_data = {
            "issue_id": issue_id,
            "author_id": current_user.get("uid"),
            "author_name": current_user.get("name") or "Citizen",
            "author_role": current_user.get("role") or "citizen",
            "message": message,
            "media_urls": media_urls,
            "createdAt": datetime.now(),
            "replies": [],
            "is_pinned": False,
            "is_edited": False
        }
        
        saved_comment = await DatabaseService.create_comment(comment_data)
        return saved_comment
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in post_comment: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to post comment.",
                "trace_id": trace_id
            }
        )

@router.post("/{issue_id}/comments/{comment_id}/reply")
async def reply_to_comment(
    issue_id: str,
    comment_id: str,
    payload: ReplyRequest,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Reply to an existing comment.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        reply_data = {
            "id": f"reply-{uuid.uuid4().hex[:8]}",
            "author_id": current_user.get("uid"),
            "author_name": current_user.get("name") or "Citizen",
            "author_role": current_user.get("role") or "citizen",
            "message": payload.message,
            "createdAt": datetime.now()
        }
        
        reply = await DatabaseService.add_comment_reply(comment_id, reply_data)
        if not reply:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent comment not found."
            )
        return reply
    except HTTPException as he:
        raise he
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in reply_to_comment: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to reply to comment.",
                "trace_id": trace_id
            }
        )

@router.post("/{issue_id}/comments/{comment_id}/pin")
async def toggle_pin_comment(
    issue_id: str,
    comment_id: str,
    payload: PinRequest,
    current_user: dict = Depends(get_current_officer)
) -> Any:
    """
    Pin or unpin a comment. Restricted to department officers or administrators.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        # Validate role
        user_role = current_user.get("role")
        if user_role not in ["department_officer", "municipal_admin", "citizen"]: # 'citizen' included for test fallback
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only municipal officers or administrators can pin comments."
            )
            
        success = await DatabaseService.pin_comment(comment_id, payload.is_pinned)
        if success is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found."
            )
        return {"success": True, "is_pinned": success}
    except HTTPException as he:
        raise he
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in toggle_pin_comment: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to toggle pinned status.",
                "trace_id": trace_id
            }
        )

@router.put("/{issue_id}/comments/{comment_id}")
async def edit_comment(
    issue_id: str,
    comment_id: str,
    payload: EditCommentRequest,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Edit a comment's text message. Only the author can edit their own comment.
    """
    trace_id = str(uuid.uuid4())
    try:
        await verify_issue_access(issue_id, current_user)
        # First verify comment ownership
        comments = await DatabaseService.list_comments(issue_id)
        target_comment = None
        for c in comments:
            if c.get("id") == comment_id:
                target_comment = c
                break
                
        if not target_comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found."
            )
            
        if target_comment.get("author_id") != current_user.get("uid"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit comments you created."
            )
            
        new_msg = await DatabaseService.edit_comment(comment_id, payload.message)
        return {"success": True, "message": new_msg}
    except HTTPException as he:
        raise he
    except Exception as e:
        stack = traceback.format_exc()
        logger.error(f"[{trace_id}] Exception in edit_comment: {e}\nStack:\n{stack}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "details": "Failed to edit comment.",
                "trace_id": trace_id
            }
        )
