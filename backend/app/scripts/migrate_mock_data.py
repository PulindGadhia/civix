import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to sys.path so we can import app modules
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from app.services.database import DatabaseService, MOCK_ISSUES_DB
from app.core.firebase import db

async def migrate_data():
    print("Checking Firebase connection...")
    if not DatabaseService.is_active():
        print("Firebase is not configured or active. Migration cannot proceed.")
        return
        
    print("Firebase is active. Starting migration of mock data to Firestore...")
    
    issues_migrated = 0
    for issue in MOCK_ISSUES_DB:
        issue_id = issue.get("id")
        doc_ref = db.collection("issues").document(issue_id)
        doc = doc_ref.get()
        if not doc.exists:
            print(f"Migrating issue: {issue_id} - '{issue.get('title')}'")
            # Set default values for schema requirements
            migrated_issue = {
                "id": issue_id,
                "title": issue.get("title", ""),
                "description": issue.get("description", ""),
                "category": issue.get("category", "other"),
                "severity": issue.get("severity", "medium"),
                "priorityScore": issue.get("priorityScore", 50),
                "status": issue.get("status", "reported"),
                "latitude": issue.get("latitude", 0.0),
                "longitude": issue.get("longitude", 0.0),
                "address": issue.get("address", ""),
                "upvotesCount": issue.get("upvotesCount", 0),
                "verificationCount": issue.get("verificationCount", 0),
                "disputeCount": issue.get("disputeCount", 0),
                "confidenceScore": issue.get("confidenceScore", 90.0),
                "createdAt": issue.get("createdAt") or datetime.now(),
                "updatedAt": issue.get("updatedAt") or datetime.now(),
                "citizenId": issue.get("citizenId") or "mock-citizen-uid",
                "publicImageUrl": issue.get("publicImageUrl")
            }
            # Write to Firestore
            doc_ref.set(migrated_issue)
            issues_migrated += 1
        else:
            print(f"Issue {issue_id} already exists in Firestore. Skipping.")
            
    print(f"Migration completed. {issues_migrated} issues migrated.")

if __name__ == "__main__":
    asyncio.run(migrate_data())
