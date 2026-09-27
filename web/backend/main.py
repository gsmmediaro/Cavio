"""FastAPI application for Caries Screening."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from web.backend.config import get_settings, max_request_bytes
from web.backend.routers import analyze as analyze_router
from web.backend.routers.analyze import RESULTS_DIR
from web.backend.security import (
    client_ip,
    enforce_models_limits,
    resolve_under_dir,
)
from web.backend.services import inference

STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
LOGGER = logging.getLogger(__name__)

# Friendly display names for models (public ids only).
MODEL_DISPLAY_NAMES: dict[str, str] = {
    "pano_caries_only_gpu2": "Panoramic",
    "pano_gpu2": "Panoramic",
    "bitewing_caries_only": "Bitewing",
    "bitewing": "Bitewing",
    "pano_caries_roboflow_v1": "Kiwi",
    "pano_dc1000_potato": "Kiwi",
    "potato": "Kiwi",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload the first discovered model if weights exist."""
    models = inference.find_models()
    if models:
        inference.load_model(models[0])
    yield


app = FastAPI(title="Caries Screening API", lifespan=lifespan)

settings = get_settings()
LOGGER.info(
    "CORS config loaded origins=%s origin_regex=%s",
    list(settings.cors_origins),
    settings.cors_origin_regex,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "DELETE"],
    allow_headers=[
        "Accept",
        "Authorization",
        "Content-Type",
        "X-API-Key",
        "X-Trial-Token",
        "X-Requested-With",
    ],
)


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Reject oversized requests before reading the body."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            size = int(content_length)
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid Content-Length"},
            )
        if size > max_request_bytes():
            return JSONResponse(
                status_code=413,
                content={"detail": "Request too large"},
            )
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Return safe HTTP errors, preserving Retry-After when present."""
    del request
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc):
    """Return a generic validation error without raw payload echoes."""
    del request, exc
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid request"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc):
    """Hide internal errors from clients."""
    del exc
    LOGGER.exception("Unhandled error path=%s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(analyze_router.router)


@app.get("/api/models")
async def list_models(request: Request):
    """List available models without filesystem paths."""
    enforce_models_limits(client_ip(request))
    models = inference.find_models()
    result = []
    seen: set[str] = set()
    for weights in models:
        public_id = inference.model_public_id(weights)
        if public_id in seen:
            continue
        seen.add(public_id)
        display = MODEL_DISPLAY_NAMES.get(public_id, public_id)
        # `path` is a public id (not a filesystem path) for UI compat.
        result.append(
            {
                "id": public_id,
                "name": display,
                "path": public_id,
            }
        )
    return result


@app.get("/static/results/{filename}")
async def get_result_image(filename: str):
    """Serve annotated results; reject path traversal."""
    path = resolve_under_dir(RESULTS_DIR, filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, no-store"},
    )
