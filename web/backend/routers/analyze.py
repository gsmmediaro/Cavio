"""POST /api/analyze — image upload and inference."""

import asyncio
import logging
import time
import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from web.backend.config import get_settings, max_upload_bytes
from web.backend.models import AnalysisResult, Detection
from web.backend.security import (
    Actor,
    audit_analyze,
    client_ip,
    enforce_analyze_limits,
    enforce_auth_if_required,
    inference_semaphore,
    purge_expired_results,
    resolve_actor,
    sanitize_upload_filename,
    validate_image_bytes,
    validate_image_dimensions,
    validate_upload_meta,
)
from web.backend.services import inference

router = APIRouter()
logger = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).resolve().parent.parent / "static" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MODALITIES = {"auto", "bitewing", "panoramic"}


class InferenceBusy(Exception):
    """Raised when the inference concurrency cap is reached."""


def _request_id() -> str:
    """Return a short opaque request identifier."""
    return uuid.uuid4().hex[:16]


def _safe_conf(value: float) -> float:
    """Clamp confidence to the supported analysis range."""
    return min(0.95, max(0.05, float(value)))


def _safe_modality(value: str) -> str:
    """Normalize modality; unknown values fall back to Auto."""
    raw = (value or "Auto").strip()
    if raw.lower() not in ALLOWED_MODALITIES:
        return "Auto"
    if raw.lower() == "auto":
        return "Auto"
    return raw[:1].upper() + raw[1:].lower()


def _annotated_url(request: Request, filename: str) -> str:
    """Build a results URL, honoring HTTPS termination."""
    url = str(request.base_url).rstrip("/") + f"/static/results/{filename}"
    forwarded = request.headers.get("x-forwarded-proto", "").lower()
    if forwarded == "https" and url.startswith("http://"):
        url = url.replace("http://", "https://", 1)
    return url


@router.post("/api/analyze", response_model=AnalysisResult)
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    model_path: str = Form("auto"),
    conf_threshold: float = Form(0.25),
    modality: str = Form("Auto"),
    use_tooth_assignment: bool = Form(False),
    patient_name: str = Form(""),
):
    """Run caries screening on an uploaded radiograph."""
    del patient_name  # accepted for API compat; never logged or stored
    start = time.time()
    settings = get_settings()
    request_id = _request_id()
    ip = client_ip(request, settings)
    actor: Actor | None = None
    status = "error"
    extra: dict = {"bytes": 0}

    try:
        actor = resolve_actor(request, settings)
        enforce_auth_if_required(actor, settings)
        enforce_analyze_limits(actor, ip, settings)

        validate_upload_meta(file.filename, file.content_type)
        max_bytes = max_upload_bytes(settings)
        contents = await file.read(max_bytes + 1)
        extra["bytes"] = len(contents)
        validate_image_bytes(contents, settings)

        np_buf = np.frombuffer(contents, dtype=np.uint8)
        image = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(
                status_code=400,
                detail="Could not decode image",
            )

        height, width = image.shape[:2]
        extra["w"] = width
        extra["h"] = height
        validate_image_dimensions(width, height, settings)

        resolved = inference.resolve_model_ref(model_path)
        if resolved is None:
            raise HTTPException(
                status_code=400,
                detail="Unknown model",
            )
        if resolved == "auto":
            resolved = inference.pick_model_for_image(height, width)
            if resolved is None:
                raise HTTPException(
                    status_code=400,
                    detail="No trained models found",
                )

        model_id = inference.model_public_id(resolved)
        extra["model"] = model_id

        timeout_s = max(1.0, settings.inference_timeout_s)
        sem = inference_semaphore(settings)

        def _run() -> dict:
            acquired = sem.acquire(blocking=False)
            if not acquired:
                raise InferenceBusy()
            try:
                return inference.run_analysis(
                    image_array=image,
                    model_path=resolved,
                    conf_threshold=_safe_conf(conf_threshold),
                    modality=_safe_modality(modality),
                    use_tooth_assignment=use_tooth_assignment,
                )
            finally:
                sem.release()

        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(_run),
                timeout=timeout_s,
            )
        except InferenceBusy as exc:
            raise HTTPException(
                status_code=503,
                detail="Server is busy. Try again shortly.",
            ) from exc
        except (TimeoutError, asyncio.TimeoutError) as exc:
            raise HTTPException(
                status_code=504,
                detail="Analysis timed out",
            ) from exc

        img_id = uuid.uuid4().hex[:12]
        img_filename = f"{img_id}.jpg"
        img_path = RESULTS_DIR / img_filename
        # Re-encode via OpenCV (no EXIF / no original metadata).
        written = cv2.imwrite(str(img_path), result["annotated_image"])
        if not written:
            raise HTTPException(
                status_code=500,
                detail="Could not store analysis result",
            )
        purge_expired_results(RESULTS_DIR, settings.results_ttl_hours)

        turnaround = round(time.time() - start, 2)
        extra["turnaround_s"] = turnaround
        extra["detections"] = result["num_detections"]
        status = "ok"

        detections = [
            Detection(
                class_name=d["class"],
                confidence=d["confidence"],
                bbox=list(d["bbox"]),
            )
            for d in result["detections"]
        ]

        safe_name = sanitize_upload_filename(file.filename)
        return AnalysisResult(
            filename=safe_name,
            suspicion_level=result["suspicion_level"],
            overall_confidence=result["overall_confidence"],
            detections=detections,
            annotated_image_url=_annotated_url(request, img_filename),
            modality=result["modality"],
            model_name=model_id,
            num_detections=result["num_detections"],
            turnaround_s=turnaround,
        )
    except HTTPException as exc:
        status = f"http_{exc.status_code}"
        raise
    except Exception:
        logger.exception("analyze failed request_id=%s", request_id)
        status = "error"
        raise HTTPException(
            status_code=500,
            detail="Analysis failed",
        )
    finally:
        if actor is not None:
            extra["duration_ms"] = int((time.time() - start) * 1000)
            audit_analyze(
                request_id,
                actor,
                ip,
                status,
                extra,
                settings,
            )
