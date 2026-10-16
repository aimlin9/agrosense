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
from app.services.catalog import crop_display_name
from app.schemas.market_price import (
    LatestPrice,
    MarketPriceResponse,
    PriceTrendPoint,
    PriceTrendResponse,
)


router = APIRouter(prefix="/api/prices", tags=["prices"])


def _trend(change_pct: float | None) -> str:
    if change_pct is None or abs(change_pct) < 2.0:
        return "stable"
    return "up" if change_pct > 0 else "down"


@router.get("/latest", response_model=list[LatestPrice])
async def latest_prices(
    crop_id: UUID | None = Query(None),
    region: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Latest price per crop × market, with real 7-day change and a short
    daily history for sparklines. This is what the app's Prices tab shows."""
    since = datetime.now(timezone.utc) - timedelta(days=21)
    stmt = (
        select(MarketPrice, Crop.name)
        .join(Crop, Crop.id == MarketPrice.crop_id)
        .where(MarketPrice.price_per_kg.is_not(None))
        .order_by(MarketPrice.recorded_at.asc())
    )
    if crop_id:
        stmt = stmt.where(MarketPrice.crop_id == crop_id)
    if region:
        stmt = stmt.where(MarketPrice.region.ilike(f"%{region}%"))

    rows = (await db.execute(stmt.where(MarketPrice.recorded_at >= since))).all()
    if not rows:
        # Data older than three weeks: still show the most recent we have.
        rows = (await db.execute(stmt)).all()

    series: dict[tuple, list[tuple[MarketPrice, str]]] = {}
    for mp, crop_name in rows:
        series.setdefault((mp.crop_id, mp.market_name), []).append((mp, crop_name))

    out: list[LatestPrice] = []
    for (_, _), points in series.items():
        # One point per calendar day (last reading wins).
        by_day: dict = {}
        for mp, crop_name in points:
            by_day[mp.recorded_at.date()] = (mp, crop_name)
        days = sorted(by_day)
        latest, crop_name = by_day[days[-1]]
        week_ago_target = days[-1] - timedelta(days=7)
        older = [d for d in days if d <= week_ago_target]
        change = None
        if older:
            base = by_day[older[-1]][0].price_per_kg
            if base:
                change = float((latest.price_per_kg - base) / base * 100)
        out.append(
            LatestPrice(
                crop_id=latest.crop_id,
                crop_name=crop_display_name(crop_name),
                market_name=latest.market_name,
                region=latest.region,
                price_per_kg=latest.price_per_kg,
                price_per_bag=latest.price_per_bag,
                change_pct_7d=round(change, 1) if change is not None else None,
                trend=_trend(change),
                recorded_at=latest.recorded_at,
                source=latest.source,
                history=[by_day[d][0].price_per_kg for d in days[-14:]],
            )
        )
    out.sort(key=lambda p: (p.crop_name, -float(p.price_per_kg)))
    return out


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
            crop_name=crop_display_name(crop_name),
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
        crop_name=crop_display_name(crop.name),
        points=points,
        average_per_kg=avg,
    )