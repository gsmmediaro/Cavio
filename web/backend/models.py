"""Pydantic schemas for the Caries Screening API."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]


class AnalysisResult(BaseModel):
    filename: str
    suspicion_level: str
    overall_confidence: float
    detections: List[Detection]
    annotated_image_url: str
    modality: str
    model_name: str = ""
    num_detections: int
    turnaround_s: float
    credits_remaining: Optional[int] = None


class ScanRecord(BaseModel):
    id: int
    timestamp: str
    filename: str
    patient_name: str = ""
    suspicion: str
    confidence: float
    detections_count: int
    modality: str
    turnaround_s: float


class PatientSummary(BaseModel):
    name: str
    scan_count: int
    last_scan: str
    worst_suspicion: str


class DailyStats(BaseModel):
    total: int = 0
    high: int = 0
    review: int = 0
    avg_turnaround: float = 0.0
