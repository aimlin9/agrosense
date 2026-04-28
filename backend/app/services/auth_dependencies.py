from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.farmer import Farmer
from app.services.security import decode_access_token


# HTTPBearer: simpler scheme. Looks for "Authorization: Bearer <token>" header.
# Swagger UI shows a single "Value" field — paste your raw JWT.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_farmer(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Farmer:
    """Resolve the current farmer from a Bearer JWT.
    Raises 401 if missing, malformed, expired, or pointing to a deleted user."""

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. No header at all → unauthenticated
    if credentials is None:
        raise credentials_exception

    # 2. Decode the token. Returns None if invalid/expired.
    farmer_id = decode_access_token(credentials.credentials)
    if farmer_id is None:
        raise credentials_exception

    # 3. Fetch the farmer from the database.
    result = await db.execute(select(Farmer).where(Farmer.id == farmer_id))
    farmer = result.scalar_one_or_none()

    if farmer is None:
        raise credentials_exception

    return farmer