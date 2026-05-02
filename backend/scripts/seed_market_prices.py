"""Seed realistic Ghanaian market prices for the last 30 days.

Run from backend/:
    python -m scripts.seed_market_prices

Idempotent — checks for existing prices first.
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.crop import Crop
from app.models.market_price import MarketPrice


# Ghanaian markets with their regions
MARKETS = [
    ("Kumasi Central Market", "Ashanti"),
    ("Techiman Market", "Bono East"),
    ("Makola Market", "Greater Accra"),
    ("Tamale Central Market", "Northern"),
    ("Kaneshie Market", "Greater Accra"),
]

# Realistic base prices in GHS per kg for common crops
BASE_PRICES_GHS_PER_KG = {
    "Tomato": Decimal("8.50"),
    "Pepper, bell": Decimal("12.00"),
    "Potato": Decimal("6.00"),
    "Corn (maize)": Decimal("4.50"),
    "Apple": Decimal("18.00"),
    "Orange": Decimal("5.50"),
    "Strawberry": Decimal("25.00"),
    "Grape": Decimal("22.00"),
    "Peach": Decimal("15.00"),
    "Squash": Decimal("7.00"),
}


def _wobble(base: Decimal, pct: float = 0.15) -> Decimal:
    """Random ±pct% noise around base."""
    factor = Decimal(str(1.0 + random.uniform(-pct, pct)))
    return (base * factor).quantize(Decimal("0.01"))


async def seed():
    async with AsyncSessionLocal() as db:
        # Skip if already seeded
        existing = (await db.execute(select(MarketPrice).limit(1))).first()
        if existing:
            print("Market prices already seeded. Skipping.")
            return

        crops = (await db.execute(select(Crop))).scalars().all()
        crop_by_name = {c.name: c for c in crops}

        now = datetime.now(timezone.utc)
        rows_added = 0

        for crop_name, base_price in BASE_PRICES_GHS_PER_KG.items():
            crop = crop_by_name.get(crop_name)
            if not crop:
                continue

            # 30 days of history per crop per market
            for days_ago in range(30, -1, -1):
                recorded_at = now - timedelta(days=days_ago)
                for market_name, region in MARKETS:
                    price_kg = _wobble(base_price)
                    price_bag = (price_kg * Decimal("100")).quantize(Decimal("0.01"))
                    trend = random.choice(["up", "down", "stable", "stable"])

                    db.add(MarketPrice(
                        crop_id=crop.id,
                        market_name=market_name,
                        region=region,
                        price_per_bag=price_bag,
                        price_per_kg=price_kg,
                        price_trend=trend,
                        recorded_at=recorded_at,
                        source="seeded",
                    ))
                    rows_added += 1

        await db.commit()
        print(f"Seeded {rows_added} market price records.")


if __name__ == "__main__":
    asyncio.run(seed())