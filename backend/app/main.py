import sys
import os
import time
import glob

# Bootstrap: Add virtual environment site-packages to sys.path for cross-platform compatibility
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
venv_dir = os.path.join(base_dir, "venv")
if os.path.exists(venv_dir):
    # Match Windows (venv/Lib/site-packages) and Unix (venv/lib/python*/site-packages)
    paths = glob.glob(os.path.join(venv_dir, "Lib", "site-packages")) + \
            glob.glob(os.path.join(venv_dir, "lib", "python*", "site-packages"))
    for path in paths:
        if path not in sys.path:
            sys.path.insert(0, path)

import traceback
import uuid
import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)

if settings.GEMINI_API_KEY:
    print("Gemini API key detected: YES", flush=True)
else:
    print("Gemini API key detected: NO", flush=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    trace_id = str(uuid.uuid4())
    logger.error(f"HTTPException at {request.url.path}: [{trace_id}] {exc.detail}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": "HTTP Exception",
            "details": exc.detail,
            "trace_id": trace_id
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    trace_id = str(uuid.uuid4())
    logger.error(f"RequestValidationError at {request.url.path}: [{trace_id}] {exc.errors()}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "Validation Error",
            "details": str(exc.errors()),
            "trace_id": trace_id
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    trace_id = str(uuid.uuid4())
    logger.error(f"Unhandled Exception at {request.url.path}: [{trace_id}] {str(exc)}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal Server Error",
            "details": "An unexpected error occurred. Please contact support.",
            "trace_id": trace_id
        }
    )

# Ensure static directories exist and mount them
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up CORS origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Basic connection check homepage
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": f"Welcome to the {settings.PROJECT_NAME} backend!",
        "framework": "FastAPI",
        "version": "1.0.0",
    }


from app.services.database import DatabaseService

@app.on_event("startup")
def startup_event():
    DatabaseService.seed_collections_if_empty()


# Health check endpoint
@app.get("/health", status_code=200)
def health_check():
    gemini_status = "configured" if settings.GEMINI_API_KEY else "unconfigured"
    firebase_status = "configured" if (settings.FIREBASE_PROJECT_ID and settings.FIREBASE_CLIENT_EMAIL) else "unconfigured"
    maps_status = "configured" if settings.GOOGLE_MAPS_API_KEY else "unconfigured"
    
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "services": {
            "api": "healthy",
            "gemini": gemini_status,
            "gemini_api": gemini_status,
            "firebase": firebase_status,
            "maps": maps_status,
            "google_maps": maps_status
        },
    }


# Register v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)
