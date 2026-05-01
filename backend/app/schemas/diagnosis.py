from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PredictionItem(BaseModel):
    class_name: str
    display_name: str | None = None
    confidence: float


class TreatmentAdvice(BaseModel):
    severity: str
    summary: str
    immediate_actions: list[str]
    organic_treatment: str | None = None
    chemical_treatment: str | None = None
    prevention: str | None = None


class DiagnosisResponse(BaseModel):
    id: UUID
    crop_name: str
    image_url: str
    predicted_disease: str
    confidence: float
    is_healthy: bool
    top_predictions: list[PredictionItem]
    treatment_advice: TreatmentAdvice | None = None
    processing_time_ms: int
    created_at: datetime

    class Config:
        from_attributes = True