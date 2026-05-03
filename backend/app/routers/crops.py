"""Public crops + diseases lookup."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.crop import Crop
from app.models.disease import Disease


router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/crops")
async def list_crops(db: AsyncSession = Depends(get_db)):
    crops = (await db.execute(select(Crop).order_by(Crop.name))).scalars().all()
    return [{"id": str(c.id), "name": c.name} for c in crops]


@router.get("/diseases")
async def list_diseases(
    crop_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Disease)
    if crop_id:
        stmt = stmt.where(Disease.crop_id == crop_id)
    rows = (await db.execute(stmt.order_by(Disease.display_name))).scalars().all()
    return [
        {
            "id": str(d.id),
            "crop_id": str(d.crop_id),
            "model_class_name": d.model_class_name,
            "display_name": d.display_name,
            "is_contagious": d.is_contagious,
        }
        for d in rows
    ]