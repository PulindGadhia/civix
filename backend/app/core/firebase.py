import logging

import firebase_admin
from firebase_admin import credentials, firestore, storage

from app.core.config import settings

logger = logging.getLogger(__name__)

db = None
bucket = None
firebase_app = None

# Initialize Firebase Admin SDK if configuration is available
try:
    if settings.FIREBASE_PROJECT_ID and settings.FIREBASE_CLIENT_EMAIL:
        # Reconstruct private key to handle newline characters properly
        private_key = settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n")

        cred = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": settings.FIREBASE_PROJECT_ID,
                "private_key_id": settings.FIREBASE_PRIVATE_KEY_ID,
                "private_key": private_key,
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )

        firebase_app = firebase_admin.initialize_app(
            cred,
            {
                "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
                "databaseURL": settings.FIREBASE_DATABASE_URL,
            },
        )

        db = firestore.client()
        bucket = storage.bucket()
        logger.info("Firebase Admin SDK initialized successfully.")
    else:
        logger.warning(
            "Firebase credentials missing. Running without active Firebase connection."
        )
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
