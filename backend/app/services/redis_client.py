"""Shared async Redis client.

Connects to the Redis container started by docker-compose.
Used for caching weather forecasts and other ephemeral data.
"""
import redis.asyncio as redis_async

from app.config import settings


_redis: redis_async.Redis | None = None


def get_redis() -> redis_async.Redis:
    """Return the singleton Redis client."""
    global _redis
    if _redis is None:
        _redis = redis_async.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis