"""Seed / top up indicative Ghanaian market prices.

Run from backend/:
    python -m scripts.seed_market_prices            # backfill 30 days, then top up to today
    python -m scripts.seed_market_prices --days 60

Idempotent: for each crop × market it only adds the days that are missing,
continuing a gentle random walk from the last recorded price. Running it once
a day (cron / Render job) keeps the Prices tab current until a live data feed
replaces it. Rows are tagged source="indicative".
"""
import argparse
import asyncio
import random
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models.crop import Crop
from app.models.market_price import MarketPrice

MARKETS = [
    ("Kumasi Central Market", "Ashanti"),
    ("Techiman Market", "Bono East"),
    ("Makola Market", "Greater Accra"),
    ("Tamale Central Market", "Northern"),
    ("Kaneshie Market", "Greater Accra"),
]

# Base prices in GHS per kg; markets nearer production zones sell cheaper.
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
MARKET_FACTOR = {
    "Kumasi Central Market": 0.97,
    "Techiman Market": 0.90,
    "Makola Market": 1.08,
    "Tamale Central Market": 0.94,
    "Kaneshie Market": 1.05,
}
BAG_KG = {"Corn (maize)": 100, "Tomato": 52, "Potato": 50, "Pepper, bell": 40, "Orange": 90}


def _q(x: float) -> Decimal:
    return Decimal(str(round(max(x, 0.5), 2)))


async def seed(days: int) -> None:
    rng = random.Random()
    today = datetime.now(timezone.utc).date()
    added = 0
    async with AsyncSessionLocal() as db:
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
                if last:
                    start = last.recorded_at.date() + timedelta(days=1)
                    price = float(last.price_per_kg or base)
                else:
                    start = today - timedelta(days=days)
                    price = float(base) * MARKET_FACTOR.get(market, 1.0)
                anchor = float(base) * MARKET_FACTOR.get(market, 1.0)
                prev = price
                d = start
                while d <= today:
                    # Random walk with mean reversion so prices stay plausible.
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
        total = (await db.execute(select(func.count(MarketPrice.id)))).scalar_one()
    print(f"Added {added} price rows ({total} total).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30)
    asyncio.run(seed(parser.parse_args().days))
