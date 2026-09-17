"""ImageKit CDN uploader for extracted question diagrams (imagekitio v5+).

Bytes in, CDN URL out. Total function: any failure (missing credentials,
missing SDK, network error) returns None so the caller keeps the base64
bytes instead — uploads never break extraction.

Required env vars (export them; Modal injects them as a secret):
    UPLOAD_TO_IMAGEKIT   — must be "true" to enable uploads
    IMAGEKIT_PRIVATE_KEY — your ImageKit private key
    IMAGEKIT_PUBLIC_KEY  — your ImageKit public key
    IMAGEKIT_URL_ENDPOINT — e.g. https://ik.imagekit.io/your_id
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

_IMAGEKIT_FOLDER = "/gate-mentor/diagrams"


def _get_client() -> Optional[Any]:
    if os.getenv("UPLOAD_TO_IMAGEKIT", "false").strip().lower() != "true":
        return None
    private_key = os.getenv("IMAGEKIT_PRIVATE_KEY", "").strip()
    public_key = os.getenv("IMAGEKIT_PUBLIC_KEY", "").strip()
    url_endpoint = os.getenv("IMAGEKIT_URL_ENDPOINT", "").strip()
    if not private_key or not public_key or not url_endpoint:
        logger.warning("ImageKit upload skipped — credentials not configured.")
        return None
    try:
        from imagekitio import ImageKit

        return ImageKit(private_key=private_key)
    except Exception as exc:
        logger.warning("ImageKit client init failed: %s", exc)
        return None


def upload_image_bytes(data: bytes, filename: str) -> Optional[str]:
    """Upload raw PNG/JPEG *data* under a deterministic *filename*.

    Returns the CDN URL, or None when disabled, unconfigured, or failed
    (caller keeps base64 bytes in that case).
    """
    if not data:
        return None
    client = _get_client()
    if client is None:
        return None
    url_endpoint = os.getenv("IMAGEKIT_URL_ENDPOINT", "").strip()
    try:
        result = client.files.upload(
            file=data,
            file_name=filename,
            folder=_IMAGEKIT_FOLDER,
            use_unique_file_name=False,
            overwrite_file=True,
            tags=["gate-mentor", "diagram"],
        )
        cdn_url = getattr(result, "url", None)
        if not cdn_url and url_endpoint:
            file_path = getattr(result, "file_path", None) or f"{_IMAGEKIT_FOLDER}/{filename}"
            cdn_url = url_endpoint.rstrip("/") + "/" + file_path.lstrip("/")
        if cdn_url:
            logger.info("ImageKit upload OK: %s", filename)
            return cdn_url
        logger.warning("ImageKit upload returned no URL for %s: %s", filename, result)
        return None
    except Exception as exc:
        logger.warning("ImageKit upload failed for %s: %s", filename, exc)
        return None
