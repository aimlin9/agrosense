from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.models.farmer import Farmer
from app.models.admin import Admin
from app.models.diagnosis import Diagnosis
from app.models.farm_plot import FarmPlot
from app.models.sms_interaction import SMSInteraction
from app.schemas.auth import (
    CompleteProfileRequest,
    FarmerRegisterRequest,
    FarmerResponse,
    GoogleAuthRequest,
    GoogleAuthResponse,
    LoginRequest,
    TokenResponse,
    UpdateProfileRequest,
)
from app.services.auth_dependencies import get_current_farmer
from app.services.google_auth_service import GoogleAuthError, verify_google_id_token
from app.services.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.services.storage_service import delete_object_by_url
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


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(RateLimiter(times=10, seconds=60))],
)
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

    # Single-session enforcement: invalidate any previously-issued tokens
    farmer.token_version += 1
    await db.commit()
    await db.refresh(farmer)

    access_token = create_access_token(
        subject=str(farmer.id),
        token_version=farmer.token_version,
    )
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=FarmerResponse)
async def get_my_profile(
    current_farmer: Farmer = Depends(get_current_farmer),
):
    """Get the profile of the currently authenticated farmer.
    Requires a valid Bearer token."""
    return current_farmer

@router.patch("/me", response_model=FarmerResponse)
async def update_my_profile(
    payload: UpdateProfileRequest,
    current_farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Update editable profile fields.

    Only fields explicitly provided in the payload are written — omitted fields
    are left unchanged. Phone number and password cannot be changed here.
    """
    # Email uniqueness check if email is being changed
    if payload.email is not None and payload.email != current_farmer.email:
        existing = (
            await db.execute(
                select(Farmer).where(
                    Farmer.email == payload.email,
                    Farmer.id != current_farmer.id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already linked to another account.",
            )

    # Apply updates field-by-field, only for fields explicitly provided
    update_fields = payload.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(current_farmer, field, value)

    await db.commit()
    await db.refresh(current_farmer)
    return current_farmer


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    current_farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the authenticated farmer's account and all owned data.

    Cascade behaviour:
      - Diagnoses: deleted; R2 photos cleaned up best-effort
      - Farm plots: deleted
      - SMS interactions: anonymised (farmer_id set to NULL) — preserves analytics
      - Farmer row: deleted

    Returns 204 No Content on success.
    """
    farmer_id = current_farmer.id

    # 1. Fetch diagnoses so we can clean up their R2 photos before deletion.
    diagnoses_result = await db.execute(
        select(Diagnosis).where(Diagnosis.farmer_id == farmer_id)
    )
    diagnoses = diagnoses_result.scalars().all()

    # 2. Best-effort R2 photo cleanup. If R2 is unreachable or photos already
    #    gone, swallow it — we're tearing down anyway.
    for diagnosis in diagnoses:
        if diagnosis.image_url:
            delete_object_by_url(diagnosis.image_url)  # returns False silently on failure

    # 3. Delete diagnoses. Any FK-cascaded expert_reviews go with them.
    for diagnosis in diagnoses:
        await db.delete(diagnosis)

    # 4. Delete farm plots.
    plots_result = await db.execute(
        select(FarmPlot).where(FarmPlot.farmer_id == farmer_id)
    )
    for plot in plots_result.scalars().all():
        await db.delete(plot)

    # 5. Anonymise SMS interactions (preserves analytics without keeping PII).
    await db.execute(
        sa_update(SMSInteraction)
        .where(SMSInteraction.farmer_id == farmer_id)
        .values(farmer_id=None)
    )

    # 6. Delete the farmer record itself.
    await db.delete(current_farmer)
    await db.commit()

    return None


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


@router.post(
    "/google",
    response_model=GoogleAuthResponse,
    dependencies=[Depends(RateLimiter(times=10, seconds=60))],
)
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
            farmer.google_sub = google_sub
            farmer.profile_picture_url = picture
            if farmer.auth_provider == "phone":
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
            profile_complete=False,
        )
        db.add(farmer)
# ... existing code up to where farmer is created/refreshed ...
    
    await db.commit()
    await db.refresh(farmer)

    # Single-session enforcement: bump version then issue new token
    farmer.token_version += 1
    await db.commit()
    await db.refresh(farmer)

    access_token = create_access_token(
        subject=str(farmer.id),
        token_version=farmer.token_version,
    )

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
    """Fill in required fields after Google sign-up."""
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

