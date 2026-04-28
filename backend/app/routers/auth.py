from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.farmer import Farmer
from app.schemas.auth import FarmerRegisterRequest, FarmerResponse
from app.services.security import hash_password


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=FarmerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_farmer(
    payload: FarmerRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    # 1. Check if phone number is already registered
    result = await db.execute(
        select(Farmer).where(Farmer.phone_number == payload.phone_number)
    )
    existing_farmer = result.scalar_one_or_none()
    if existing_farmer is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A farmer is already registered with this phone number.",
        )

    # 2. Hash the password
    password_hash = hash_password(payload.password)

    # 3. Build the new Farmer model
    new_farmer = Farmer(
        phone_number=payload.phone_number,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=password_hash,
        region=payload.region,
        district=payload.district,
        primary_crop=payload.primary_crop,
        preferred_language=payload.preferred_language,
    )

    # 4. Save to database
    db.add(new_farmer)
    await db.commit()
    await db.refresh(new_farmer)  # populates auto-generated fields like id, created_at

    # 5. Return — FastAPI converts to FarmerResponse automatically
    return new_farmer