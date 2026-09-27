"""Model loading, YOLO inference, and suspicion classification (no Streamlit)."""

import glob as globmod
import logging
import os
from enum import Enum
from pathlib import Path
from typing import List

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

logger = logging.getLogger(__name__)

_model_cache: dict = {}


class SuspicionLevel(Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    REVIEW = "REVIEW"


def find_models() -> list[str]:
    """Find model weights from default path and optional env overrides.

    Supported environment variables:
    - MODEL_PATHS: comma-separated explicit .pt paths
    - MODELS_DIR: directory to search recursively for best.pt files
    - MODELS_GLOB: custom glob pattern for model discovery
    """
    candidates: set[str] = set()

    default_glob = (
        PROJECT_ROOT
        / "runs"
        / "detect"
        / "runs"
        / "dental"
        / "*"
        / "weights"
        / "best.pt"
    )
    for path in globmod.glob(str(default_glob)):
        if Path(path).is_file():
            candidates.add(str(Path(path).resolve()))

    custom_glob = os.getenv("MODELS_GLOB", "").strip()
    if custom_glob:
        for path in globmod.glob(custom_glob):
            if Path(path).is_file():
                candidates.add(str(Path(path).resolve()))

    models_dir = os.getenv("MODELS_DIR", "").strip()
    if models_dir:
        root = Path(models_dir)
        if root.exists():
            for path in root.rglob("best.pt"):
                if path.is_file():
                    candidates.add(str(path.resolve()))

    model_paths = os.getenv("MODEL_PATHS", "").strip()
    if model_paths:
        for raw in model_paths.split(","):
            path = Path(raw.strip())
            if path.is_file():
                candidates.add(str(path.resolve()))

    models = sorted(candidates)
    if not models:
        logger.warning(
            "No model weights found. Checked default path and env vars "
            "MODEL_PATHS/MODELS_DIR/MODELS_GLOB."
        )
    return models


def model_public_id(model_path: str) -> str:
    """Return a non-filesystem identifier for a weights path."""
    return Path(model_path).parent.parent.name


def resolve_model_ref(ref: str) -> str | None:
    """Map a public model id or allowlisted path to local weights.

    Rejects arbitrary filesystem paths that are not discovered models.
    """
    if not ref or not ref.strip():
        return None
    requested = ref.strip()
    if requested.lower() == "auto":
        return "auto"

    models = find_models()
    by_id: dict[str, str] = {}
    allowed_paths: set[str] = set()
    for path in models:
        allowed_paths.add(path)
        public_id = model_public_id(path)
        by_id.setdefault(public_id, path)

    if requested in by_id:
        return by_id[requested]
    if requested in allowed_paths:
        return requested

    try:
        resolved = str(Path(requested).resolve())
    except (OSError, RuntimeError):
        return None
    if resolved in allowed_paths:
        return resolved
    return None


def pick_model_for_image(height: int, width: int) -> str | None:
    """Auto-select model based on image aspect ratio.

    Panoramic X-rays are very wide (ratio > 1.5).
    Bitewing X-rays are squarish or mildly wide.
    """
    models = find_models()
    if not models:
        return None

    ratio = width / max(height, 1)
    is_pano = ratio > 1.5

    for m in models:
        name = Path(m).parent.parent.name.lower()
        if is_pano and ("pano" in name or "dentex" in name):
            return m
        if not is_pano and "bitewing" in name:
            return m

    return models[0]


def load_model(model_path: str):
    """Load a YOLO model with simple dict cache."""
    if model_path not in _model_cache:
        from ultralytics import YOLO

        _model_cache[model_path] = YOLO(model_path)
    return _model_cache[model_path]


def classify_suspicion(detections: List[dict]) -> SuspicionLevel:
    if not detections:
        return SuspicionLevel.LOW
    confs = [d["confidence"] for d in detections]
    max_conf = max(confs)
    n = len(confs)
    if all(c < 0.30 for c in confs):
        return SuspicionLevel.REVIEW
    if n >= 2 and max_conf >= 0.70:
        return SuspicionLevel.HIGH
    if n >= 1 and max_conf >= 0.40:
        return SuspicionLevel.MODERATE
    return SuspicionLevel.REVIEW


def detect_modality(model_path: str) -> str:
    lower = model_path.lower()
    if "bitewing" in lower:
        return "Bitewing"
    if "pano" in lower or "dentex" in lower:
        return "Panoramic"
    return "Unknown"


def run_analysis(
    image_array: np.ndarray,
    model_path: str,
    conf_threshold: float = 0.25,
    modality: str = "Auto",
    use_tooth_assignment: bool = False,
) -> dict:
    """Run the full inference pipeline on a single image."""
    model = load_model(model_path)
    results = model.predict(image_array, conf=conf_threshold, verbose=False)

    detections: List[dict] = []
    boxes = results[0].boxes
    names_map = results[0].names
    if boxes is not None and len(boxes) > 0:
        xyxy_list = boxes.xyxy.tolist()
        cls_ids = boxes.cls.tolist()
        confs = boxes.conf.tolist()
        for (x1, y1, x2, y2), class_id, score in zip(xyxy_list, cls_ids, confs):
            detections.append(
                {
                    "class": names_map.get(int(class_id), str(int(class_id))),
                    "class_id": int(class_id),
                    "confidence": round(float(score), 3),
                    "bbox": (float(x1), float(y1), float(x2), float(y2)),
                }
            )

    resolved_modality = modality if modality != "Auto" else detect_modality(model_path)

    tooth_predictions = []
    if detections:
        try:
            from dental_tooth_caries_ai.tooth_level.assign_lesions_to_teeth import (
                make_direct_tooth_predictions,
            )

            class_names = list(names_map.values())
            tooth_predictions = make_direct_tooth_predictions(detections, class_names)

            if use_tooth_assignment and resolved_modality == "Bitewing":
                try:
                    from dental_tooth_caries_ai.tooth_level.tooth_proposals import (
                        propose_teeth_heuristic,
                    )
                    from dental_tooth_caries_ai.tooth_level.assign_lesions_to_teeth import (
                        assign_lesions_to_teeth,
                    )

                    teeth = propose_teeth_heuristic(image_array)
                    if teeth:
                        lesion_boxes = [d["bbox"] for d in detections]
                        lesion_classes = [d["class"] for d in detections]
                        lesion_confs = [d["confidence"] for d in detections]
                        tooth_predictions = assign_lesions_to_teeth(
                            teeth,
                            lesion_boxes,
                            lesion_classes,
                            lesion_confs,
                        )
                except Exception as e:
                    logger.warning("Tooth assignment failed, using direct: %s", e)
        except Exception as e:
            logger.warning("Tooth prediction failed: %s", e)

    annotated_image = None
    if tooth_predictions:
        try:
            from dental_tooth_caries_ai.tooth_level.render_overlays import (
                render_overlay,
            )

            annotated_image = render_overlay(image_array, tooth_predictions)
        except Exception:
            annotated_image = results[0].plot()
    else:
        annotated_image = results[0].plot()

    suspicion = classify_suspicion(detections)
    overall_conf = max((d["confidence"] for d in detections), default=0.0)

    return {
        "detections": detections,
        "tooth_predictions": tooth_predictions,
        "annotated_image": annotated_image,
        "suspicion_level": suspicion.value,
        "overall_confidence": round(overall_conf, 3),
        "modality": resolved_modality,
        "num_detections": len(detections),
    }
