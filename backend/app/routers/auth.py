from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete as sa_delete, or_, select, update as sa_update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.admin import Admin
from app.models.diagnosis import Diagnosis
from app.models.expert_review import ExpertReview
from app.models.farm_plot import FarmPlot
from app.models.farmer import Farmer
from app.models.sms_interaction import SMSInteraction
from app.schemas.auth import (
    AdminLoginRequest,
    ChangePasswordRequest,
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
from app.services.phone import phone_lookup_candidates
from app.services.rate_limit import RateLimit
from app.services.security import (
    create_access_token,
    has_usable_password,
    hash_password,
    verify_password,
)
from app.services.storage_service import delete_object_by_url


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_token(farmer: Farmer) -> str:
    return create_access_token(subject=str(farmer.id), token_version=farmer.token_version)


async def _find_by_phone(db: AsyncSession, raw_phone: str) -> Farmer | None:
    candidates = phone_lookup_candidates(raw_phone)
    rows = (
        await db.execute(select(Farmer).where(Farmer.phone_number.in_(candidates)))
    ).scalars().all()
    if not rows:
        return None
    # Prefer an account that can actually log in.
    return next((f for f in rows if has_usable_password(f.password_hash)), rows[0])


@router.post(
    "/register",
    response_model=FarmerResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimit(5, 60, "register", by_ip=True))],
)
async def register_farmer(
    payload: FarmerRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await _find_by_phone(db, payload.phone_number)

    if payload.email:
        email_owner = (
            await db.execute(select(Farmer).where(Farmer.email == payload.email))
        ).scalar_one_or_none()
        if email_owner is not None and (existing is None or email_owner.id != existing.id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="This email is already linked to another account.",
            )

    password_hash = await run_in_threadpool(hash_password, payload.password)

    if existing is not None:
        # A farmer who has only ever used SMS has a row but no password.
        # Let them claim it so their SMS history carries over to the app.
        if existing.is_sms_user and not has_usable_password(existing.password_hash):
            farmer = existing
            farmer.phone_number = payload.phone_number
            farmer.password_hash = password_hash
            for field in ("full_name", "email", "region", "district", "primary_crop"):
                value = getattr(payload, field)
                if value and not getattr(farmer, field):
                    setattr(farmer, field, value)
            farmer.preferred_language = payload.preferred_language
            farmer.profile_complete = True
        else:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="An account already exists for this phone number. Try signing in.",
            )
    else:
        farmer = Farmer(
            phone_number=payload.phone_number,
            full_name=payload.full_name,
            email=payload.email,
            password_hash=password_hash,
            region=payload.region,
            district=payload.district,
            primary_crop=payload.primary_crop,
            preferred_language=payload.preferred_language,
            auth_provider="phone",
            profile_complete=True,
        )
        db.add(farmer)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="An account already exists with these details. Try signing in.",
        )
    await db.refresh(farmer)
    return farmer


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(RateLimit(10, 60, "login", by_ip=True))],
)
async def login_farmer(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    farmer = await _find_by_phone(db, payload.phone_number)
    password_ok = await run_in_threadpool(
        verify_password, payload.password, farmer.password_hash if farmer else None
    )
    if farmer is None or not password_ok:
        detail = "Incorrect phone number or password."
        if farmer is not None and farmer.auth_provider == "google" and not has_usable_password(farmer.password_hash):
            detail = "This account uses Google sign-in. Tap “Continue with Google”."
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail)

    # Single-session enforcement: invalidate any previously-issued tokens.
    farmer.token_version += 1
    await db.commit()
    await db.refresh(farmer)
    return TokenResponse(access_token=_issue_token(farmer))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Revoke the current token server-side (bumps token_version)."""
    current_farmer.token_version += 1
    await db.commit()
    return None


@router.get("/me", response_model=FarmerResponse)
async def get_my_profile(current_farmer: Farmer = Depends(get_current_farmer)):
    """Profile of the authenticated farmer."""
    return current_farmer


@router.patch("/me", response_model=FarmerResponse)
async def update_my_profile(
    payload: UpdateProfileRequest,
    current_farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Update editable profile fields; omitted fields are left unchanged."""
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
                status.HTTP_409_CONFLICT,
                detail="This email is already linked to another account.",
            )

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "full_name" and not value:
            continue  # name can be changed, not erased
        setattr(current_farmer, field, value)

    await db.commit()
    await db.refresh(current_farmer)
    return current_farmer


@router.post(
    "/me/password",
    response_model=TokenResponse,
    dependencies=[Depends(RateLimit(5, 300, "change-password"))],
)
async def change_password(
    payload: ChangePasswordRequest,
    current_farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Change (or, for Google-only accounts, set) the password.

    Returns a fresh token: other devices are signed out.
    """
    if has_usable_password(current_farmer.password_hash):
        ok = await run_in_threadpool(
            verify_password, payload.current_password or "", current_farmer.password_hash
        )
        if not ok:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Your current password is incorrect.")

    current_farmer.password_hash = await run_in_threadpool(hash_password, payload.new_password)
    if current_farmer.auth_provider == "google":
        current_farmer.auth_provider = "phone+google"
    current_farmer.token_version += 1
    await db.commit()
    await db.refresh(current_farmer)
    return TokenResponse(access_token=_issue_token(current_farmer))


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    current_farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the farmer's account and owned data.

      - Diagnoses (and any expert reviews of them): deleted; photos removed best-effort
      - Farm plots: deleted
      - SMS interactions: anonymised (farmer_id and diagnosis link cleared)
      - Farmer row: deleted
    """
    farmer_id = current_farmer.id

    diagnoses = (
        await db.execute(select(Diagnosis).where(Diagnosis.farmer_id == farmer_id))
    ).scalars().all()
    diagnosis_ids = [d.id for d in diagnoses]
    image_urls = [d.image_url for d in diagnoses if d.image_url]

    if diagnosis_ids:
        await db.execute(sa_delete(ExpertReview).where(ExpertReview.diagnosis_id.in_(diagnosis_ids)))
        await db.execute(
            sa_update(SMSInteraction)
            .where(SMSInteraction.diagnosis_id.in_(diagnosis_ids))
            .values(diagnosis_id=None)
        )
        await db.execute(sa_delete(Diagnosis).where(Diagnosis.id.in_(diagnosis_ids)))

    await db.execute(sa_delete(FarmPlot).where(FarmPlot.farmer_id == farmer_id))
    await db.execute(
        sa_update(SMSInteraction)
        .where(SMSInteraction.farmer_id == farmer_id)
        .values(farmer_id=None)
    )
    await db.delete(current_farmer)
    await db.commit()

    # Storage cleanup after the commit so a slow R2 never blocks deletion.
    for url in image_urls:
        await run_in_threadpool(delete_object_by_url, url)
    return None


@router.post(
    "/admin/login",
    response_model=TokenResponse,
    dependencies=[Depends(RateLimit(5, 60, "admin-login", by_ip=True))],
)
async def admin_login(payload: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """Admin login with email + password."""
    admin = (
        await db.execute(select(Admin).where(Admin.email == payload.login_email))
    ).scalar_one_or_none()
    ok = await run_in_threadpool(
        verify_password, payload.password, admin.password_hash if admin else None
    )
    if not admin or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
    if not admin.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin disabled")

    token = create_access_token(subject=str(admin.id), extra_claims={"is_admin": True})
    return TokenResponse(access_token=token)


@router.post(
    "/google",
    response_model=GoogleAuthResponse,
    dependencies=[Depends(RateLimit(10, 60, "google", by_ip=True))],
)
async def google_signin(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """Sign in or sign up with a Google ID token.

    New users are created with profile_complete=False; the app routes them
    to Complete Profile to collect a phone number.
    """
    try:
        claims = await run_in_threadpool(verify_google_id_token, payload.id_token)
    except GoogleAuthError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=f"Google sign-in failed: {e}")

    google_sub = claims["sub"]
    email = (claims.get("email") or "").lower() or None
    email_verified = bool(claims.get("email_verified"))
    name = claims.get("name")
    picture = claims.get("picture")

    farmer = (
        await db.execute(select(Farmer).where(Farmer.google_sub == google_sub))
    ).scalar_one_or_none()

    # Link to an existing phone account with the same email — but only when
    # Google has verified the address, otherwise anyone could claim it.
    if not farmer and email and email_verified:
        farmer = (
            await db.execute(select(Farmer).where(Farmer.email == email))
        ).scalar_one_or_none()
        if farmer:
            farmer.google_sub = google_sub
            if picture and not farmer.profile_picture_url:
                farmer.profile_picture_url = picture
            if farmer.auth_provider == "phone":
                farmer.auth_provider = "phone+google"

    if not farmer:
        email_taken = False
        if email:
            email_taken = (
                await db.execute(select(Farmer.id).where(Farmer.email == email))
            ).first() is not None
        farmer = Farmer(
            phone_number=None,
            password_hash=None,
            email=None if email_taken else email,
            full_name=name,
            google_sub=google_sub,
            auth_provider="google",
            profile_picture_url=picture,
            profile_complete=False,
        )
        db.add(farmer)
        await db.flush()
    elif picture and farmer.profile_picture_url != picture and farmer.auth_provider == "google":
        farmer.profile_picture_url = picture

    farmer.token_version = (farmer.token_version or 0) + 1
    await db.commit()
    await db.refresh(farmer)

    return GoogleAuthResponse(
        access_token=_issue_token(farmer),
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
    candidates = phone_lookup_candidates(payload.phone_number)
    existing = (
        await db.execute(
            select(Farmer).where(
                or_(*[Farmer.phone_number == c for c in candidates]),
                Farmer.id != current_farmer.id,
            )
        )
    ).scalars().first()
    if existing:
        if existing.is_sms_user and not has_usable_password(existing.password_hash):
            # Number previously used only over SMS: release it to this account
            # and carry the SMS history across.
            await db.execute(
                sa_update(SMSInteraction)
                .where(SMSInteraction.farmer_id == existing.id)
                .values(farmer_id=current_farmer.id)
            )
            await db.execute(
                sa_update(Diagnosis)
                .where(Diagnosis.farmer_id == existing.id)
                .values(farmer_id=current_farmer.id)
            )
            await db.delete(existing)
            await db.flush()
        else:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="This phone number is already linked to another account.",
            )

    current_farmer.phone_number = payload.phone_number
    if payload.region:
        current_farmer.region = payload.region
    if payload.primary_crop:
        current_farmer.primary_crop = payload.primary_crop
    if payload.full_name:
        current_farmer.full_name = payload.full_name
    current_farmer.profile_complete = True

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="This phone number is already in use.")
    await db.refresh(current_farmer)
    return current_farmer
