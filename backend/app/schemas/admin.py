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