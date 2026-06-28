from fastapi import APIRouter
from app.api.v1.endpoints import admin, analytics, auth, chat, issues, ai, verification, lifecycle, department

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(issues.router, prefix="/issues", tags=["issues"])
api_router.include_router(verification.router, prefix="/issues", tags=["verification"])
api_router.include_router(lifecycle.router, prefix="/issues", tags=["lifecycle"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(department.router, tags=["department"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

