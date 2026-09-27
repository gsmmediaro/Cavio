"""POST /api/analyze â€” image upload and inference (hardened)."""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from web.backend.auth import AuthUser, require_user_if_auth_required
from web.backend.config import get_settings
from web.backend.models import AnalysisResult, Detection
from web.backend.rate_limit import client_key, limiter
from web.backend.services import credits as credits_service
from web.backend.services import inference
from web.backend.upload_validation import read_and_validate_upload
from web.backend.services.result_urls import append_result_signature

router = APIRouter()
logger = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).resolve().parent.parent / 'static' / 'results'
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_allowed_model(model_path: str) -> str:
    allowed = {str(Path(p).resolve()) for p in inference.find_models()}
    if model_path == 'auto':
        return model_path
    candidate = str(Path(model_path).resolve())
    if candidate not in allowed:
        raise HTTPException(status_code=400, detail='Invalid model_path')
    return candidate


@router.post('/api/analyze', response_model=AnalysisResult)
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    model_path: str = Form('auto'),
    conf_threshold: float = Form(0.25),
    modality: str = Form('Auto'),
    use_tooth_assignment: bool = Form(False),
    patient_name: str = Form(''),
    user: Optional[AuthUser] = Depends(require_user_if_auth_required),
):
    settings = get_settings()
    rate_key = client_key(request, user.uid if user else 'anon')
    limiter.check(rate_key)

    if settings.auth_required and user is None:
        raise HTTPException(status_code=401, detail='Authentication required')

    if not 0.01 <= float(conf_threshold) <= 1.0:
        raise HTTPException(status_code=400, detail='conf_threshold out of range')

    if user is not None and settings.scan_credit_cost > 0:
        balance = credits_service.get_balance(user.uid)
        if balance < settings.scan_credit_cost:
            raise HTTPException(
                status_code=402,
                detail='Insufficient credits. Purchase a credit pack to continue.',
            )

    start = time.time()
    contents = await read_and_validate_upload(file)
    np_buf = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail='Could not decode image')

    model_path = _resolve_allowed_model(model_path)

    if model_path == 'auto':
        h, w = image.shape[:2]
        auto_model_path = inference.pick_model_for_image(h, w)
        if auto_model_path is None:
            raise HTTPException(status_code=400, detail='No trained models found')
        model_path = auto_model_path
        logger.info('Auto-selected model: %s', Path(model_path).parent.parent.name)

    model_name = Path(model_path).parent.parent.name

    credits_remaining = None
    if user is not None and settings.scan_credit_cost > 0:
        try:
            credits_remaining = credits_service.deduct_scan_credit(user.uid)
        except ValueError:
            raise HTTPException(
                status_code=402,
                detail='Insufficient credits. Purchase a credit pack to continue.',
            ) from None

    result = inference.run_analysis(
        image_array=image,
        model_path=model_path,
        conf_threshold=conf_threshold,
        modality=modality,
        use_tooth_assignment=use_tooth_assignment,
    )

    img_id = uuid.uuid4().hex[:12]
    img_filename = f'{img_id}.jpg'
    img_path = RESULTS_DIR / img_filename
    cv2.imwrite(str(img_path), result['annotated_image'])
    base = str(request.base_url).rstrip('/')
    annotated_url = f'{base}/static/results/{img_filename}'
    forwarded_proto = request.headers.get('x-forwarded-proto', '').lower()
    if forwarded_proto == 'https' and annotated_url.startswith('http://'):
        annotated_url = annotated_url.replace('http://', 'https://', 1)
    annotated_url = append_result_signature(annotated_url, img_filename)

    turnaround = round(time.time() - start, 2)

    detections = [
        Detection(
            class_name=d['class'],
            confidence=d['confidence'],
            bbox=list(d['bbox']),
        )
        for d in result['detections']
    ]

    return AnalysisResult(
        filename=file.filename or 'unknown',
        suspicion_level=result['suspicion_level'],
        overall_confidence=result['overall_confidence'],
        detections=detections,
        annotated_image_url=annotated_url,
        modality=result['modality'],
        model_name=model_name,
        num_detections=result['num_detections'],
        turnaround_s=turnaround,
        credits_remaining=credits_remaining,
    )


