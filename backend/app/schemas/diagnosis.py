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
    image_url: str | None = None
    predicted_disease: str
    confidence: float
    is_healthy: bool
    top_predictions: list[PredictionItem]
    treatment_advice: TreatmentAdvice | None = None
    processing_time_ms: int
    created_at: datetime
    # True when the model isn't confident; the app shows a "retake" prompt.
    low_confidence: bool = False
    # False when the selected crop isn't one the model was trained on.
    crop_supported: bool = True
    advice_source: str = "ai"  # ai | curated
    guide_slug: str | None = None

    class Config:
        from_attributes = True