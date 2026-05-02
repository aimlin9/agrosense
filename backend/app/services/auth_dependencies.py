"""FastAPI dependencies for resolving JWT tokens to Farmer or Admin objects."""
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.admin import Admin
from app.models.farmer import Farmer


_security = HTTPBearer()


async def get_current_farmer(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    db: AsyncSession = Depends(get_db),
) -> Farmer:
    """Resolve the Bearer JWT to a Farmer row."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        farmer_id_str = payload.get("sub")
        if not farmer_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        farmer_id = UUID(farmer_id_str)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    farmer = (
        await db.execute(select(Farmer).where(Farmer.id == farmer_id))
    ).scalar_one_or_none()
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Farmer not found",
        )
    return farmer


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """Resolve the Bearer JWT to an Admin row. 401 if not an admin token."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        admin_id_str = payload.get("sub")
        is_admin = payload.get("is_admin", False)
        if not admin_id_str or not is_admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin credentials required",
            )
        admin_id = UUID(admin_id_str)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate admin credentials",
        )

    admin = (
        await db.execute(select(Admin).where(Admin.id == admin_id))
    ).scalar_one_or_none()
    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin not found or inactive",
        )
    return admin