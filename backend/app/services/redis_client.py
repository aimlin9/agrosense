"""Shared async Redis client plus small fail-safe cache helpers.

Redis is an optimisation (caching, rate limits), never a hard dependency:
every helper here swallows connection errors so the API keeps serving.
"""
import json
import logging
import time
from typing import Any

import redis.asyncio as redis_async

from app.config import settings

logger = logging.getLogger("agrosense.redis")

_redis: redis_async.Redis | None = None

# Circuit breaker: after a failure, skip Redis for a while instead of paying
# a connection timeout on every request.
_BREAKER_SECONDS = 30
_down_until = 0.0


def available() -> bool:
    return time.monotonic() >= _down_until


def mark_down(error: Exception) -> None:
    global _down_until
    if available():
        logger.warning("Redis unavailable (%r); bypassing for %ss", error, _BREAKER_SECONDS)
    _down_until = time.monotonic() + _BREAKER_SECONDS


def get_redis() -> redis_async.Redis:
    """Return the singleton Redis client (connects lazily)."""
    global _redis
    if _redis is None:
        _redis = redis_async.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _redis


async def cache_get_json(key: str) -> Any | None:
    if not available():
        return None
    try:
        raw = await get_redis().get(key)
    except Exception as e:
        mark_down(e)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    if not available():
        return
    try:
        await get_redis().setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception as e:
        mark_down(e)


async def ping() -> bool:
    try:
        return bool(await get_redis().ping())
    except Exception as e:
        mark_down(e)
        return False


async def close() -> None:
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
        except Exception:
            pass
        _redis = None
