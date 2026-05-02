from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class MarketPriceResponse(BaseModel):
    id: UUID
    crop_id: UUID
    crop_name: str
    market_name: str
    region: str | None = None
    price_per_bag: Decimal | None = None
    price_per_kg: Decimal | None = None
    price_trend: str | None = None
    recorded_at: datetime
    source: str | None = None

    class Config:
        from_attributes = True


class PriceTrendPoint(BaseModel):
    date: datetime
    price_per_kg: Decimal
    market_name: str


class PriceTrendResponse(BaseModel):
    crop_id: UUID
    crop_name: str
    points: list[PriceTrendPoint]
    average_per_kg: Decimal | None = None