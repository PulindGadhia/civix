import logging
import os
import uuid

from fastapi import UploadFile

from app.core.firebase import bucket

logger = logging.getLogger(__name__)

# Ensure local uploads directory exists for fallback mode
LOCAL_UPLOAD_DIR = os.path.join(os.getcwd(), "static", "uploads")
os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)


class StorageService:
    """
    Handles file uploads to Firebase Storage.
    Falls back to saving files locally and serving them through FastAPI static files.
    """

    @staticmethod
    def is_active() -> bool:
        return bucket is not None

    @staticmethod
    async def upload_file(file: UploadFile) -> str:
        """
        Uploads a file and returns its public web URL.
        """
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"

        # Read the file contents
        content = await file.read()

        if StorageService.is_active():
            try:
                # Upload to Firebase Storage bucket
                blob = bucket.blob(f"issues/{unique_filename}")
                blob.upload_from_string(
                    content, content_type=file.content_type or "image/jpeg"
                )
                # Make public or generate signed URL
                blob.make_public()
                public_url = blob.public_url
                logger.info(f"Uploaded {file.filename} to Firebase: {public_url}")
                return public_url
            except Exception as e:
                logger.error(f"Firebase upload failed: {e}. Using local fallback.")

        # Local fallback saving
        local_path = os.path.join(LOCAL_UPLOAD_DIR, unique_filename)
        try:
            with open(local_path, "wb") as f:
                f.write(content)

            # Formulate local serving URL
            local_url = f"http://localhost:8000/static/uploads/{unique_filename}"
            logger.info(f"Saved {file.filename} to local storage: {local_url}")
            return local_url
        except Exception as e:
            logger.error(f"Failed to save file locally: {e}")
            # Absolute fallback to placeholder
            return f"https://placehold.co/600x400/orange/white?text={unique_filename}"
