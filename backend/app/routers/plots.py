"""Farm plots CRUD — owner-scoped."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.crop import Crop
from app.models.farm_plot import FarmPlot
from app.models.farmer import Farmer
from app.schemas.farm_plot import FarmPlotCreate, FarmPlotResponse, FarmPlotUpdate
from app.services.auth_dependencies import get_current_farmer


router = APIRouter(prefix="/api/plots", tags=["plots"])


async def _to_response(plot: FarmPlot, db: AsyncSession) -> FarmPlotResponse:
    crop_name = None
    if plot.crop_id:
        crop = (await db.execute(select(Crop).where(Crop.id == plot.crop_id))).scalar_one_or_none()
        crop_name = crop.name if crop else None
    return FarmPlotResponse(
        id=plot.id,
        farmer_id=plot.farmer_id,
        name=plot.name,
        crop_id=plot.crop_id,
        crop_name=crop_name,
        size_acres=plot.size_acres,
        gps_lat=plot.gps_lat,
        gps_lng=plot.gps_lng,
        planting_date=plot.planting_date,
        expected_harvest_date=plot.expected_harvest_date,
        soil_type=plot.soil_type,
        irrigation_type=plot.irrigation_type,
        notes=plot.notes,
    )


async def _get_owned_plot(plot_id: UUID, farmer: Farmer, db: AsyncSession) -> FarmPlot:
    plot = (await db.execute(select(FarmPlot).where(FarmPlot.id == plot_id))).scalar_one_or_none()
    if not plot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plot not found")
    if plot.farmer_id != farmer.id:
        # Don't leak existence — same 404
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plot not found")
    return plot


@router.get("", response_model=list[FarmPlotResponse])
async def list_my_plots(
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    plots = (
        await db.execute(select(FarmPlot).where(FarmPlot.farmer_id == farmer.id))
    ).scalars().all()
    return [await _to_response(p, db) for p in plots]


@router.post("", response_model=FarmPlotResponse, status_code=status.HTTP_201_CREATED)
async def create_plot(
    payload: FarmPlotCreate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    if payload.crop_id:
        crop = (await db.execute(select(Crop).where(Crop.id == payload.crop_id))).scalar_one_or_none()
        if not crop:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Crop not found")

    plot = FarmPlot(farmer_id=farmer.id, **payload.model_dump(exclude_unset=True))
    db.add(plot)
    await db.commit()
    await db.refresh(plot)
    return await _to_response(plot, db)


@router.get("/{plot_id}", response_model=FarmPlotResponse)
async def get_plot(
    plot_id: UUID,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    plot = await _get_owned_plot(plot_id, farmer, db)
    return await _to_response(plot, db)


@router.patch("/{plot_id}", response_model=FarmPlotResponse)
async def update_plot(
    plot_id: UUID,
    payload: FarmPlotUpdate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    plot = await _get_owned_plot(plot_id, farmer, db)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(plot, key, value)
    await db.commit()
    await db.refresh(plot)
    return await _to_response(plot, db)


@router.delete("/{plot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plot(
    plot_id: UUID,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    plot = await _get_owned_plot(plot_id, farmer, db)
    await db.delete(plot)
    await db.commit()