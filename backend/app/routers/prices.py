"""Market prices router."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.crop import Crop
from app.models.market_price import MarketPrice
from app.schemas.market_price import (
    MarketPriceResponse,
    PriceTrendPoint,
    PriceTrendResponse,
)


router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("", response_model=list[MarketPriceResponse])
async def list_prices(
    crop_id: UUID | None = Query(None),
    region: str | None = Query(None),
    market: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List the most recent price entries, optionally filtered."""
    stmt = select(MarketPrice, Crop.name).join(Crop, Crop.id == MarketPrice.crop_id)

    if crop_id:
        stmt = stmt.where(MarketPrice.crop_id == crop_id)
    if region:
        stmt = stmt.where(MarketPrice.region.ilike(f"%{region}%"))
    if market:
        stmt = stmt.where(MarketPrice.market_name.ilike(f"%{market}%"))

    stmt = stmt.order_by(MarketPrice.recorded_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).all()

    return [
        MarketPriceResponse(
            id=mp.id,
            crop_id=mp.crop_id,
            crop_name=crop_name,
            market_name=mp.market_name,
            region=mp.region,
            price_per_bag=mp.price_per_bag,
            price_per_kg=mp.price_per_kg,
            price_trend=mp.price_trend,
            recorded_at=mp.recorded_at,
            source=mp.source,
        )
        for mp, crop_name in rows
    ]


@router.get("/trends/{crop_id}", response_model=PriceTrendResponse)
async def price_trend(
    crop_id: UUID,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """30-day price trend for a crop."""
    crop = (await db.execute(select(Crop).where(Crop.id == crop_id))).scalar_one_or_none()
    if not crop:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Crop not found")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(MarketPrice)
        .where(MarketPrice.crop_id == crop_id, MarketPrice.recorded_at >= since)
        .order_by(MarketPrice.recorded_at.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    points = [
        PriceTrendPoint(
            date=mp.recorded_at,
            price_per_kg=mp.price_per_kg or Decimal("0"),
            market_name=mp.market_name,
        )
        for mp in rows if mp.price_per_kg is not None
    ]

    avg = (
        sum(p.price_per_kg for p in points) / len(points)
        if points else None
    )

    return PriceTrendResponse(
        crop_id=crop.id,
        crop_name=crop.name,
        points=points,
        average_per_kg=avg,
    )