import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SMSInteraction(Base):
    __tablename__ = "sms_interactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("farmers.id"), nullable=True, index=True
    )
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    inbound_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    inbound_media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    outbound_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diagnoses.id"), nullable=True
    )
    intent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )