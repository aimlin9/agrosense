"""Public crops + diseases lookup."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.crop import Crop
from app.models.disease import Disease
from app.services.catalog import crop_display_name, disease_display_name
from app.services.guide import guide_for_slug, load_guide

router = APIRouter(prefix="/api", tags=["catalog"])

# Crops most relevant to Ghanaian smallholders are listed first.
_PRIORITY = ["Tomato", "Corn (maize)", "Pepper, bell", "Potato", "Orange"]


@router.get("/crops")
async def list_crops(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(Crop, func.count(Disease.id))
            .outerjoin(Disease, Disease.crop_id == Crop.id)
            .where(Crop.is_active.is_(True))
            .group_by(Crop.id)
        )
    ).all()

    def sort_key(item):
        crop = item[0]
        return (_PRIORITY.index(crop.name) if crop.name in _PRIORITY else len(_PRIORITY), crop_display_name(crop.name))

    return [
        {
            "id": str(c.id),
            "name": crop_display_name(c.name),
            "raw_name": c.name,
            "local_name": c.local_name,
            "condition_count": int(n),
            "supported": int(n) > 0,
        }
        for c, n in sorted(rows, key=sort_key)
    ]


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
            "display_name": disease_display_name(d.model_class_name),
            "is_contagious": d.is_contagious,
        }
        for d in rows
    ]


_SUMMARY_FIELDS = ("slug", "crop", "name", "pathogen", "type", "severity", "summary")


@router.get("/library")
async def list_guide(crop: str | None = Query(None, max_length=60)):
    """Crop disease guide: one entry per disease the model recognises."""
    entries = load_guide()
    if crop:
        entries = [e for e in entries if e["crop"].lower() == crop.lower()]
    return [{k: e[k] for k in _SUMMARY_FIELDS} for e in entries]


@router.get("/library/{slug}")
async def get_guide_entry(slug: str):
    entry = guide_for_slug(slug)
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Guide entry not found")
    return entry
