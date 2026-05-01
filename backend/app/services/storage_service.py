"""Cloudflare R2 object storage service.

R2 implements the S3 API, so we use boto3 — same library used for AWS S3.
This module handles uploading farmer-submitted photos and returning their public URLs.
"""

import uuid
from io import BytesIO
from pathlib import Path

import boto3
from botocore.client import Config

from app.config import settings


# ─── boto3 client setup ──────────────────────────────────────────
# Created once at module import. boto3 clients are thread-safe and connection-pooled,
# so reusing one across the app is the recommended pattern.
_r2_client = boto3.client(
    "s3",
    endpoint_url=settings.r2_endpoint_url,
    aws_access_key_id=settings.r2_access_key_id,
    aws_secret_access_key=settings.r2_secret_access_key,
    config=Config(
        signature_version="s3v4",
        region_name="auto",  # R2 ignores region but boto3 requires one
    ),
)


def _build_object_key(original_filename: str, prefix: str = "diagnoses") -> str:
    """Build a unique object key (filename in the bucket).
    
    Format: <prefix>/<uuid>.<ext>
    Example: diagnoses/abc123def456.jpg
    
    We don't keep the original filename — farmers might upload "IMG_4523.jpg"
    or "tomato.jpeg" and we don't want collisions. UUID is collision-free.
    """
    extension = Path(original_filename).suffix.lower() or ".jpg"
    unique_name = uuid.uuid4().hex
    return f"{prefix}/{unique_name}{extension}"


def upload_image(
    file_bytes: bytes,
    original_filename: str,
    content_type: str = "image/jpeg",
    prefix: str = "diagnoses",
) -> tuple[str, str]:
    """Upload bytes to R2 and return (object_key, public_url).
    
    Args:
        file_bytes: raw image data
        original_filename: used only to extract the file extension
        content_type: MIME type (image/jpeg, image/png, etc.)
        prefix: folder-like prefix in the bucket (default: "diagnoses")
    
    Returns:
        (object_key, public_url) — both stored in the diagnoses.image_url column
    """
    object_key = _build_object_key(original_filename, prefix=prefix)
    
    _r2_client.upload_fileobj(
        Fileobj=BytesIO(file_bytes),
        Bucket=settings.r2_bucket_name,
        Key=object_key,
        ExtraArgs={
            "ContentType": content_type,
        },
    )
    
    # Construct the public URL using the bucket's public r2.dev domain
    public_url = f"{settings.r2_public_url.rstrip('/')}/{object_key}"
    
    return object_key, public_url