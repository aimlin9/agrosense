"""Rate limiting helpers for FastAPI endpoints."""

from fastapi import Request
from jose import jwt, JWTError

from app.config import settings


async def farmer_or_ip_identifier(request: Request) -> str:
    """Identify the requester for rate limiting.

    For authenticated requests, use the farmer's UUID from the JWT
    (so a malicious client can't bypass limits by rotating IPs).
    For unauthenticated requests, fall back to the client IP,
    respecting X-Forwarded-For for requests proxied through Railway.
    """
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ", 1)[1]
            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.algorithm],
            )
            sub = payload.get("sub")
            if sub:
                return f"farmer:{sub}"
        except JWTError:
            pass

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    return f"ip:{request.client.host if request.client else 'unknown'}"