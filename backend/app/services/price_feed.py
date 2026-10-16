"""Indicative market prices — keeps the Prices tab current until a live feed exists.

For each crop × market, adds any missing days up to today, continuing a
mean-reverting random walk from the last recorded price. Idempotent: running
it twice in a day adds nothing. Rows are tagged source="indicative".

Runs automatically in the API (startup + every 12 hours) when
AUTO_INDICATIVE_PRICES is true, and manually via scripts/seed_market_prices.py.
"""
import asyncio
import logging
import random
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, text

from app.models.crop import Crop
from app.models.market_price import MarketPrice

logger = logging.getLogger("agrosense.prices")

MARKETS = [
    ("Kumasi Central Market", "Ashanti"),
    ("Techiman Market", "Bono East"),
    ("Makola Market", "Greater Accra"),
    ("Tamale Central Market", "Northern"),
    ("Kaneshie Market", "Greater Accra"),
]

BASE_PRICES_GHS_PER_KG = {
    "Tomato": Decimal("8.50"),
    "Pepper, bell": Decimal("12.00"),
    "Potato": Decimal("6.00"),
    "Corn (maize)": Decimal("4.50"),
    "Orange": Decimal("5.50"),
    "Apple": Decimal("18.00"),
    "Strawberry": Decimal("25.00"),
    "Grape": Decimal("22.00"),
    "Peach": Decimal("15.00"),
    "Squash": Decimal("7.00"),
}
# Markets nearer production zones sell cheaper.
MARKET_FACTOR = {
    "Kumasi Central Market": 0.97,
    "Techiman Market": 0.90,
    "Makola Market": 1.08,
    "Tamale Central Market": 0.94,
    "Kaneshie Market": 1.05,
}
BAG_KG = {"Corn (maize)": 100, "Tomato": 52, "Potato": 50, "Pepper, bell": 40, "Orange": 90}
MAX_BACKFILL_DAYS = 400  # never generate more than this per series in one go

_LOCK_ID = 727274  # arbitrary, stable advisory-lock key


def _q(x: float) -> Decimal:
    return Decimal(str(round(max(x, 0.5), 2)))


async def top_up_prices(session_factory, backfill_days: int = 30) -> int:
    """Add missing daily rows up to today. Returns the number of rows added."""
    rng = random.Random()
    today = datetime.now(timezone.utc).date()
    added = 0
    async with session_factory() as db:
        is_pg = db.bind.dialect.name == "postgresql"
        if is_pg:
            # Only one worker/instance tops up at a time. Transaction-scoped, so it is
            # released on commit/rollback even behind Supabase's connection pooler.
            got = (await db.execute(text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": _LOCK_ID})).scalar()
            if not got:
                return 0
        crops = {c.name: c for c in (await db.execute(select(Crop))).scalars().all()}
        for crop_name, base in BASE_PRICES_GHS_PER_KG.items():
            crop = crops.get(crop_name)
            if not crop:
                continue
            for market, region in MARKETS:
                last = (
                    await db.execute(
                        select(MarketPrice)
                        .where(MarketPrice.crop_id == crop.id, MarketPrice.market_name == market)
                        .order_by(MarketPrice.recorded_at.desc())
                        .limit(1)
                    )
                ).scalar_one_or_none()
                anchor = float(base) * MARKET_FACTOR.get(market, 1.0)
                if last:
                    start = last.recorded_at.date() + timedelta(days=1)
                    price = float(last.price_per_kg or base)
                else:
                    start = today - timedelta(days=backfill_days)
                    price = anchor
                start = max(start, today - timedelta(days=MAX_BACKFILL_DAYS))
                prev = price
                d = start
                while d <= today:
                    price = price + (anchor - price) * 0.08 + price * rng.gauss(0, 0.025)
                    change = (price - prev) / prev if prev else 0
                    trend = "up" if change > 0.01 else "down" if change < -0.01 else "stable"
                    db.add(MarketPrice(
                        crop_id=crop.id,
                        market_name=market,
                        region=region,
                        price_per_kg=_q(price),
                        price_per_bag=_q(price * BAG_KG.get(crop_name, 50)),
                        price_trend=trend,
                        recorded_at=datetime.combine(d, time(9, 0), tzinfo=timezone.utc),
                        source="indicative",
                    ))
                    prev = price
                    added += 1
                    d += timedelta(days=1)
        await db.commit()
    return added


async def run_forever(session_factory, every_hours: float = 12.0) -> None:
    """Background loop used by the API process."""
    await asyncio.sleep(5)  # let startup finish first
    while True:
        try:
            n = await top_up_prices(session_factory)
            if n:
                logger.info("Indicative prices: added %d rows", n)
        except Exception:
            logger.exception("Indicative price top-up failed")
        await asyncio.sleep(every_hours * 3600)
