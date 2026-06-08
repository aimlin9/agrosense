"""Weather service — Open-Meteo forecasts with Redis cache + stale fallback.

Open-Meteo's free tier is rate-limited per IP (10k/day, 5k/hour, 600/min).
Because Render free-tier services share outbound IPs, we routinely see
429s caused by OTHER tenants' usage on the same IP. To stay resilient,
we keep both a fresh cache (6h) and a long-lived stale cache (7d), and
serve the stale one whenever the upstream errors.
"""
import json

import httpx

from app.services.redis_client import get_redis


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
FRESH_TTL_SECONDS = 6 * 60 * 60        # 6 hours — primary cache
STALE_TTL_SECONDS = 7 * 24 * 60 * 60   # 7 days — fallback when upstream is down


def _fresh_key(lat: float, lng: float) -> str:
    return f"weather:fresh:{round(lat, 2)}:{round(lng, 2)}"


def _stale_key(lat: float, lng: float) -> str:
    return f"weather:stale:{round(lat, 2)}:{round(lng, 2)}"


async def get_forecast(lat: float, lng: float) -> dict:
    """Get 7-day forecast. Tries fresh cache, then upstream; on upstream
    error, falls back to stale cache (up to 7 days old)."""
    redis = get_redis()
    fresh_key = _fresh_key(lat, lng)
    stale_key = _stale_key(lat, lng)

    # 1. Fresh cache hit — return immediately
    cached = await redis.get(fresh_key)
    if cached:
        return json.loads(cached)

    # 2. Hit Open-Meteo
    params = {
        "latitude": lat,
        "longitude": lng,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max",
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        "timezone": "auto",
        "forecast_days": 7,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        # 3. Upstream failed — fall back to stale cache if we have one
        stale = await redis.get(stale_key)
        if stale:
            print(
                f"[weather] Open-Meteo failed ({e!r}); serving stale cache for {lat},{lng}",
                flush=True,
            )
            return json.loads(stale)
        # No stale to fall back on — propagate to router (returns 502)
        raise

    # 4. Store BOTH caches — fresh for 6h, stale fallback for 7 days
    serialized = json.dumps(data)
    await redis.setex(fresh_key, FRESH_TTL_SECONDS, serialized)
    await redis.setex(stale_key, STALE_TTL_SECONDS, serialized)
    return data