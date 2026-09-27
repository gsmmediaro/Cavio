"""Defensive upload validation (size, type, magic bytes)."""

from __future__ import annotations

from fastapi import HTTPException, UploadFile, status

from web.backend.config import get_settings

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/bmp",
    "image/tiff",
    "image/x-ms-bmp",
    "application/octet-stream",  # browsers sometimes omit type; magic checked below
}

# Magic byte signatures for allowed raster formats
_SIGNATURES = (
    (b"\xff\xd8\xff", "jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"BM", "bmp"),
    (b"II*\x00", "tiff"),
    (b"MM\x00*", "tiff"),
)


def _matches_magic(data: bytes) -> bool:
    return any(data.startswith(sig) for sig, _ in _SIGNATURES)


async def read_and_validate_upload(file: UploadFile) -> bytes:
    """Read upload with size cap and basic content checks. Raises 413/400."""
    settings = get_settings()
    max_bytes = settings.max_upload_bytes

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content type: {content_type}",
        )

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 64)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"File too large (max {max_bytes} bytes)",
            )
        chunks.append(chunk)

    data = b"".join(chunks)
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if not _matches_magic(data):
        raise HTTPException(
            status_code=400,
            detail="File does not look like a supported image (JPEG/PNG/BMP/TIFF)",
        )
    return data
