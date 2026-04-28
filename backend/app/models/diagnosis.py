import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("farmers.id"), nullable=False, index=True
    )
    crop_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crops.id"), nullable=True
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    predicted_disease_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diseases.id"), nullable=True
    )
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    all_predictions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    treatment_advice: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    gps_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    channel: Mapped[str] = mapped_column(String(10), default="app", nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="completed", nullable=False
    )
    processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True
    )