from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.farmer import Farmer
from app.schemas.auth import (
    FarmerRegisterRequest,
    FarmerResponse,
    LoginRequest,
    TokenResponse,
)
from app.services.auth_dependencies import get_current_farmer
from app.services.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.admin import Admin
from app.schemas.auth import LoginRequest


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
    result = await db.execute(
        select(Farmer).where(Farmer.phone_number == payload.phone_number)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A farmer is already registered with this phone number.",
        )

    new_farmer = Farmer(
        phone_number=payload.phone_number,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        region=payload.region,
        district=payload.district,
        primary_crop=payload.primary_crop,
        preferred_language=payload.preferred_language,
    )

    db.add(new_farmer)
    await db.commit()
    await db.refresh(new_farmer)

    return new_farmer


@router.post("/login", response_model=TokenResponse)
async def login_farmer(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Farmer).where(Farmer.phone_number == payload.phone_number)
    )
    farmer = result.scalar_one_or_none()

    if farmer is None or not verify_password(
        payload.password, farmer.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
        )

    access_token = create_access_token(str(farmer.id))
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=FarmerResponse)
async def get_my_profile(
    current_farmer: Farmer = Depends(get_current_farmer),
):
    """Get the profile of the currently authenticated farmer.
    Requires a valid Bearer token."""
    return current_farmer


@router.post("/admin/login", response_model=TokenResponse)
async def admin_login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Admin login — uses email instead of phone."""
    admin = (
        await db.execute(select(Admin).where(Admin.email == payload.phone_number))
    ).scalar_one_or_none()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )
    if not admin.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin disabled")

    token = create_access_token(
        subject=str(admin.id),
        extra_claims={"is_admin": True},
    )
    return TokenResponse(access_token=token, token_type="bearer")