import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.phone import InvalidPhoneNumber, normalize_phone

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_phone(v: str) -> str:
    try:
        return normalize_phone(v)
    except InvalidPhoneNumber as e:
        raise ValueError(str(e)) from e


def _clean_email(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip().lower()
    if not v:
        return None
    if not _EMAIL.match(v):
        raise ValueError("Enter a valid email address.")
    return v


def _blank_to_none(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    return v or None


class FarmerRegisterRequest(BaseModel):
    phone_number: str = Field(..., min_length=9, max_length=20, description="e.g. 0244123456 or +233244123456")
    full_name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=254)
    password: str = Field(..., min_length=8, max_length=72)
    region: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    primary_crop: Optional[str] = Field(None, max_length=100)
    preferred_language: str = Field(default="en", pattern="^(en|tw|ha)$")

    _phone = field_validator("phone_number")(_clean_phone)
    _email = field_validator("email")(_clean_email)
    _strip = field_validator("full_name", "region", "district", "primary_crop")(_blank_to_none)


class FarmerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone_number: Optional[str]   # nullable for Google sign-in users
    full_name: Optional[str]
    email: Optional[str]
    region: Optional[str]
    district: Optional[str]
    primary_crop: Optional[str]
    preferred_language: str
    is_sms_user: bool
    created_at: datetime
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None

    auth_provider: str
    profile_complete: bool
    profile_picture_url: Optional[str] = None


class LoginRequest(BaseModel):
    phone_number: str = Field(..., min_length=9, max_length=20)
    password: str = Field(..., min_length=1, max_length=100)


class AdminLoginRequest(BaseModel):
    # `phone_number` accepted for backwards compatibility with the first
    # admin client, which reused the farmer login payload.
    email: Optional[str] = None
    phone_number: Optional[str] = None
    password: str = Field(..., min_length=1, max_length=100)

    @property
    def login_email(self) -> str:
        return (self.email or self.phone_number or "").strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., min_length=20, max_length=4096)


class GoogleAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    profile_complete: bool
    farmer_id: uuid.UUID


class CompleteProfileRequest(BaseModel):
    phone_number: str
    region: Optional[str] = Field(None, max_length=100)
    primary_crop: Optional[str] = Field(None, max_length=100)
    full_name: Optional[str] = Field(None, max_length=200)

    _phone = field_validator("phone_number")(_clean_phone)
    _strip = field_validator("full_name", "region", "primary_crop")(_blank_to_none)


class UpdateProfileRequest(BaseModel):
    """Editable profile fields. All optional — only provided fields are updated.

    Phone number and password are excluded — phone is the auth credential and
    password changes go through /me/password.
    """
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = None
    region: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    primary_crop: Optional[str] = Field(None, max_length=100)
    preferred_language: Optional[str] = Field(None, pattern="^(en|tw|ha)$")
    gps_lat: Optional[float] = Field(None, ge=-90, le=90)
    gps_lng: Optional[float] = Field(None, ge=-180, le=180)

    _email = field_validator("email")(_clean_email)


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = Field(None, max_length=100)
    new_password: str = Field(..., min_length=8, max_length=72)
