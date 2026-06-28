import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from firebase_admin import firestore
from app.core.firebase import db

logger = logging.getLogger(__name__)

# Fallback In-Memory Database for local development when Firebase is not connected
MOCK_ISSUES_DB: List[Dict[str, Any]] = [
    {
        "id": "issue-1",
        "citizenId": "mock-citizen-uid",
        "title": "Major Pothole on Main Road",
        "description": (
            "A very large pothole that is forcing cars "
            "to swerve into oncoming traffic."
        ),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "address": "Navrangpura, Ahmedabad, Gujarat, India",
        "category": "pothole",
        "severity": "high",
        "priorityScore": 78,
        "status": "reported",
        "upvotesCount": 5,
        "createdAt": datetime.now(),
        "publicImageUrl": (
            "https://placehold.co/600x400/orange/white?text=Pothole+Example"
        ),
    },
    {
        "id": "issue-2",
        "citizenId": "mock-citizen-uid-2",
        "title": "Damaged Streetlight near Park",
        "description": (
            "The streetlight has been flickering constantly "
            "and went dark last night. Public safety hazard."
        ),
        "latitude": 23.03,
        "longitude": 72.58,
        "address": "Vastrapur, Ahmedabad, Gujarat, India",
        "category": "damaged_streetlight",
        "severity": "medium",
        "priorityScore": 52,
        "status": "in_progress",
        "upvotesCount": 12,
        "createdAt": datetime.now(),
        "publicImageUrl": (
            "https://placehold.co/600x400/indigo/white?text=Streetlight+Example"
        ),
    },
]

MOCK_VERIFICATIONS_DB: List[Dict[str, Any]] = []
MOCK_COMMENTS_DB: List[Dict[str, Any]] = []
MOCK_STATUS_HISTORY_DB: List[Dict[str, Any]] = []
MOCK_NOTIFICATIONS_DB: List[Dict[str, Any]] = []
MOCK_ADMIN_ACTIVITY_DB: List[Dict[str, Any]] = []

MOCK_DEPARTMENTS_DB: List[Dict[str, Any]] = [
    {"id": "roads", "name": "Roads Department", "officers_count": 2, "resolved_count": 12, "pending_count": 5},
    {"id": "sanitation", "name": "Sanitation", "officers_count": 2, "resolved_count": 8, "pending_count": 3},
    {"id": "electrical", "name": "Electrical", "officers_count": 1, "resolved_count": 15, "pending_count": 2},
    {"id": "water", "name": "Water Department", "officers_count": 2, "resolved_count": 10, "pending_count": 4},
    {"id": "sewer", "name": "Sewer Department", "officers_count": 1, "resolved_count": 6, "pending_count": 3},
    {"id": "garden", "name": "Garden Department", "officers_count": 1, "resolved_count": 4, "pending_count": 1},
    {"id": "civil", "name": "Civil Department", "officers_count": 2, "resolved_count": 7, "pending_count": 3},
]

MOCK_OFFICERS_DB: List[Dict[str, Any]] = [
    {
        "id": "officer-roads-1",
        "name": "Officer Rajesh Kumar",
        "department": "roads",
        "phone": "+91 98765 43210",
        "email": "rajesh.roads@hero.gov.in",
        "availability": "available",
        "current_workload": 2,
        "assigned_issues": ["issue-1"],
        "completed_issues": 15,
        "average_resolution_time": 2.4,
        "performance_score": 92
    },
    {
        "id": "officer-roads-2",
        "name": "Officer Amit Patel",
        "department": "roads",
        "phone": "+91 98765 43211",
        "email": "amit.roads@hero.gov.in",
        "availability": "busy",
        "current_workload": 4,
        "assigned_issues": [],
        "completed_issues": 10,
        "average_resolution_time": 3.1,
        "performance_score": 85
    },
    {
        "id": "officer-sanitation-1",
        "name": "Officer Sunita Sharma",
        "department": "sanitation",
        "phone": "+91 98765 43212",
        "email": "sunita.san@hero.gov.in",
        "availability": "available",
        "current_workload": 1,
        "assigned_issues": [],
        "completed_issues": 22,
        "average_resolution_time": 1.2,
        "performance_score": 96
    },
    {
        "id": "officer-elec-1",
        "name": "Officer Vijay Mehta",
        "department": "electrical",
        "phone": "+91 98765 43213",
        "email": "vijay.elec@hero.gov.in",
        "availability": "available",
        "current_workload": 1,
        "assigned_issues": ["issue-2"],
        "completed_issues": 30,
        "average_resolution_time": 1.8,
        "performance_score": 94
    },
    {
        "id": "officer-water-1",
        "name": "Officer Sanjay Rao",
        "department": "water",
        "phone": "+91 98765 43214",
        "email": "sanjay.water@hero.gov.in",
        "availability": "available",
        "current_workload": 2,
        "assigned_issues": [],
        "completed_issues": 18,
        "average_resolution_time": 2.1,
        "performance_score": 89
    }
]


def map_category_to_department(category: str) -> str:
    cat = (category or "").lower().replace("_", " ").replace("-", " ")
    if "pothole" in cat or "road" in cat:
        return "roads"
    elif "garbage" in cat or "dumping" in cat or "sanit" in cat:
        return "sanitation"
    elif "light" in cat or "electrical" in cat or "electric" in cat:
        return "electrical"
    elif "water" in cat:
        return "water"
    elif "drain" in cat or "sewer" in cat:
        return "sewer"
    elif "tree" in cat or "garden" in cat or "vegetation" in cat:
        return "garden"
    elif "building" in cat or "civil" in cat or "structure" in cat or "infrastructure" in cat:
        return "civil"
    return "roads" # default fallback


class DatabaseService:
    """
    Handles queries and writes to Firestore.
    Automatically falls back to in-memory operations if Firestore is not initialized.
    """

    @staticmethod
    def is_active() -> bool:
        return db is not None

    @staticmethod
    async def create_issue(issue_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new issue report in Firestore or Fallback DB.
        """
        issue_id = issue_data.get("id")
        if not issue_id:
            import uuid

            issue_id = f"issue-{uuid.uuid4().hex[:8]}"
            issue_data["id"] = issue_id

        if not issue_data.get("createdAt"):
            issue_data["createdAt"] = datetime.now()

        # Automatic department assignment based on category
        if "category" in issue_data and not issue_data.get("department"):
            issue_data["department"] = map_category_to_department(issue_data["category"])

        # Default dashboard status values
        issue_data["officer_id"] = issue_data.get("officer_id") or ""
        issue_data["officer_name"] = issue_data.get("officer_name") or ""
        issue_data["citizen_verified"] = issue_data.get("citizen_verified") or False

        # Automatic timeline entries
        status_history_entries = []
        
        # 1. Reported
        status_history_entries.append({
            "issue_id": issue_id,
            "status": "reported",
            "progress_percentage": 10,
            "updated_by": issue_data.get("ownerName", "Citizen"),
            "notes": "Issue reported by citizen.",
            "timestamp": datetime.now()
        })
        
        if issue_data.get("aiAnalysis"):
            # 2. AI Analysis Completed
            status_history_entries.append({
                "issue_id": issue_id,
                "status": "ai_analysis_completed",
                "progress_percentage": 20,
                "updated_by": "Gemini AI",
                "notes": f"AI categorised issue as {issue_data.get('category')} with confidence {round((issue_data.get('aiConfidence') or 0)*100)}%.",
                "timestamp": datetime.now()
            })
            
            # 3. Pending Administrator Review
            status_history_entries.append({
                "issue_id": issue_id,
                "status": "pending_administrator_review",
                "progress_percentage": 25,
                "updated_by": "System",
                "notes": "Awaiting administrator review and assignment.",
                "timestamp": datetime.now()
            })
            
            # Update current status
            issue_data["status"] = "pending_administrator_review"
            issue_data["progress_percentage"] = 25
        else:
            issue_data["status"] = "reported"
            issue_data["progress_percentage"] = 10

        if DatabaseService.is_active():
            try:
                # Write to Firestore collection 'issues'
                db.collection("issues").document(issue_id).set(issue_data)
                logger.info(f"Successfully saved issue {issue_id} to Firestore.")
                for entry in status_history_entries:
                    db.collection("issue_status_history").document(entry["id"] if "id" in entry else f"hist-{uuid.uuid4().hex[:8]}").set(entry)
                return issue_data
            except Exception as e:
                logger.error(f"Error saving to Firestore: {e}. Falling back to memory.")

        # Local fallback write
        MOCK_ISSUES_DB.append(issue_data)
        for entry in status_history_entries:
            if "id" not in entry:
                entry["id"] = f"hist-{uuid.uuid4().hex[:8]}"
            MOCK_STATUS_HISTORY_DB.append(entry)
        logger.info(f"Successfully saved issue {issue_id} to fallback in-memory DB.")
        return issue_data

    @staticmethod
    async def get_issue(issue_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a single issue report by ID.
        """
        if DatabaseService.is_active():
            try:
                doc = db.collection("issues").document(issue_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    return data
            except Exception as e:
                logger.error(f"Error reading from Firestore: {e}. Checking fallback.")

        # Local fallback lookup
        for issue in MOCK_ISSUES_DB:
            if issue["id"] == issue_id:
                return issue
        return None

    @staticmethod
    async def list_issues(
        category: Optional[str] = None,
        status: Optional[str] = None,
        department: Optional[str] = None,
        officer_id: Optional[str] = None,
        priority: Optional[str] = None,
        city: Optional[str] = None,
        date_str: Optional[str] = None,
        severity: Optional[str] = None,
        owner_uid: Optional[str] = None,
        officer_dept: Optional[str] = None,
        officer_user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lists all issues, with comprehensive Python filtering for Firestore stability.
        """
        issues = []
        if DatabaseService.is_active():
            try:
                if owner_uid:
                    docs = db.collection("issues").where("ownerUid", "==", owner_uid).stream()
                    for doc in docs:
                        issues.append(doc.to_dict())
                elif officer_dept or officer_user_id:
                    issues_map = {}
                    if officer_dept:
                        q1 = db.collection("issues").where("department", "==", officer_dept)
                        for doc in q1.stream():
                            d = doc.to_dict()
                            issues_map[d["id"]] = d
                    if officer_user_id:
                        q2 = db.collection("issues").where("officer_id", "==", officer_user_id)
                        for doc in q2.stream():
                            d = doc.to_dict()
                            issues_map[d["id"]] = d
                    issues = list(issues_map.values())
                else:
                    docs = db.collection("issues").stream()
                    for doc in docs:
                        issues.append(doc.to_dict())
            except Exception as e:
                logger.error(
                    f"Error fetching list from Firestore: {e}. Using fallback."
                )
                issues = list(MOCK_ISSUES_DB)
        else:
            issues = list(MOCK_ISSUES_DB)

        # Apply filters in Python to avoid Firestore composite index failures
        filtered_issues = []
        for issue in issues:
            # Enforce owner/role isolation filters
            if owner_uid and issue.get("ownerUid") != owner_uid:
                continue
            if officer_dept or officer_user_id:
                matches_dept = officer_dept and issue.get("department", "").lower() == officer_dept.lower()
                matches_officer = officer_user_id and issue.get("officer_id") == officer_user_id
                if not (matches_dept or matches_officer):
                    continue

            if category and issue.get("category", "").lower() != category.lower():
                continue
            if status and issue.get("status", "").lower() != status.lower():
                continue
            if department and issue.get("department", "").lower() != department.lower():
                continue
            if officer_id and issue.get("officer_id", "") != officer_id:
                continue
            if priority and issue.get("priority", "").lower() != priority.lower():
                continue
            if severity and issue.get("severity", "").lower() != severity.lower():
                continue
            if city:
                issue_city = issue.get("city") or issue.get("address") or ""
                if city.lower() not in issue_city.lower():
                    continue
            if date_str:
                created_at = issue.get("createdAt")
                if isinstance(created_at, datetime):
                    issue_date = created_at.strftime("%Y-%m-%d")
                elif isinstance(created_at, str):
                    issue_date = created_at[:10]
                else:
                    issue_date = ""
                if issue_date != date_str:
                    continue
            filtered_issues.append(issue)

        def get_created_at_dt(x):
            val = x.get("createdAt")
            if isinstance(val, datetime):
                return val
            if isinstance(val, str):
                try:
                    return datetime.fromisoformat(val.replace("Z", "+00:00"))
                except ValueError:
                    pass
            return datetime.min

        return sorted(filtered_issues, key=get_created_at_dt, reverse=True)

    @staticmethod
    async def upvote_issue(issue_id: str) -> Optional[int]:
        """
        Increments the upvote count of a specific issue.
        Uses a transactional update.
        """
        if DatabaseService.is_active():
            try:
                transaction = db.transaction()
                
                @firestore.transactional
                def update_in_transaction(transaction, doc_ref):
                    snapshot = doc_ref.get(transaction=transaction)
                    if not snapshot.exists:
                        return None
                    current_upvotes = snapshot.get("upvotesCount") or 0
                    new_upvotes = current_upvotes + 1
                    transaction.update(doc_ref, {"upvotesCount": new_upvotes})
                    return new_upvotes
                    
                doc_ref = db.collection("issues").document(issue_id)
                res = update_in_transaction(transaction, doc_ref)
                if res is not None:
                    return res
            except Exception as e:
                logger.error(f"Error upvoting in Firestore transaction: {e}. Using fallback.")

        # Local fallback upvote
        for issue in MOCK_ISSUES_DB:
            if issue["id"] == issue_id:
                issue["upvotesCount"] += 1
                return issue["upvotesCount"]
        return None

    @staticmethod
    async def update_issue_status(issue_id: str, status: str) -> Optional[str]:
        """
        Updates the status of an issue (reported, assigned, in_progress, resolved).
        """
        if DatabaseService.is_active():
            try:
                doc_ref = db.collection("issues").document(issue_id)
                doc_ref.update({"status": status, "updatedAt": datetime.now()})
                return status
            except Exception as e:
                logger.error(
                    f"Error updating status in Firestore: {e}. Using fallback."
                )

        # Local fallback update
        for issue in MOCK_ISSUES_DB:
            if issue["id"] == issue_id:
                issue["status"] = status
                issue["updatedAt"] = datetime.now()
                return status
        return None

    @staticmethod
    async def create_verification(verification_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new verification log entry.
        Updates issue confidence, verification_count, and dispute_count inside a transaction.
        """
        verification_id = verification_data.get("id")
        if not verification_id:
            import uuid
            verification_id = f"verif-{uuid.uuid4().hex[:8]}"
            verification_data["id"] = verification_id
            
        if not verification_data.get("createdAt"):
            verification_data["createdAt"] = datetime.now()
            
        issue_id = verification_data.get("issue_id")
            
        if DatabaseService.is_active():
            try:
                transaction = db.transaction()
                
                @firestore.transactional
                def run_verification_transaction(transaction, issue_ref, verif_ref):
                    # Write verification document
                    transaction.set(verif_ref, verification_data)
                    
                    # Fetch all verifications to compute new statistics
                    verifs_query = db.collection("issue_verifications").where("issue_id", "==", issue_id)
                    docs = verifs_query.stream()
                    verifs = [doc.to_dict() for doc in docs]
                    
                    # Also include the new verification if it wasn't captured in stream
                    if not any(v.get("id") == verification_id for v in verifs):
                        verifs.append(verification_data)
                        
                    # Calculate stats
                    issue_snap = issue_ref.get(transaction=transaction)
                    if not issue_snap.exists:
                        return
                    issue_d = issue_snap.to_dict()
                    ai_conf = issue_d.get("confidence", 0.90)
                    if not isinstance(ai_conf, (int, float)):
                        ai_conf = 0.90
                    base_confidence = ai_conf * 100.0
                    
                    verification_count = 0
                    dispute_count = 0
                    confidence = base_confidence
                    
                    trust_multipliers = {
                        "citizen": 1.0,
                        "verified contributor": 1.2,
                        "community volunteer": 1.5,
                        "trusted citizen": 1.8,
                        "top reporter": 2.0
                    }
                    
                    for v in verifs:
                        action = v.get("action")
                        user_badge = (v.get("user_role") or "citizen").lower()
                        multiplier = trust_multipliers.get(user_badge, 1.0)
                        
                        if action in ["verify", "resolved"]:
                            verification_count += 1
                            confidence += 5 * multiplier
                        elif action in ["incorrect_info", "duplicate"]:
                            dispute_count += 1
                            confidence -= 15 * multiplier
                            
                    confidence = max(0.0, min(100.0, confidence))
                    
                    # Update issue statistics
                    transaction.update(issue_ref, {
                        "verificationCount": verification_count,
                        "disputeCount": dispute_count,
                        "confidenceScore": round(confidence, 1)
                    })
                    
                issue_ref = db.collection("issues").document(issue_id)
                verif_ref = db.collection("issue_verifications").document(verification_id)
                
                run_verification_transaction(transaction, issue_ref, verif_ref)
                logger.info(f"Successfully saved verification {verification_id} in Firestore transaction.")
                return verification_data
            except Exception as e:
                logger.error(f"Error saving verification in Firestore transaction: {e}. Falling back to memory.")
                
        # Local fallback persistence
        MOCK_VERIFICATIONS_DB.append(verification_data)
        issue = next((i for i in MOCK_ISSUES_DB if i["id"] == issue_id), None)
        if issue:
            verifs = [v for v in MOCK_VERIFICATIONS_DB if v.get("issue_id") == issue_id]
            ai_conf = issue.get("confidence", 0.90)
            if not isinstance(ai_conf, (int, float)):
                ai_conf = 0.90
            base_confidence = ai_conf * 100.0
            
            verification_count = 0
            dispute_count = 0
            confidence = base_confidence
            
            trust_multipliers = {
                "citizen": 1.0,
                "verified contributor": 1.2,
                "community volunteer": 1.5,
                "trusted citizen": 1.8,
                "top reporter": 2.0
            }
            
            for v in verifs:
                action = v.get("action")
                user_badge = (v.get("user_role") or "citizen").lower()
                multiplier = trust_multipliers.get(user_badge, 1.0)
                
                if action in ["verify", "resolved"]:
                    verification_count += 1
                    confidence += 5 * multiplier
                elif action in ["incorrect_info", "duplicate"]:
                    dispute_count += 1
                    confidence -= 15 * multiplier
                    
            confidence = max(0.0, min(100.0, confidence))
            
            issue["verificationCount"] = verification_count
            issue["disputeCount"] = dispute_count
            issue["confidenceScore"] = round(confidence, 1)
            
        logger.info(f"Successfully saved verification {verification_id} to fallback DB.")
        return verification_data

    @staticmethod
    async def list_verifications(issue_id: str) -> List[Dict[str, Any]]:
        """
        Lists all verifications for a specific issue.
        """
        if DatabaseService.is_active():
            try:
                docs = db.collection("issue_verifications").where("issue_id", "==", issue_id).stream()
                verifs = []
                for doc in docs:
                    verifs.append(doc.to_dict())
                return sorted(verifs, key=lambda x: x.get("createdAt"), reverse=True)
            except Exception as e:
                logger.error(f"Error listing verifications from Firestore: {e}. Using fallback.")
                
        results = [v for v in MOCK_VERIFICATIONS_DB if v.get("issue_id") == issue_id]
        return sorted(results, key=lambda x: x.get("createdAt"), reverse=True)

    @staticmethod
    async def get_issue_verification_stats(issue_id: str) -> Dict[str, Any]:
        """
        Dynamically calculates community confidence score, verification count,
        and dispute count for a given issue.
        """
        issue = await DatabaseService.get_issue(issue_id)
        if not issue:
            return {
                "confidence_score": 0.0,
                "verification_count": 0,
                "dispute_count": 0,
                "verifications": []
            }
            
        ai_conf = issue.get("confidence", 0.90)
        if not isinstance(ai_conf, (int, float)):
            ai_conf = 0.90
        base_confidence = ai_conf * 100.0
        
        verifications = await DatabaseService.list_verifications(issue_id)
        
        verification_count = 0
        dispute_count = 0
        confidence = base_confidence
        
        trust_multipliers = {
            "citizen": 1.0,
            "verified contributor": 1.2,
            "community volunteer": 1.5,
            "trusted citizen": 1.8,
            "top reporter": 2.0
        }
        
        for v in verifications:
            action = v.get("action")
            user_badge = (v.get("user_role") or "citizen").lower()
            multiplier = trust_multipliers.get(user_badge, 1.0)
            
            if action in ["verify", "resolved"]:
                verification_count += 1
                confidence += 5 * multiplier
            elif action in ["incorrect_info", "duplicate"]:
                dispute_count += 1
                confidence -= 15 * multiplier
                
        confidence = max(0.0, min(100.0, confidence))
        
        return {
            "confidence_score": round(confidence, 1),
            "verification_count": verification_count,
            "dispute_count": dispute_count,
            "verifications": verifications
        }

    @staticmethod
    async def create_comment(comment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new comment on an issue.
        """
        comment_id = comment_data.get("id")
        if not comment_id:
            import uuid
            comment_id = f"comment-{uuid.uuid4().hex[:8]}"
            comment_data["id"] = comment_id
            
        if not comment_data.get("createdAt"):
            comment_data["createdAt"] = datetime.now()
            
        if not comment_data.get("replies"):
            comment_data["replies"] = []
            
        comment_data["is_pinned"] = comment_data.get("is_pinned", False)
        comment_data["is_edited"] = comment_data.get("is_edited", False)
            
        if DatabaseService.is_active():
            try:
                db.collection("issue_comments").document(comment_id).set(comment_data)
                logger.info(f"Successfully saved comment {comment_id} to Firestore.")
                return comment_data
            except Exception as e:
                logger.error(f"Error saving comment to Firestore: {e}. Falling back to memory.")
                
        MOCK_COMMENTS_DB.append(comment_data)
        logger.info(f"Successfully saved comment {comment_id} to fallback in-memory DB.")
        return comment_data

    @staticmethod
    async def list_comments(issue_id: str) -> List[Dict[str, Any]]:
        """
        Lists all comments for a specific issue.
        """
        if DatabaseService.is_active():
            try:
                docs = db.collection("issue_comments").where("issue_id", "==", issue_id).stream()
                comments = []
                for doc in docs:
                    comments.append(doc.to_dict())
                return sorted(comments, key=lambda x: (not x.get("is_pinned", False), x.get("createdAt")))
            except Exception as e:
                logger.error(f"Error listing comments from Firestore: {e}. Using fallback.")
                
        results = [c for c in MOCK_COMMENTS_DB if c.get("issue_id") == issue_id]
        return sorted(results, key=lambda x: (not x.get("is_pinned", False), x.get("createdAt")))

    @staticmethod
    async def add_comment_reply(comment_id: str, reply_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Appends a reply to a comment.
        """
        if not reply_data.get("id"):
            import uuid
            reply_data["id"] = f"reply-{uuid.uuid4().hex[:8]}"
        if not reply_data.get("createdAt"):
            reply_data["createdAt"] = datetime.now()

        if DatabaseService.is_active():
            try:
                doc_ref = db.collection("issue_comments").document(comment_id)
                doc = doc_ref.get()
                if doc.exists:
                    replies = doc.to_dict().get("replies", [])
                    replies.append(reply_data)
                    doc_ref.update({"replies": replies})
                    return reply_data
            except Exception as e:
                logger.error(f"Error adding reply in Firestore: {e}. Using fallback.")

        for comment in MOCK_COMMENTS_DB:
            if comment["id"] == comment_id:
                if "replies" not in comment:
                    comment["replies"] = []
                comment["replies"].append(reply_data)
                return reply_data
        return None

    @staticmethod
    async def pin_comment(comment_id: str, is_pinned: bool) -> Optional[bool]:
        """
        Pins or unpins a comment.
        """
        if DatabaseService.is_active():
            try:
                doc_ref = db.collection("issue_comments").document(comment_id)
                doc_ref.update({"is_pinned": is_pinned})
                return is_pinned
            except Exception as e:
                logger.error(f"Error pinning comment in Firestore: {e}. Using fallback.")

        for comment in MOCK_COMMENTS_DB:
            if comment["id"] == comment_id:
                comment["is_pinned"] = is_pinned
                return is_pinned
        return None

    @staticmethod
    async def edit_comment(comment_id: str, message: str) -> Optional[str]:
        """
        Edits a comment message.
        """
        if DatabaseService.is_active():
            try:
                doc_ref = db.collection("issue_comments").document(comment_id)
                doc_ref.update({"message": message, "is_edited": True, "updatedAt": datetime.now()})
                return message
            except Exception as e:
                logger.error(f"Error editing comment in Firestore: {e}. Using fallback.")

        for comment in MOCK_COMMENTS_DB:
            if comment["id"] == comment_id:
                comment["message"] = message
                comment["is_edited"] = True
                comment["updatedAt"] = datetime.now()
                return message
        return None

    @staticmethod
    async def create_status_history_entry(entry_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new status history timeline log.
        """
        entry_id = entry_data.get("id")
        if not entry_id:
            import uuid
            entry_id = f"hist-{uuid.uuid4().hex[:8]}"
            entry_data["id"] = entry_id
            
        if not entry_data.get("timestamp"):
            entry_data["timestamp"] = datetime.now()
            
        if DatabaseService.is_active():
            try:
                db.collection("issue_status_history").document(entry_id).set(entry_data)
                logger.info(f"Saved status history {entry_id} to Firestore.")
                return entry_data
            except Exception as e:
                logger.error(f"Error saving status history to Firestore: {e}. Falling back.")
                
        MOCK_STATUS_HISTORY_DB.append(entry_data)
        logger.info(f"Saved status history {entry_id} to fallback DB.")
        return entry_data

    @staticmethod
    async def list_status_history(issue_id: str) -> List[Dict[str, Any]]:
        """
        Lists all status history timeline logs for a specific issue.
        """
        if DatabaseService.is_active():
            try:
                docs = db.collection("issue_status_history").where("issue_id", "==", issue_id).stream()
                history = [doc.to_dict() for doc in docs]
                return sorted(history, key=lambda x: x.get("timestamp"))
            except Exception as e:
                logger.error(f"Error listing status history from Firestore: {e}. Falling back.")
                
        results = [h for h in MOCK_STATUS_HISTORY_DB if h.get("issue_id") == issue_id]
        return sorted(results, key=lambda x: x.get("timestamp"))

    @staticmethod
    async def create_notification(notif_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new notification flag.
        """
        notif_id = notif_data.get("id")
        if not notif_id:
            import uuid
            notif_id = f"notif-{uuid.uuid4().hex[:8]}"
            notif_data["id"] = notif_id
            
        if not notif_data.get("timestamp"):
            notif_data["timestamp"] = datetime.now()
            
        # Enrich notification with ownerUid and department from issue if present
        issue_id = notif_data.get("issue_id")
        if issue_id:
            issue = await DatabaseService.get_issue(issue_id)
            if issue:
                if "ownerUid" not in notif_data and issue.get("ownerUid"):
                    notif_data["ownerUid"] = issue.get("ownerUid")
                if "department" not in notif_data and issue.get("department"):
                    notif_data["department"] = issue.get("department")
            
        if DatabaseService.is_active():
            try:
                db.collection("issue_notifications").document(notif_id).set(notif_data)
                return notif_data
            except Exception as e:
                logger.error(f"Error saving notification to Firestore: {e}. Falling back.")
                
        MOCK_NOTIFICATIONS_DB.append(notif_data)
        return notif_data

    @staticmethod
    async def list_notifications(issue_id: str) -> List[Dict[str, Any]]:
        """
        Lists all notifications for a specific issue.
        """
        if DatabaseService.is_active():
            try:
                docs = db.collection("issue_notifications").where("issue_id", "==", issue_id).stream()
                notifs = [doc.to_dict() for doc in docs]
                return sorted(notifs, key=lambda x: x.get("timestamp"), reverse=True)
            except Exception as e:
                logger.error(f"Error listing notifications from Firestore: {e}. Falling back.")
                
        results = [n for n in MOCK_NOTIFICATIONS_DB if n.get("issue_id") == issue_id]
        return sorted(results, key=lambda x: x.get("timestamp"), reverse=True)

    @staticmethod
    async def update_issue_lifecycle(issue_id: str, lifecycle_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Updates the current status, progress, department, and resolution data of an issue.
        Automatically logs a status history entry and triggers notifications.
        """
        issue = await DatabaseService.get_issue(issue_id)
        if not issue:
            return None
            
        old_dept = issue.get("department")
        old_officer_id = issue.get("officer_id")
            
        status = lifecycle_data.get("status", issue.get("status"))
        department = lifecycle_data.get("department", issue.get("department"))
        progress_percentage = lifecycle_data.get("progress_percentage", issue.get("progress_percentage", 10))
        estimated_completion_date = lifecycle_data.get("estimated_completion_date", issue.get("estimated_completion_date"))
        updated_by = lifecycle_data.get("updated_by", "Officer")
        notes = lifecycle_data.get("notes", "")
        media_urls = lifecycle_data.get("media_urls", [])
        
        # Extended progressive fields
        technician_name = lifecycle_data.get("technician_name", issue.get("technician_name"))
        inspection_date = lifecycle_data.get("inspection_date", issue.get("inspection_date"))
        material_used = lifecycle_data.get("material_used", issue.get("material_used"))
        estimated_cost = lifecycle_data.get("estimated_cost", issue.get("estimated_cost"))
        citizen_verified = lifecycle_data.get("citizen_verified", issue.get("citizen_verified"))
        officer_id = lifecycle_data.get("officer_id", issue.get("officer_id"))
        officer_name = lifecycle_data.get("officer_name", issue.get("officer_name"))

        # Override and feedback fields
        category = lifecycle_data.get("category")
        priority = lifecycle_data.get("priority")
        severity = lifecycle_data.get("severity")
        deadline = lifecycle_data.get("deadline")
        escalated = lifecycle_data.get("escalated")
        internal_notes = lifecycle_data.get("internal_notes")
        rating = lifecycle_data.get("rating")
        feedback = lifecycle_data.get("feedback")
        
        # Build update structure
        updates = {
            "status": status,
            "progress_percentage": progress_percentage,
            "updatedAt": datetime.now()
        }
        if department:
            updates["department"] = department
        if estimated_completion_date:
            updates["estimated_completion_date"] = estimated_completion_date
        if technician_name:
            updates["technician_name"] = technician_name
        if inspection_date:
            updates["inspection_date"] = inspection_date
        if material_used:
            updates["material_used"] = material_used
        if estimated_cost is not None:
            updates["estimated_cost"] = estimated_cost
        if citizen_verified is not None:
            cv_bool = str(citizen_verified).lower() in ["true", "1", "yes"]
            updates["citizen_verified"] = cv_bool
        if officer_id:
            updates["officer_id"] = officer_id
        if officer_name:
            updates["officer_name"] = officer_name
            
        if category:
            updates["category"] = category
        if priority:
            updates["priority"] = priority
        if severity:
            updates["severity"] = severity
        if deadline:
            updates["deadline"] = deadline
            updates["estimated_completion_date"] = deadline
        if escalated is not None:
            updates["escalated"] = str(escalated).lower() in ["true", "1", "yes"]
        if internal_notes:
            updates["internal_notes"] = internal_notes
        if rating is not None:
            updates["citizen_rating"] = int(rating)
        if feedback:
            updates["citizen_feedback"] = feedback

        # If citizen rejected, return to assigned officer and reopen
        if status.lower() in ["reopened", "citizen_rejected"]:
            updates["status"] = "reopened"
            updates["progress_percentage"] = 75
            updates["citizen_verified"] = False
            status = "reopened"
            progress_percentage = 75

        # Handle Resolved status fields
        if status.lower() == "resolved" or status.lower() == "repair_completed" or status.lower() == "citizen_verification_pending":
            # Classify media_urls into after images and completion video
            after_imgs = [url for url in media_urls if not url.lower().endswith((".mp4", ".mov", ".avi", ".webm"))]
            after_vids = [url for url in media_urls if url.lower().endswith((".mp4", ".mov", ".avi", ".webm"))]
            
            updates["after_image_urls"] = after_imgs
            updates["completion_video_urls"] = after_vids
            updates["completion_notes"] = notes
            updates["resolution_date"] = datetime.now()
            updates["resolver_officer_name"] = updated_by
            if estimated_cost is not None:
                updates["estimated_cost"] = estimated_cost
            if material_used:
                updates["material_used"] = material_used
                
        # Merge update dict back to main issue
        issue.update(updates)
        
        if DatabaseService.is_active():
            try:
                db.collection("issues").document(issue_id).update(updates)
                logger.info(f"Updated issue {issue_id} in Firestore.")
            except Exception as e:
                logger.error(f"Error updating issue in Firestore: {e}. Fallback updated in memory.")
            
        # Log to status history
        history_entry = {
            "issue_id": issue_id,
            "status": status,
            "progress_percentage": progress_percentage,
            "department": department,
            "estimated_completion_date": estimated_completion_date,
            "updated_by": updated_by,
            "notes": notes,
            "media_urls": media_urls,
            "timestamp": datetime.now()
        }
        if technician_name:
            history_entry["technician_name"] = technician_name
        if inspection_date:
            history_entry["inspection_date"] = inspection_date
        if material_used:
            history_entry["material_used"] = material_used
        if estimated_cost is not None:
            history_entry["estimated_cost"] = estimated_cost
            
        await DatabaseService.create_status_history_entry(history_entry)
        
        # Trigger notifications according to Module 4
        notifs_to_create = []
        
        # Base notification
        notif_msg = f"Status changed to {status.replace('_', ' ').title()}"
        if department and status.lower() == "department_assigned":
            notif_msg = f"Department Assigned: {department}"
        elif status.lower() == "resolved":
            notif_msg = f"Resolved: Issue resolved by {updated_by}"
        elif status.lower() == "closed":
            notif_msg = "Closed: Issue closed."
        elif status.lower() == "inspection_scheduled":
            notif_msg = f"Inspection Scheduled for {inspection_date or 'TBD'}"
        elif status.lower() == "work_in_progress":
            notif_msg = f"Work in progress. Assigned to technician: {technician_name or 'TBD'}"
            
        notifs_to_create.append({
            "issue_id": issue_id,
            "message": notif_msg,
            "status": status
        })
        
        # Citizen Specific
        if status.lower() == "department_assigned":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": f"Issue Assigned: Incident assigned to department {department}.",
                "status": status,
                "target_role": "citizen"
            })
        elif status.lower() == "officer_accepted":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": f"Officer Accepted: Officer {officer_name or 'assigned officer'} accepted the work.",
                "status": status,
                "target_role": "citizen"
            })
        elif status.lower() == "inspection_scheduled":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": f"Inspection Scheduled: Inspection set for {inspection_date or 'TBD'}.",
                "status": status,
                "target_role": "citizen"
            })
        elif status.lower() == "work_in_progress":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": "Repair Started: Work is in progress.",
                "status": status,
                "target_role": "citizen"
            })
        elif status.lower() in ["repair_completed", "citizen_verification_pending"]:
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": "Repair Completed: Repair completed by department.",
                "status": status,
                "target_role": "citizen"
            })
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": "Verification Requested: Please verify work completion.",
                "status": status,
                "target_role": "citizen"
            })
        elif status.lower() == "closed":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": "Issue Closed: incident has been closed.",
                "status": status,
                "target_role": "citizen"
            })
        elif status.lower() == "reopened":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": "Issue Reopened: Issue is reopened.",
                "status": status,
                "target_role": "citizen"
            })
            
        # Officer Specific
        if status.lower() == "officer_assigned":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": f"New Assignment: You have been assigned to issue {issue.get('title')}.",
                "status": status,
                "target_role": "department_officer"
            })
        if priority and priority != issue.get("priority"):
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": f"Priority/Severity Changed: Priority changed to {priority}.",
                "status": status,
                "target_role": "department_officer"
            })
        if escalated and not issue.get("escalated"):
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": f"Issue Escalated: Issue {issue.get('title')} has been escalated.",
                "status": status,
                "target_role": "department_officer"
            })
        if status.lower() == "reopened":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": "Issue Reopened: Citizens rejected your completion. Reopened!",
                "status": status,
                "target_role": "department_officer"
            })
            
        # Administrator Specific
        if severity == "critical" or (status.lower() == "reopened" and severity == "critical"):
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": "Critical Issue: A new critical severity incident has been reported/escalated.",
                "status": status,
                "target_role": "administrator"
            })
        if status.lower() == "officer_rejected":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": f"Officer Rejected Assignment: Officer {officer_name or 'assigned officer'} rejected the ticket assignment.",
                "status": status,
                "target_role": "administrator"
            })
        if status.lower() == "reopened":
            notifs_to_create.append({
                "issue_id": issue_id,
                "message": f"Citizen Reopened Issue: Citizen rejected repair work on issue {issue_id}.",
                "status": status,
                "target_role": "administrator"
            })
            
        # Write notifications
        for notif in notifs_to_create:
            await DatabaseService.create_notification(notif)
        
        # Recalculate stats for old and new department/officer
        new_dept = issue.get("department")
        new_officer_id = issue.get("officer_id")
        
        if new_dept:
            await DatabaseService.recalculate_dept_stats(new_dept)
        if old_dept and old_dept != new_dept:
            await DatabaseService.recalculate_dept_stats(old_dept)
            
        if new_officer_id:
            await DatabaseService.recalculate_officer_stats(new_officer_id)
        if old_officer_id and old_officer_id != new_officer_id:
            await DatabaseService.recalculate_officer_stats(old_officer_id)
            
        return issue

    @staticmethod
    async def list_departments() -> List[Dict[str, Any]]:
        if DatabaseService.is_active():
            try:
                docs = db.collection("departments").stream()
                depts = [doc.to_dict() for doc in docs]
                if depts:
                    return depts
            except Exception as e:
                logger.error(f"Error fetching departments from Firestore: {e}")
        return MOCK_DEPARTMENTS_DB

    @staticmethod
    async def list_officers(department: Optional[str] = None) -> List[Dict[str, Any]]:
        officers = []
        if DatabaseService.is_active():
            try:
                docs = db.collection("officers").stream()
                officers = [doc.to_dict() for doc in docs]
            except Exception as e:
                logger.error(f"Error fetching officers from Firestore: {e}")
                officers = MOCK_OFFICERS_DB
        else:
            officers = MOCK_OFFICERS_DB

        if department:
            officers = [o for o in officers if o.get("department", "").lower() == department.lower()]
        return officers

    @staticmethod
    async def list_all_notifications(
        owner_uid: Optional[str] = None,
        department: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        notifs = []
        if DatabaseService.is_active():
            try:
                col_ref = db.collection("issue_notifications")
                if owner_uid:
                    docs = col_ref.where("ownerUid", "==", owner_uid).stream()
                elif department:
                    docs = col_ref.where("department", "==", department).stream()
                else:
                    docs = col_ref.stream()
                notifs = [doc.to_dict() for doc in docs]
            except Exception as e:
                logger.error(f"Error listing global notifications from Firestore: {e}")
                notifs = list(MOCK_NOTIFICATIONS_DB)
        else:
            notifs = list(MOCK_NOTIFICATIONS_DB)
        
        # Apply role-based filters in Python
        filtered_notifs = []
        for notif in notifs:
            if owner_uid and notif.get("ownerUid") != owner_uid:
                continue
            if department and notif.get("department", "").lower() != department.lower():
                continue
            filtered_notifs.append(notif)

        def get_timestamp_dt(x):
            val = x.get("timestamp")
            if isinstance(val, datetime):
                return val
            if isinstance(val, str):
                try:
                    return datetime.fromisoformat(val.replace("Z", "+00:00"))
                except:
                    pass
            return datetime.min
        return sorted(filtered_notifs, key=get_timestamp_dt, reverse=True)

    @staticmethod
    async def assign_issue_department(issue_id: str, department: str) -> Optional[Dict[str, Any]]:
        issue = await DatabaseService.get_issue(issue_id)
        if not issue:
            return None
        
        updates = {
            "department": department,
            "status": "department_assigned",
            "updatedAt": datetime.now()
        }
        issue.update(updates)
        
        if DatabaseService.is_active():
            try:
                db.collection("issues").document(issue_id).update(updates)
            except Exception as e:
                logger.error(f"Error updating department in Firestore: {e}")
        
        await DatabaseService.create_status_history_entry({
            "issue_id": issue_id,
            "status": "department_assigned",
            "department": department,
            "updated_by": "Administrator",
            "notes": f"Manually assigned department to {department}",
            "timestamp": datetime.now()
        })
        
        await DatabaseService.create_notification({
            "issue_id": issue_id,
            "message": f"Department manual reassignment: {department}",
            "status": "department_assigned",
            "timestamp": datetime.now()
        })
        
        return issue

    @staticmethod
    async def assign_issue_department(issue_id: str, department: str) -> Optional[Dict[str, Any]]:
        issue = await DatabaseService.get_issue(issue_id)
        if not issue:
            return None
        
        old_dept = issue.get("department")
        old_officer_id = issue.get("officer_id")
        
        updates = {
            "department": department,
            "status": "department_assigned",
            "updatedAt": datetime.now()
        }
        
        # If department changed, unassign officer to prevent inconsistent department/officer states
        if old_dept and old_dept.lower() != department.lower():
            updates["officer_id"] = None
            updates["officer_name"] = None
            
        issue.update(updates)
        
        if DatabaseService.is_active():
            try:
                db.collection("issues").document(issue_id).update(updates)
            except Exception as e:
                logger.error(f"Error updating department in Firestore: {e}")
        
        await DatabaseService.create_status_history_entry({
            "issue_id": issue_id,
            "status": "department_assigned",
            "department": department,
            "updated_by": "Administrator",
            "notes": f"Manually assigned department to {department}",
            "timestamp": datetime.now()
        })
        
        await DatabaseService.create_notification({
            "issue_id": issue_id,
            "message": f"Department manual reassignment: {department}",
            "status": "department_assigned",
            "timestamp": datetime.now()
        })
        
        # Recalculate stats for old and new department
        await DatabaseService.recalculate_dept_stats(department)
        if old_dept and old_dept != department:
            await DatabaseService.recalculate_dept_stats(old_dept)
        if old_officer_id:
            await DatabaseService.recalculate_officer_stats(old_officer_id)
            
        return issue

    @staticmethod
    async def assign_issue_officer(issue_id: str, officer_id: str, officer_name: str) -> Optional[Dict[str, Any]]:
        issue = await DatabaseService.get_issue(issue_id)
        if not issue:
            return None
        
        old_officer_id = issue.get("officer_id")
        old_dept = issue.get("department")
        
        updates = {
            "officer_id": officer_id,
            "officer_name": officer_name,
            "status": "officer_assigned",
            "progress_percentage": 40,
            "updatedAt": datetime.now()
        }
        issue.update(updates)
        
        if DatabaseService.is_active():
            try:
                db.collection("issues").document(issue_id).update(updates)
            except Exception as e:
                logger.error(f"Error updating officer in Firestore: {e}")
        
        await DatabaseService.create_status_history_entry({
            "issue_id": issue_id,
            "status": "officer_assigned",
            "progress_percentage": 40,
            "officer_id": officer_id,
            "officer_name": officer_name,
            "updated_by": "Administrator",
            "notes": f"Assigned officer {officer_name}",
            "timestamp": datetime.now()
        })
        
        await DatabaseService.create_notification({
            "issue_id": issue_id,
            "message": f"Officer assigned: {officer_name}",
            "status": "officer_assigned",
            "timestamp": datetime.now()
        })
        
        # Recalculate stats for old and new officer
        await DatabaseService.recalculate_officer_stats(officer_id)
        if old_officer_id and old_officer_id != officer_id:
            await DatabaseService.recalculate_officer_stats(old_officer_id)
        if old_dept:
            await DatabaseService.recalculate_dept_stats(old_dept)
            
        return issue

    @staticmethod
    async def recalculate_dept_stats(dept_id: str):
        if not dept_id:
            return
        if DatabaseService.is_active():
            try:
                dept_issues = db.collection("issues").where("department", "==", dept_id).stream()
                issues_list = [doc.to_dict() for doc in dept_issues]
                pending = sum(1 for i in issues_list if i.get("status") not in ["resolved", "closed"])
                resolved = sum(1 for i in issues_list if i.get("status") in ["resolved", "closed"])
                
                # Count officers in this department
                officers_docs = db.collection("officers").where("department", "==", dept_id).stream()
                off_list = [doc.to_dict() for doc in officers_docs]
                off_count = len(off_list)
                
                # Calculate average resolution time for the department
                res_times = []
                for i in issues_list:
                    if i.get("status") in ["resolved", "closed"]:
                        created_at = i.get("createdAt")
                        res_date = i.get("resolution_date") or i.get("updatedAt")
                        if created_at and res_date:
                            try:
                                if isinstance(created_at, str):
                                    created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                                if isinstance(res_date, str):
                                    res_date = datetime.fromisoformat(res_date.replace("Z", "+00:00"))
                                diff = (res_date - created_at).total_seconds() / 86400.0
                                if diff >= 0:
                                    res_times.append(diff)
                            except:
                                pass
                avg_res_time = round(sum(res_times) / len(res_times), 1) if res_times else 2.4

                # Calculate citizen satisfaction rating
                ratings = [i.get("citizen_rating") for i in issues_list if i.get("citizen_rating") is not None]
                avg_sat = round(sum(ratings) / len(ratings), 1) if ratings else 4.5

                # Calculate department performance score based on officer scores
                off_scores = [o.get("performanceScore") for o in off_list if o.get("performanceScore") is not None]
                dept_perf = round(sum(off_scores) / len(off_scores)) if off_scores else 90
                dept_perf = min(100, max(50, dept_perf))

                dept_ref = db.collection("departments").document(dept_id)
                dept_snap = dept_ref.get()
                
                updates = {
                    "pending_count": pending,
                    "resolved_count": resolved,
                    "officers_count": off_count,
                    "activeIssues": pending,
                    "completedIssues": resolved,
                    "numberOfOfficers": off_count,
                    "averageResolutionTime": avg_res_time,
                    "performanceScore": dept_perf,
                    "citizenSatisfaction": avg_sat,
                    "citizen_satisfaction": avg_sat,
                }
                
                if dept_snap.exists:
                    dept_ref.update(updates)
                else:
                    dept_ref.set({
                        "id": dept_id,
                        "departmentId": dept_id,
                        "name": dept_id.replace("_", " ").title() + " Department",
                        "departmentName": dept_id.replace("_", " ").title() + " Department",
                        "description": f"Handles municipal {dept_id.replace('_', ' ')} requests.",
                        "headOfficer": None,
                        "status": "Active",
                        **updates
                    })
            except Exception as e:
                logger.error(f"Error recalculating dept stats: {e}")
        else:
            pending = sum(1 for i in MOCK_ISSUES_DB if i.get("department") == dept_id and i.get("status") not in ["resolved", "closed"])
            resolved = sum(1 for i in MOCK_ISSUES_DB if i.get("department") == dept_id and i.get("status") in ["resolved", "closed"])
            off_list = [o for o in MOCK_OFFICERS_DB if o.get("department") == dept_id]
            off_count = len(off_list)
            
            res_times = []
            for i in MOCK_ISSUES_DB:
                if i.get("department") == dept_id and i.get("status") in ["resolved", "closed"]:
                    created_at = i.get("createdAt")
                    res_date = i.get("resolution_date") or i.get("updatedAt")
                    if created_at and res_date:
                        try:
                            if isinstance(created_at, str):
                                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                            if isinstance(res_date, str):
                                res_date = datetime.fromisoformat(res_date.replace("Z", "+00:00"))
                            diff = (res_date - created_at).total_seconds() / 86400.0
                            if diff >= 0:
                                res_times.append(diff)
                        except:
                            pass
            avg_res_time = round(sum(res_times) / len(res_times), 1) if res_times else 2.4

            ratings = [i.get("citizen_rating") for i in MOCK_ISSUES_DB if i.get("department") == dept_id and i.get("citizen_rating") is not None]
            avg_sat = round(sum(ratings) / len(ratings), 1) if ratings else 4.5
            
            off_scores = [o.get("performance_score") or o.get("performanceScore") for o in off_list if (o.get("performance_score") or o.get("performanceScore")) is not None]
            dept_perf = round(sum(off_scores) / len(off_scores)) if off_scores else 90
            dept_perf = min(100, max(50, dept_perf))

            for d in MOCK_DEPARTMENTS_DB:
                if d.get("id") == dept_id:
                    d["pending_count"] = pending
                    d["resolved_count"] = resolved
                    d["officers_count"] = off_count
                    d["activeIssues"] = pending
                    d["completedIssues"] = resolved
                    d["numberOfOfficers"] = off_count
                    d["averageResolutionTime"] = avg_res_time
                    d["performanceScore"] = dept_perf
                    d["citizenSatisfaction"] = avg_sat
                    d["citizen_satisfaction"] = avg_sat
                    break


    @staticmethod
    async def recalculate_officer_stats(officer_id: str):
        if not officer_id:
            return
        if DatabaseService.is_active():
            try:
                off_issues = db.collection("issues").where("officer_id", "==", officer_id).stream()
                off_issues_list = [doc.to_dict() for doc in off_issues]
                
                active_assigned = [i.get("id") for i in off_issues_list if i.get("status") not in ["resolved", "closed"]]
                completed = sum(1 for i in off_issues_list if i.get("status") in ["resolved", "closed"])
                
                resolution_times = []
                for i in off_issues_list:
                    if i.get("status") in ["resolved", "closed"]:
                        created_at = i.get("createdAt")
                        res_date = i.get("resolution_date") or i.get("updatedAt")
                        if created_at and res_date:
                            try:
                                if isinstance(created_at, str):
                                    created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                                if isinstance(res_date, str):
                                    res_date = datetime.fromisoformat(res_date.replace("Z", "+00:00"))
                                diff = (res_date - created_at).total_seconds() / 86400.0
                                if diff >= 0:
                                    resolution_times.append(diff)
                            except:
                                pass
                avg_time = round(sum(resolution_times) / len(resolution_times), 1) if resolution_times else 2.4
                perf_score = 90 + completed * 2 - len(active_assigned) * 3
                perf_score = min(100, max(50, perf_score))

                # Calculate citizen satisfaction rating
                ratings = [i.get("citizen_rating") for i in off_issues_list if i.get("citizen_rating") is not None]
                avg_sat = round(sum(ratings) / len(ratings), 1) if ratings else 4.5
                
                off_ref = db.collection("officers").document(officer_id)
                off_snap = off_ref.get()
                
                updates = {
                    "current_workload": len(active_assigned),
                    "currentWorkload": len(active_assigned),
                    "assigned_issues": active_assigned,
                    "activeIssues": active_assigned,
                    "completed_issues": completed,
                    "completedIssues": completed,
                    "average_resolution_time": avg_time,
                    "averageResolutionTime": avg_time,
                    "performance_score": perf_score,
                    "performanceScore": perf_score,
                    "citizenSatisfaction": avg_sat,
                    "citizen_satisfaction": avg_sat
                }
                
                if off_snap.exists:
                    off_ref.update(updates)
                else:
                    # Let's fetch details from users collection to pre-populate officer doc if creating it
                    user_ref = db.collection("users").document(officer_id)
                    user_snap = user_ref.get()
                    user_data = user_snap.to_dict() if user_snap.exists else {}
                    
                    off_ref.set({
                        "id": officer_id,
                        "uid": officer_id,
                        "fullName": user_data.get("fullName", "Officer"),
                        "email": user_data.get("email", ""),
                        "phone": user_data.get("phone", ""),
                        "department": user_data.get("department", "roads"),
                        "designation": user_data.get("designation", "Officer"),
                        "status": user_data.get("status", "Active"),
                        "permissions": user_data.get("permissions") or ["inspect", "resolve"],
                        "joinedDate": user_data.get("createdAt") or datetime.utcnow().isoformat(),
                        **updates
                    })
            except Exception as e:
                logger.error(f"Error recalculating officer stats: {e}")
        else:
            active_assigned = [i.get("id") for i in MOCK_ISSUES_DB if i.get("officer_id") == officer_id and i.get("status") not in ["resolved", "closed"]]
            completed = sum(1 for i in MOCK_ISSUES_DB if i.get("officer_id") == officer_id and i.get("status") in ["resolved", "closed"])
            
            resolution_times = []
            for i in MOCK_ISSUES_DB:
                if i.get("officer_id") == officer_id and i.get("status") in ["resolved", "closed"]:
                    created_at = i.get("createdAt")
                    res_date = i.get("resolution_date") or i.get("updatedAt")
                    if created_at and res_date:
                        try:
                            if isinstance(created_at, str):
                                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                            if isinstance(res_date, str):
                                res_date = datetime.fromisoformat(res_date.replace("Z", "+00:00"))
                            diff = (res_date - created_at).total_seconds() / 86400.0
                            if diff >= 0:
                                resolution_times.append(diff)
                        except:
                            pass
            avg_time = round(sum(resolution_times) / len(resolution_times), 1) if resolution_times else 2.4
            perf_score = 90 + completed * 2 - len(active_assigned) * 3
            perf_score = min(100, max(50, perf_score))

            ratings = [i.get("citizen_rating") for i in MOCK_ISSUES_DB if i.get("officer_id") == officer_id and i.get("citizen_rating") is not None]
            avg_sat = round(sum(ratings) / len(ratings), 1) if ratings else 4.5
            
            for o in MOCK_OFFICERS_DB:
                if o.get("id") == officer_id or o.get("uid") == officer_id:
                    o["current_workload"] = len(active_assigned)
                    o["currentWorkload"] = len(active_assigned)
                    o["assigned_issues"] = active_assigned
                    o["activeIssues"] = active_assigned
                    o["completed_issues"] = completed
                    o["completedIssues"] = completed
                    o["average_resolution_time"] = avg_time
                    o["averageResolutionTime"] = avg_time
                    o["performance_score"] = perf_score
                    o["performanceScore"] = perf_score
                    o["citizenSatisfaction"] = avg_sat
                    o["citizen_satisfaction"] = avg_sat
                    break


    @staticmethod
    async def update_user(uid: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Updates a user document in the 'users' collection.
        If role, fullName, or status are changed, also propagate to the 'officers' doc if they are an officer.
        """
        # Clean datetime
        for k, v in list(update_data.items()):
            if isinstance(v, datetime):
                update_data[k] = v.isoformat()

        if DatabaseService.is_active():
            user_ref = db.collection("users").document(uid)
            user_ref.update(update_data)
            
            # If this is an officer, sync user properties to the officers collection
            if update_data.get("role") == "department_officer" or update_data.get("department") or "fullName" in update_data or "status" in update_data:
                off_ref = db.collection("officers").document(uid)
                if off_ref.get().exists:
                    sync_data = {}
                    if "fullName" in update_data:
                        sync_data["fullName"] = update_data["fullName"]
                    if "phone" in update_data:
                        sync_data["phone"] = update_data["phone"]
                    if "email" in update_data:
                        sync_data["email"] = update_data["email"]
                    if "department" in update_data:
                        sync_data["department"] = update_data["department"]
                    if "designation" in update_data:
                        sync_data["designation"] = update_data["designation"]
                    if "status" in update_data:
                        sync_data["status"] = update_data["status"]
                    if "permissions" in update_data:
                        sync_data["permissions"] = update_data["permissions"]
                    if sync_data:
                        off_ref.update(sync_data)
            return update_data
        else:
            # Update Mock DB
            for o in MOCK_OFFICERS_DB:
                if o.get("id") == uid or o.get("uid") == uid:
                    if "fullName" in update_data:
                        o["name"] = update_data["fullName"]
                        o["fullName"] = update_data["fullName"]
                    if "phone" in update_data:
                        o["phone"] = update_data["phone"]
                    if "email" in update_data:
                        o["email"] = update_data["email"]
                    if "department" in update_data:
                        o["department"] = update_data["department"]
                    if "designation" in update_data:
                        o["designation"] = update_data["designation"]
                    if "status" in update_data:
                        o["status"] = update_data["status"]
                    break
            return update_data

    @staticmethod
    async def create_officer_doc(uid: str, officer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates an officer document in 'officers' collection.
        """
        # Clean datetime
        for k, v in list(officer_data.items()):
            if isinstance(v, datetime):
                officer_data[k] = v.isoformat()

        if DatabaseService.is_active():
            db.collection("officers").document(uid).set(officer_data)
            await DatabaseService.recalculate_dept_stats(officer_data.get("department"))
            return officer_data
        else:
            # Save to MOCK_OFFICERS_DB
            mock_off = {
                "id": uid,
                "uid": uid,
                "name": officer_data.get("fullName", "Officer"),
                "fullName": officer_data.get("fullName", "Officer"),
                "email": officer_data.get("email", ""),
                "phone": officer_data.get("phone", ""),
                "department": officer_data.get("department", "roads"),
                "designation": officer_data.get("designation", "Officer"),
                "status": officer_data.get("status", "Active"),
                "permissions": officer_data.get("permissions", ["inspect", "resolve"]),
                "joinedDate": officer_data.get("joinedDate") or datetime.utcnow().isoformat(),
                "performanceScore": officer_data.get("performanceScore", 100),
                "performance_score": officer_data.get("performanceScore", 100),
                "currentWorkload": officer_data.get("currentWorkload", 0),
                "current_workload": officer_data.get("currentWorkload", 0),
                "completedIssues": officer_data.get("completedIssues", 0),
                "completed_issues": officer_data.get("completedIssues", 0),
                "activeIssues": officer_data.get("activeIssues", []),
                "assigned_issues": officer_data.get("activeIssues", []),
                "averageResolutionTime": officer_data.get("averageResolutionTime", 0.0),
                "average_resolution_time": officer_data.get("averageResolutionTime", 0.0)
            }
            MOCK_OFFICERS_DB.append(mock_off)
            await DatabaseService.recalculate_dept_stats(mock_off.get("department"))
            return mock_off

    @staticmethod
    async def update_officer_doc(uid: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Updates an officer document in 'officers' collection.
        Handles department transfer logic if the department changes.
        """
        # Clean datetime
        for k, v in list(update_data.items()):
            if isinstance(v, datetime):
                update_data[k] = v.isoformat()

        # Let's check if the officer is being transferred (department change)
        old_dept = None
        new_dept = update_data.get("department")
        
        if DatabaseService.is_active():
            off_ref = db.collection("officers").document(uid)
            off_snap = off_ref.get()
            if off_snap.exists:
                old_dept = off_snap.to_dict().get("department")
                off_ref.update(update_data)
                
                # Also update corresponding user profile
                db.collection("users").document(uid).update({
                    "department": new_dept if new_dept else None,
                    "designation": update_data.get("designation") if "designation" in update_data else None,
                    "status": update_data.get("status") if "status" in update_data else None
                })
        else:
            for o in MOCK_OFFICERS_DB:
                if o.get("id") == uid or o.get("uid") == uid:
                    old_dept = o.get("department")
                    for k, v in update_data.items():
                        o[k] = v
                        if k == "fullName":
                            o["name"] = v
                    break

        # If transferred, update all active issues assigned to this officer and recalculate statistics
        if old_dept and new_dept and old_dept != new_dept:
            logger.info(f"Officer {uid} is being transferred from {old_dept} to {new_dept}. Updating active issues...")
            if DatabaseService.is_active():
                # Get all active issues assigned to this officer
                active_issues_query = db.collection("issues")\
                    .where("officer_id", "==", uid)\
                    .stream()
                for doc in active_issues_query:
                    issue_data = doc.to_dict()
                    if issue_data.get("status") not in ["resolved", "closed"]:
                        # Transfer issue department to the officer's new department
                        db.collection("issues").document(doc.id).update({
                            "department": new_dept
                        })
            else:
                for issue in MOCK_ISSUES_DB:
                    if issue.get("officer_id") == uid and issue.get("status") not in ["resolved", "closed"]:
                        issue["department"] = new_dept
            
            # Recalculate stats for old and new departments, and the officer
            await DatabaseService.recalculate_dept_stats(old_dept)
            await DatabaseService.recalculate_dept_stats(new_dept)
            await DatabaseService.recalculate_officer_stats(uid)

        return update_data

    @staticmethod
    async def create_department_doc(dept_id: str, dept_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a department in 'departments' collection.
        """
        if DatabaseService.is_active():
            db.collection("departments").document(dept_id).set(dept_data)
            return dept_data
        else:
            mock_dept = {
                "id": dept_id,
                "departmentId": dept_id,
                "name": dept_data.get("name") or dept_data.get("departmentName") or dept_id.replace("_", " ").title() + " Department",
                "departmentName": dept_data.get("departmentName") or dept_data.get("name") or dept_id.replace("_", " ").title() + " Department",
                "description": dept_data.get("description", ""),
                "headOfficer": dept_data.get("headOfficer"),
                "numberOfOfficers": dept_data.get("numberOfOfficers", 0),
                "officers_count": dept_data.get("numberOfOfficers", 0),
                "activeIssues": dept_data.get("activeIssues", 0),
                "pending_count": dept_data.get("activeIssues", 0),
                "completedIssues": dept_data.get("completedIssues", 0),
                "resolved_count": dept_data.get("completedIssues", 0),
                "averageResolutionTime": dept_data.get("averageResolutionTime", 0.0),
                "performanceScore": dept_data.get("performanceScore", 100),
                "status": dept_data.get("status", "Active")
            }
            MOCK_DEPARTMENTS_DB.append(mock_dept)
            return mock_dept

    @staticmethod
    async def update_department_doc(dept_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Updates a department document in 'departments' collection.
        """
        if DatabaseService.is_active():
            db.collection("departments").document(dept_id).update(update_data)
            return update_data
        else:
            for d in MOCK_DEPARTMENTS_DB:
                if d.get("id") == dept_id or d.get("departmentId") == dept_id:
                    for k, v in update_data.items():
                        d[k] = v
                        if k == "departmentName":
                            d["name"] = v
                    break
            return update_data

    @staticmethod
    async def archive_department_doc(dept_id: str) -> Dict[str, Any]:
        """
        Archives a department by updating status to 'Archived'.
        """
        return await DatabaseService.update_department_doc(dept_id, {"status": "Archived"})

    @staticmethod
    async def log_admin_action(admin_id: str, admin_name: str, action: str, target_type: str, target_id: str, target_name: str) -> Dict[str, Any]:
        """
        Logs an administrative action in 'admin_activity' collection.
        """
        import uuid
        activity_id = f"activity-{uuid.uuid4().hex[:8]}"
        timestamp = datetime.utcnow()
        
        activity_data = {
            "id": activity_id,
            "action": action,
            "targetType": target_type,
            "targetId": target_id,
            "targetName": target_name,
            "adminId": admin_id,
            "adminName": admin_name,
            "timestamp": timestamp.isoformat()
        }
        
        if DatabaseService.is_active():
            db.collection("admin_activity").document(activity_id).set({
                **activity_data,
                "timestamp": timestamp # Use firestore timestamp
            })
        else:
            MOCK_ADMIN_ACTIVITY_DB.append(activity_data)
            
        return activity_data

    @staticmethod
    async def list_admin_activities() -> List[Dict[str, Any]]:
        """
        Lists all administrative activities ordered by timestamp descending.
        """
        activities = []
        if DatabaseService.is_active():
            try:
                docs = db.collection("admin_activity").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(50).stream()
                for doc in docs:
                    data = doc.to_dict()
                    ts = data.get("timestamp")
                    data["timestamp"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts) if ts else None
                    activities.append(data)
            except Exception as e:
                logger.error(f"Error fetching admin activities from Firestore: {e}")
                activities = list(MOCK_ADMIN_ACTIVITY_DB)
        else:
            activities = list(MOCK_ADMIN_ACTIVITY_DB)
            
        def get_ts(x):
            return x.get("timestamp") or ""
        return sorted(activities, key=get_ts, reverse=True)


    @staticmethod
    async def migrate_existing_issues():
        """
        Scans all issues in Firestore (and mock database) and backfills missing mandatory
        ownership fields safely without losing existing reports.
        """
        logger.info("Starting database migration for existing issues...")
        
        # 1. Migrate Firestore if active
        if DatabaseService.is_active():
            try:
                issues_ref = db.collection("issues")
                docs = list(issues_ref.stream())
                migrated_count = 0
                for doc in docs:
                    issue_id = doc.id
                    data = doc.to_dict()
                    needs_update = False
                    updates = {}
                    
                    # Fields to check/backfill
                    owner_uid = data.get("ownerUid") or data.get("citizenId") or "anonymous"
                    if "ownerUid" not in data:
                        updates["ownerUid"] = owner_uid
                        needs_update = True
                        
                    if "citizenId" not in data:
                        updates["citizenId"] = owner_uid
                        needs_update = True
                        
                    if "ownerEmail" not in data:
                        updates["ownerEmail"] = "anonymous@hero.com"
                        needs_update = True
                        
                    if "ownerName" not in data:
                        updates["ownerName"] = "Anonymous User"
                        needs_update = True
                        
                    if "createdBy" not in data:
                        updates["createdBy"] = updates.get("ownerName") or data.get("ownerName") or "Anonymous User"
                        needs_update = True
                        
                    if "createdAt" not in data:
                        updates["createdAt"] = datetime.now()
                        needs_update = True
                        
                    if "updatedAt" not in data:
                        updates["updatedAt"] = datetime.now()
                        needs_update = True
                        
                    if "assignedOfficer" not in data:
                        updates["assignedOfficer"] = data.get("officer_name") or ""
                        needs_update = True
                        
                    if "status" not in data:
                        updates["status"] = "reported"
                        needs_update = True
                        
                    if needs_update:
                        issues_ref.document(issue_id).update(updates)
                        migrated_count += 1
                        
                logger.info(f"Firestore issues migration complete. Migrated {migrated_count} issues.")
            except Exception as e:
                logger.error(f"Error migrating Firestore issues: {e}")
                
        # 2. Migrate mock DB
        migrated_mock_count = 0
        for issue in MOCK_ISSUES_DB:
            needs_update = False
            owner_uid = issue.get("ownerUid") or issue.get("citizenId") or "anonymous"
            if "ownerUid" not in issue:
                issue["ownerUid"] = owner_uid
                needs_update = True
            if "citizenId" not in issue:
                issue["citizenId"] = owner_uid
                needs_update = True
            if "ownerEmail" not in issue:
                issue["ownerEmail"] = "anonymous@hero.com"
                needs_update = True
            if "ownerName" not in issue:
                issue["ownerName"] = "Anonymous User"
                needs_update = True
            if "createdBy" not in issue:
                issue["createdBy"] = issue.get("ownerName", "Anonymous User")
                needs_update = True
            if "createdAt" not in issue:
                issue["createdAt"] = datetime.now()
                needs_update = True
            if "updatedAt" not in issue:
                issue["updatedAt"] = datetime.now()
                needs_update = True
            if "assignedOfficer" not in issue:
                issue["assignedOfficer"] = issue.get("officer_name") or ""
                needs_update = True
            if "status" not in issue:
                issue["status"] = "reported"
                needs_update = True
            if needs_update:
                migrated_mock_count += 1
                
        logger.info(f"Mock database issues migration complete. Migrated {migrated_mock_count} mock issues.")

    @staticmethod
    def seed_collections_if_empty():
        """
        Seeds departments and officers collections in Firestore if they are empty.
        Uses MOCK_DEPARTMENTS_DB and MOCK_OFFICERS_DB as the seed data.
        """
        if not DatabaseService.is_active():
            logger.info("Firestore is not active. Skipping seeding.")
            return

        try:
            # 1. Seed departments
            depts_col = db.collection("departments")
            dept_docs = list(depts_col.limit(1).stream())
            if not dept_docs:
                logger.info("Seeding departments collection in Firestore...")
                for dept in MOCK_DEPARTMENTS_DB:
                    depts_col.document(dept["id"]).set(dept)
                logger.info("Seeding departments collection completed.")
            else:
                logger.info("departments collection is not empty. Skipping seeding.")

            # 2. Seed officers
            officers_col = db.collection("officers")
            officer_docs = list(officers_col.limit(1).stream())
            if not officer_docs:
                logger.info("Seeding officers collection in Firestore...")
                for officer in MOCK_OFFICERS_DB:
                    officers_col.document(officer["id"]).set(officer)
                logger.info("Seeding officers collection completed.")
            else:
                logger.info("officers collection is not empty. Skipping seeding.")
        except Exception as e:
            logger.error(f"Error seeding Firestore collections on startup: {e}")


