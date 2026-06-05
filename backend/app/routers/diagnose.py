"""Diagnose router — the heart of AgroSense.

POST /api/diagnose: farmer uploads photo + crop_id → full pipeline → diagnosis.
"""
import json
import time
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.crop import Crop
from app.models.diagnosis import Diagnosis
from app.models.disease import Disease
from app.models.farmer import Farmer
from app.schemas.diagnosis import DiagnosisResponse, PredictionItem, TreatmentAdvice
from app.services.auth_dependencies import get_current_farmer
from app.services.gemini_service import generate_treatment_advice
from app.services.image_service import ImageProcessingError, preprocess_bytes
from app.services.ml_service import predict
from app.services.storage_service import upload_image
from fastapi import Depends
from fastapi_limiter.depends import RateLimiter


router = APIRouter(prefix="/api", tags=["diagnose"])


@router.post(
    "/diagnose",
    response_model=DiagnosisResponse,
    dependencies=[Depends(RateLimiter(times=10, seconds=60))],
)
async def diagnose(
    crop_id: UUID = Form(...),
    file: UploadFile = File(...),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    started = time.perf_counter()

    # 1. Validate crop exists
    crop = (await db.execute(select(Crop).where(Crop.id == crop_id))).scalar_one_or_none()
    if not crop:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Crop not found")

    # 2. Read + preprocess image
    file_bytes = await file.read()
    try:
        tensor = preprocess_bytes(file_bytes)
    except ImageProcessingError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 3. Upload original to R2
    _, public_url = upload_image(
        file_bytes=file_bytes,
        original_filename=file.filename or "photo.jpg",
        content_type=file.content_type or "image/jpeg",
        prefix="diagnoses",
    )

    # 4. Run inference — request the FULL distribution (model has 38 classes)
    #    so we can filter it down to the crop the farmer actually selected.
    all_preds = predict(tensor, top_k=38)

    # 5. Crop-aware filtering.
    #    The `diseases` table maps every model class -> a crop, so it is the
    #    authoritative class->crop mapping. Pull this crop's disease rows once.
    crop_disease_rows = (
        await db.execute(select(Disease).where(Disease.crop_id == crop.id))
    ).scalars().all()
    disease_by_class = {d.model_class_name: d for d in crop_disease_rows}

    # Keep only predictions whose class belongs to the selected crop.
    filtered = [p for p in all_preds if p["class_name"] in disease_by_class]

    if filtered:
        # Normal path: the model knows this crop. Diagnosis stays within it.
        predictions = filtered[:3]
    else:
        # Fallback: this crop isn't in the model at all (e.g. Cassava, which
        # isn't part of PlantVillage). Degrade to the unfiltered top-3 so the
        # request still succeeds instead of erroring on the farmer.
        predictions = all_preds[:3]

    top = predictions[0]

    # 6. Resolve the Disease record for the top prediction.
    disease = disease_by_class.get(top["class_name"])
    if disease is None:
        # Only happens on the fallback path — look the class up directly.
        disease = (
            await db.execute(
                select(Disease).where(Disease.model_class_name == top["class_name"])
            )
        ).scalar_one_or_none()

    is_healthy = "healthy" in top["class_name"].lower()
    display_disease = disease.display_name if disease else top["class_name"]

    # 7. Get treatment advice from Gemini (skip if healthy)
    advice_dict = None
    if not is_healthy:
        try:
            advice_dict = generate_treatment_advice(
                crop_name=crop.name,
                disease_name=display_disease,
                confidence=top["confidence"],
            )
        except Exception as e:
            # Don't fail the whole request if Gemini hiccups
            print(f"[diagnose] Gemini failed: {e}")

    # 8. Save Diagnosis row
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    diagnosis_row = Diagnosis(
        farmer_id=farmer.id,
        crop_id=crop.id,
        image_url=public_url,
        predicted_disease_id=disease.id if disease else None,
        confidence_score=top["confidence"],
        all_predictions=predictions,
        is_healthy=is_healthy,
        treatment_advice=json.dumps(advice_dict) if advice_dict else None,
        channel="app",
        status="completed",
        processing_time_ms=elapsed_ms,
    )
    db.add(diagnosis_row)
    await db.commit()
    await db.refresh(diagnosis_row)

    # 9. Build response — every prediction gets its human-readable name
    top_items = []
    for p in predictions:
        d = disease_by_class.get(p["class_name"])
        top_items.append(
            PredictionItem(
                class_name=p["class_name"],
                display_name=d.display_name if d else None,
                confidence=p["confidence"],
            )
        )

    return DiagnosisResponse(
        id=diagnosis_row.id,
        crop_name=crop.name,
        image_url=public_url,
        predicted_disease=display_disease,
        confidence=top["confidence"],
        is_healthy=is_healthy,
        top_predictions=top_items,
        treatment_advice=TreatmentAdvice(**advice_dict) if advice_dict else None,
        processing_time_ms=elapsed_ms,
        created_at=diagnosis_row.created_at,
    )

@router.get("/diagnoses")
async def list_my_diagnoses(
    limit: int = 20,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Current farmer's diagnosis history, newest first."""
    stmt = (
        select(Diagnosis, Crop.name, Disease.display_name)
        .join(Crop, Crop.id == Diagnosis.crop_id)
        .outerjoin(Disease, Disease.id == Diagnosis.predicted_disease_id)
        .where(Diagnosis.farmer_id == farmer.id)
        .order_by(Diagnosis.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": str(d.id),
            "crop_name": crop_name,
            "predicted_disease": disease_name,
            "confidence": d.confidence_score,
            "is_healthy": d.is_healthy,
            "image_url": d.image_url,
            "created_at": d.created_at.isoformat(),
        }
        for d, crop_name, disease_name in rows
    ]

@router.get("/diagnoses/{diagnosis_id}")
async def get_my_diagnosis(
    diagnosis_id: UUID,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Single diagnosis with full treatment advice — current farmer only."""
    stmt = (
        select(Diagnosis, Crop.name, Disease.display_name)
        .join(Crop, Crop.id == Diagnosis.crop_id)
        .outerjoin(Disease, Disease.id == Diagnosis.predicted_disease_id)
        .where(Diagnosis.id == diagnosis_id, Diagnosis.farmer_id == farmer.id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Diagnosis not found")

    d, crop_name, disease_name = row

    # ─ Enrich top_predictions with display_name ─────────────
    raw_preds = d.all_predictions or []
    class_names = [p["class_name"] for p in raw_preds]
    if class_names:
        disease_rows = (
            await db.execute(
                select(Disease.model_class_name, Disease.display_name)
                .where(Disease.model_class_name.in_(class_names))
            )
        ).all()
        name_map = {cn: dn for cn, dn in disease_rows}
    else:
        name_map = {}

    top_predictions = [
        {
            "class_name": p["class_name"],
            "display_name": name_map.get(p["class_name"]),
            "confidence": p["confidence"],
        }
        for p in raw_preds
    ]

    # ─ Normalize treatment_advice ─────────────────────────────
    # New rows: dict (or JSON string of dict). Legacy rows: plain text.
    advice = d.treatment_advice
    if isinstance(advice, str):
        # Try parsing as JSON first; fall back to plain-text wrapper
        import json
        try:
            parsed = json.loads(advice)
            if isinstance(parsed, dict):
                advice = parsed
            else:
                raise ValueError
        except (ValueError, json.JSONDecodeError):
            # Legacy plain-text — wrap so mobile renders it
            text_lower = advice.lower()
            if any(w in text_lower for w in ["very serious", "destroy", "deadly", "severe"]):
                severity = "high"
            elif any(w in text_lower for w in ["serious", "spreads", "significant"]):
                severity = "moderate"
            elif d.is_healthy:
                severity = "none"
            else:
                severity = "low"

            advice = {
                "severity": severity,
                "summary": advice,
                "immediate_actions": [],
                "organic_treatment": None,
                "chemical_treatment": None,
                "prevention": None,
            }

    return {
        "id": str(d.id),
        "crop_name": crop_name,
        "image_url": d.image_url,
        "predicted_disease": disease_name or "Unknown",
        "confidence": d.confidence_score,
        "is_healthy": d.is_healthy,
        "top_predictions": top_predictions,
        "treatment_advice": advice,
        "processing_time_ms": d.processing_time_ms or 0,
        "created_at": d.created_at.isoformat(),
    }