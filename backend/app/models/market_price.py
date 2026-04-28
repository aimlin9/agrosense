import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MarketPrice(Base):
    __tablename__ = "market_prices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    crop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crops.id"), nullable=False, index=True
    )
    market_name: Mapped[str] = mapped_column(String(150), nullable=False)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    price_per_bag: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    price_per_kg: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    price_trend: Mapped[str | None] = mapped_column(String(10), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    source: Mapped[str | None] = mapped_column(String(200), nullable=True)