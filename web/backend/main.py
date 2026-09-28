"""FastAPI application for Caries Screening."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from web.backend.auth import AuthUser, get_current_user
from web.backend.routers import analyze, auth_api, billing
from web.backend.services import credits as credits_service
from web.backend.services import inference
from web.backend.services.result_urls import append_result_signature, verify_result_signature

STATIC_DIR = Path(__file__).resolve().parent / 'static'
RESULTS_DIR = STATIC_DIR / 'results'
STATIC_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

LOGGER = logging.getLogger(__name__)

MODEL_DISPLAY_NAMES: dict[str, str] = {
    'pano_caries_only_gpu2': 'Panoramic',
    'pano_gpu2': 'Panoramic',
    'bitewing_caries_only': 'Bitewing',
    'bitewing': 'Bitewing',
    'pano_caries_roboflow_v1': 'Kiwi',
    'pano_dc1000_potato': 'Kiwi',
    'potato': 'Kiwi',
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    credits_service.init_db()
    models = inference.find_models()
    if models:
        inference.load_model(models[0])
    yield


app = FastAPI(title='Caries Screening API', lifespan=lifespan)


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(',') if item.strip()]


origins = _split_csv(
    os.getenv(
        'CORS_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173',
    )
)

for key in ('FRONTEND_ORIGIN', 'FRONTEND_URL'):
    value = (os.getenv(key) or '').strip().rstrip('/')
    if value and value not in origins:
        origins.append(value)

origin_regex = os.getenv('CORS_ORIGIN_REGEX')
if origin_regex is None:
    origin_regex = r'^https://([a-zA-Z0-9-]+\.)?vercel\.app$'
else:
    origin_regex = origin_regex.strip() or None

LOGGER.info('CORS config loaded origins=%s origin_regex=%s', origins, origin_regex)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex if origin_regex else None,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
)


@app.get('/static/results/{filename}')
async def get_signed_result(
    filename: str,
    sig: str = Query(''),
    exp: str = Query(''),
):
    """Serve analysis result images only with a short-lived HMAC signature."""
    if '/' in filename or '\\' in filename or '..' in filename or not filename.endswith(('.jpg', '.jpeg', '.png', '.webp')):
        raise HTTPException(status_code=404, detail='Not found')
    if not verify_result_signature(filename, sig=sig, exp=exp):
        raise HTTPException(status_code=401, detail='Invalid or expired result token')
    path = RESULTS_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail='Not found')
    return FileResponse(path, media_type='image/jpeg')



@app.get('/api/results/{filename}/url')
async def refresh_result_url(
    filename: str,
    request: Request,
    user: AuthUser = Depends(get_current_user),
):
    """Re-issue a short-lived signed URL for a result image that still exists on disk.

    Past scans store annotated URLs in Firestore; those signatures expire after
    ~15 minutes. Authenticated clients call this to reopen saved scans locally
    (and on hosts where result files persist).
    """
    _ = user  # auth gate only; result files are opaque UUIDs
    if '/' in filename or '\\' in filename or '..' in filename or not filename.endswith(('.jpg', '.jpeg', '.png', '.webp')):
        raise HTTPException(status_code=404, detail='Not found')
    path = RESULTS_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail='Saved scan image is no longer available')
    base = str(request.base_url).rstrip('/')
    annotated_url = f'{base}/static/results/{filename}'
    forwarded_proto = request.headers.get('x-forwarded-proto', '').lower()
    if forwarded_proto == 'https' and annotated_url.startswith('http://'):
        annotated_url = annotated_url.replace('http://', 'https://', 1)
    annotated_url = append_result_signature(annotated_url, filename)
    return {'url': annotated_url, 'filename': filename}


app.include_router(analyze.router)
app.include_router(auth_api.router)
app.include_router(billing.router)


@app.get('/api/health')
async def health():
    return {'ok': True}


@app.get('/api/models')
async def list_models():
    models = inference.find_models()
    result = []
    for m in models:
        raw_name = Path(m).parent.parent.name
        display = MODEL_DISPLAY_NAMES.get(raw_name, raw_name)
        result.append({'path': m, 'name': display})
    return result
