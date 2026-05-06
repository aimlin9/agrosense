import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic import BaseModel
from uuid import UUID

class FarmerRegisterRequest(BaseModel):
    phone_number: str = Field(
        ..., min_length=10, max_length=20,
        description="Farmer's phone number, with country code, e.g. +233244123456",
    )
    full_name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=254)
    password: str = Field(..., min_length=8, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    primary_crop: Optional[str] = Field(None, max_length=100)
    preferred_language: str = Field(default="en", max_length=10)


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

    # Auth provider fields (added for Google sign-in)
    auth_provider: str
    profile_complete: bool
    profile_picture_url: Optional[str] = None

class LoginRequest(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=8, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class GoogleAuthRequest(BaseModel):
    id_token: str


class GoogleAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    profile_complete: bool  # mobile uses this to decide whether to show "Complete profile" screen
    farmer_id: UUID

class CompleteProfileRequest(BaseModel):
    phone_number: str
    region: str | None = None
    primary_crop: str | None = None
    full_name: str | None = None  # in case Google didn't provide it