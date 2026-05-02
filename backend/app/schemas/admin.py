from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AdminFarmerListItem(BaseModel):
    id: UUID
    phone_number: str
    full_name: str | None = None
    region: str | None = None
    primary_crop: str | None = None
    is_sms_user: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdminDiagnosisListItem(BaseModel):
    id: UUID
    farmer_id: UUID
    farmer_phone: str
    crop_name: str
    predicted_disease: str | None = None
    confidence_score: float
    is_healthy: bool
    channel: str
    created_at: datetime


class TopDisease(BaseModel):
    disease_name: str
    count: int


class AdminStats(BaseModel):
    total_farmers: int
    total_diagnoses: int
    diagnoses_today: int
    diagnoses_last_7_days: int
    healthy_pct: float
    top_diseases: list[TopDisease]

class FarmerDetailDiagnosis(BaseModel):
    id: UUID
    crop_name: str
    predicted_disease: str | None = None
    confidence_score: float
    is_healthy: bool
    image_url: str
    created_at: datetime


class FarmerDetail(BaseModel):
    id: UUID
    phone_number: str
    full_name: str | None = None
    region: str | None = None
    district: str | None = None
    primary_crop: str | None = None
    is_sms_user: bool
    created_at: datetime
    total_diagnoses: int
    recent_diagnoses: list[FarmerDetailDiagnosis]


class ExpertReviewRequest(BaseModel):
    is_ai_correct: bool
    correct_disease_id: UUID | None = None
    expert_notes: str | None = None


class ExpertReviewResponse(BaseModel):
    id: UUID
    diagnosis_id: UUID
    reviewer_id: UUID
    is_ai_correct: bool | None = None
    correct_disease_id: UUID | None = None
    expert_notes: str | None = None
    reviewed_at: datetime

    class Config:
        from_attributes = True