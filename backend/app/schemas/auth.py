import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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
    phone_number: str
    full_name: Optional[str]
    email: Optional[str]
    region: Optional[str]
    district: Optional[str]
    primary_crop: Optional[str]
    preferred_language: str
    is_sms_user: bool
    created_at: datetime

class LoginRequest(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=8, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"