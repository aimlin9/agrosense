"""Rate limiting for FastAPI endpoints.

Fixed-window counters stored in Redis so limits hold across workers. If Redis
is unreachable we fall back to a per-process in-memory window rather than
failing the request — a degraded limiter beats a dead login screen.

Usage:
    @router.post("/login", dependencies=[Depends(RateLimit(10, 60, "login"))])
"""
import logging
import math
import time

from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from app.config import settings
from app.services import redis_client

logger = logging.getLogger("agrosense.rate_limit")

# key -> (window_start, count). Only used when Redis is down.
_memory_windows: dict[str, tuple[int, int]] = {}
_MEMORY_MAX_KEYS = 50_000


def client_ip(request: Request) -> str:
    """Best-effort real client IP behind Render / Cloudflare proxies."""
    for header in ("cf-connecting-ip", "true-client-ip", "x-real-ip"):
        value = request.headers.get(header)
        if value:
            return value.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def farmer_or_ip_identifier(request: Request) -> str:
    """Rate-limit identity: the farmer's id from a valid JWT, else client IP.

    Using the farmer id means rotating IPs doesn't bypass per-user limits.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        try:
            payload = jwt.decode(
                auth_header.split(" ", 1)[1],
                settings.secret_key,
                algorithms=[settings.algorithm],
            )
            sub = payload.get("sub")
            if sub:
                return f"user:{sub}"
        except JWTError:
            pass
    return f"ip:{client_ip(request)}"


def _memory_hit(key: str, window_start: int) -> int:
    if len(_memory_windows) > _MEMORY_MAX_KEYS:
        _memory_windows.clear()
    start, count = _memory_windows.get(key, (window_start, 0))
    if start != window_start:
        start, count = window_start, 0
    count += 1
    _memory_windows[key] = (start, count)
    return count


class RateLimit:
    """FastAPI dependency allowing `times` requests per `seconds` per identity."""

    def __init__(self, times: int, seconds: int, scope: str, by_ip: bool = False):
        self.times = times
        self.seconds = seconds
        self.scope = scope
        self.by_ip = by_ip

    async def __call__(self, request: Request) -> None:
        identity = f"ip:{client_ip(request)}" if self.by_ip else farmer_or_ip_identifier(request)
        now = time.time()
        window_start = int(now // self.seconds) * self.seconds
        key = f"rl:{self.scope}:{identity}:{window_start}"

        count = None
        if redis_client.available():
            try:
                redis = redis_client.get_redis()
                count = await redis.incr(key)
                if count == 1:
                    await redis.expire(key, self.seconds + 1)
            except Exception as e:  # Redis down / misconfigured
                redis_client.mark_down(e)
                count = None
        if count is None:
            count = _memory_hit(key, window_start)

        if count > self.times:
            retry_after = max(1, math.ceil(window_start + self.seconds - now))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )
