"""Admin endpoints — read-only aggregations."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.admin import Admin
from app.models.crop import Crop
from app.models.diagnosis import Diagnosis
from app.models.disease import Disease
from app.models.farmer import Farmer
from app.schemas.admin import (
    AdminDiagnosisListItem,
    AdminFarmerListItem,
    AdminStats,
    TopDisease,
)
from app.services.auth_dependencies import get_current_admin


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/farmers", response_model=list[AdminFarmerListItem])
async def list_farmers(
    region: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Farmer).order_by(Farmer.created_at.desc()).limit(limit)
    if region:
        stmt = stmt.where(Farmer.region.ilike(f"%{region}%"))
    farmers = (await db.execute(stmt)).scalars().all()
    return farmers


@router.get("/diagnoses", response_model=list[AdminDiagnosisListItem])
async def list_diagnoses(
    limit: int = Query(50, ge=1, le=200),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Diagnosis, Farmer.phone_number, Crop.name, Disease.display_name)
        .join(Farmer, Farmer.id == Diagnosis.farmer_id)
        .join(Crop, Crop.id == Diagnosis.crop_id)
        .outerjoin(Disease, Disease.id == Diagnosis.predicted_disease_id)
        .order_by(Diagnosis.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    return [
        AdminDiagnosisListItem(
            id=d.id,
            farmer_id=d.farmer_id,
            farmer_phone=phone,
            crop_name=crop_name,
            predicted_disease=disease_name,
            confidence_score=d.confidence_score,
            is_healthy=d.is_healthy,
            channel=d.channel,
            created_at=d.created_at,
        )
        for d, phone, crop_name, disease_name in rows
    ]


@router.get("/stats", response_model=AdminStats)
async def platform_stats(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    total_farmers = (await db.execute(select(func.count(Farmer.id)))).scalar_one()
    total_diagnoses = (await db.execute(select(func.count(Diagnosis.id)))).scalar_one()
    diagnoses_today = (await db.execute(
        select(func.count(Diagnosis.id)).where(Diagnosis.created_at >= today_start)
    )).scalar_one()
    diagnoses_week = (await db.execute(
        select(func.count(Diagnosis.id)).where(Diagnosis.created_at >= week_start)
    )).scalar_one()

    healthy_count = (await db.execute(
        select(func.count(Diagnosis.id)).where(Diagnosis.is_healthy.is_(True))
    )).scalar_one()
    healthy_pct = (healthy_count / total_diagnoses * 100) if total_diagnoses else 0.0

    top_stmt = (
        select(Disease.display_name, func.count(Diagnosis.id).label("c"))
        .join(Disease, Disease.id == Diagnosis.predicted_disease_id)
        .where(Diagnosis.is_healthy.is_(False))
        .group_by(Disease.display_name)
        .order_by(desc("c"))
        .limit(5)
    )
    top_rows = (await db.execute(top_stmt)).all()

    return AdminStats(
        total_farmers=total_farmers,
        total_diagnoses=total_diagnoses,
        diagnoses_today=diagnoses_today,
        diagnoses_last_7_days=diagnoses_week,
        healthy_pct=round(healthy_pct, 1),
        top_diseases=[TopDisease(disease_name=name, count=c) for name, c in top_rows],
    )