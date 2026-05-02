from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FarmPlotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    crop_id: UUID | None = None
    size_acres: float | None = Field(None, gt=0)
    gps_lat: float | None = Field(None, ge=-90, le=90)
    gps_lng: float | None = Field(None, ge=-180, le=180)
    planting_date: date | None = None
    expected_harvest_date: date | None = None
    soil_type: str | None = Field(None, max_length=100)
    irrigation_type: str | None = Field(None, max_length=100)
    notes: str | None = None


class FarmPlotUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    crop_id: UUID | None = None
    size_acres: float | None = Field(None, gt=0)
    gps_lat: float | None = Field(None, ge=-90, le=90)
    gps_lng: float | None = Field(None, ge=-180, le=180)
    planting_date: date | None = None
    expected_harvest_date: date | None = None
    soil_type: str | None = None
    irrigation_type: str | None = None
    notes: str | None = None


class FarmPlotResponse(BaseModel):
    id: UUID
    farmer_id: UUID
    name: str
    crop_id: UUID | None = None
    crop_name: str | None = None
    size_acres: float | None = None
    gps_lat: float | None = None
    gps_lng: float | None = None
    planting_date: date | None = None
    expected_harvest_date: date | None = None
    soil_type: str | None = None
    irrigation_type: str | None = None
    notes: str | None = None

    class Config:
        from_attributes = True