"""Weather service — Open-Meteo forecasts with Redis cache."""
import json

import httpx

from app.services.redis_client import get_redis


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 6 * 60 * 60  # 6 hours


def _cache_key(lat: float, lng: float) -> str:
    # Round to 2 decimal places (~1 km precision) so nearby requests share cache
    return f"weather:{round(lat, 2)}:{round(lng, 2)}"


async def get_forecast(lat: float, lng: float) -> dict:
    """Get 7-day forecast for a location. Returns cached result if available."""
    redis = get_redis()
    key = _cache_key(lat, lng)

    cached = await redis.get(key)
    if cached:
        return json.loads(cached)

    params = {
        "latitude": lat,
        "longitude": lng,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max",
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        "timezone": "auto",
        "forecast_days": 7,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        response.raise_for_status()
        data = response.json()

    await redis.setex(key, CACHE_TTL_SECONDS, json.dumps(data))
    return data