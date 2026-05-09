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
from uuid import UUID
from app.services.auth_dependencies import get_current_farmer
from app.services.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.admin import Admin
from app.schemas.auth import LoginRequest
from app.services.google_auth_service import GoogleAuthError, verify_google_id_token
from app.schemas.auth import GoogleAuthRequest, GoogleAuthResponse
from app.schemas.auth import CompleteProfileRequest
from fastapi_limiter.depends import RateLimiter


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=FarmerResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=5, seconds=60))],
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


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(RateLimiter(times=10, seconds=60))])
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

@router.post("/google", response_model=GoogleAuthResponse, dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def google_signin(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """Sign in or sign up with a Google ID token.
    
    Flow:
      1. Verify token against Google's public keys
      2. Look up farmer by google_sub or email
      3. If exists: return JWT
      4. If new: create farmer with profile_complete=False, return JWT
    
    Mobile redirects to /complete-profile when profile_complete is False.
    """
    try:
        claims = verify_google_id_token(payload.id_token)
    except GoogleAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google token verification failed: {e}",
        )

    google_sub = claims["sub"]
    email = claims.get("email")
    name = claims.get("name")
    picture = claims.get("picture")

    # Try existing farmer by google_sub first (most reliable — never changes)
    farmer = (
        await db.execute(
            select(Farmer).where(Farmer.google_sub == google_sub)
        )
    ).scalar_one_or_none()

    # Fallback: existing phone-auth farmer with same email — link the accounts
    if not farmer and email:
        farmer = (
            await db.execute(
                select(Farmer).where(Farmer.email == email)
            )
        ).scalar_one_or_none()
        if farmer:
            # Link this Google account to the existing record
            farmer.google_sub = google_sub
            farmer.profile_picture_url = picture
            if farmer.auth_provider == "phone":
                # Multi-provider account
                farmer.auth_provider = "phone+google"

    # New user — create stub record requiring profile completion
    if not farmer:
        farmer = Farmer(
            phone_number=None,
            password_hash=None,
            email=email,
            full_name=name,
            google_sub=google_sub,
            auth_provider="google",
            profile_picture_url=picture,
            profile_complete=False,  # forces "Complete profile" screen
        )
        db.add(farmer)

    await db.commit()
    await db.refresh(farmer)

    # Issue our JWT
    access_token = create_access_token(subject=str(farmer.id))

    return GoogleAuthResponse(
        access_token=access_token,
        profile_complete=farmer.profile_complete,
        farmer_id=farmer.id,
    )

@router.patch("/me/complete-profile", response_model=FarmerResponse)
async def complete_profile(
    payload: CompleteProfileRequest,
    current_farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Fill in required fields after Google sign-up.
    
    Marks profile_complete=True, allowing the farmer to access the rest of the app.
    """
    # Check phone uniqueness — another farmer may already own this number
    existing = (
        await db.execute(
            select(Farmer).where(
                Farmer.phone_number == payload.phone_number,
                Farmer.id != current_farmer.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phone number is already linked to another account.",
        )

    current_farmer.phone_number = payload.phone_number
    if payload.region:
        current_farmer.region = payload.region
    if payload.primary_crop:
        current_farmer.primary_crop = payload.primary_crop
    if payload.full_name and not current_farmer.full_name:
        current_farmer.full_name = payload.full_name
    current_farmer.profile_complete = True

    await db.commit()
    await db.refresh(current_farmer)
    return current_farmer