import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Disease(Base):
    __tablename__ = "diseases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    crop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crops.id"), nullable=False
    )
    model_class_name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment_organic: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment_chemical: Mapped[str | None] = mapped_column(Text, nullable=True)
    prevention_tips: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_yield_loss: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_contagious: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)