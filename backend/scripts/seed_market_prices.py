"""Top up indicative market prices to today (manual run).

    python -m scripts.seed_market_prices            # backfill 30 days if empty, then fill gaps
    python -m scripts.seed_market_prices --days 60

The API also does this automatically (startup + every 12 hours) when
AUTO_INDICATIVE_PRICES is true. See app/services/price_feed.py.
"""
import argparse
import asyncio

from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models.market_price import MarketPrice
from app.services.price_feed import top_up_prices


async def main(days: int) -> None:
    added = await top_up_prices(AsyncSessionLocal, backfill_days=days)
    async with AsyncSessionLocal() as db:
        total = (await db.execute(select(func.count(MarketPrice.id)))).scalar_one()
    print(f"Added {added} price rows ({total} total).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30)
    asyncio.run(main(parser.parse_args().days))
