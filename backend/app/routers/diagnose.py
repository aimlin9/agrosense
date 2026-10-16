"""Diagnose router — the heart of AgroSense.

POST /api/diagnose: farmer uploads photo + crop_id → full pipeline → diagnosis.
"""
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import case, delete as sa_delete, func, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.crop import Crop
from app.models.diagnosis import Diagnosis
from app.models.disease import Disease
from app.models.expert_review import ExpertReview
from app.models.farmer import Farmer
from app.models.sms_interaction import SMSInteraction
from app.schemas.diagnosis import DiagnosisResponse, PredictionItem, TreatmentAdvice
from app.services.auth_dependencies import get_current_farmer
from app.services.catalog import (
    LOW_CONFIDENCE_THRESHOLD,
    crop_display_name,
    disease_display_name,
    fallback_advice,
    is_healthy_class,
    normalize_advice,
)
from app.services.gemini_service import GeminiUnavailable, generate_treatment_advice
from app.services.image_service import ImageProcessingError, preprocess_bytes, to_storage_jpeg
from app.services.ml_service import predict
from app.services.rate_limit import RateLimit
from app.services.storage_service import StorageUnavailable, delete_object_by_url, upload_image

logger = logging.getLogger("agrosense.diagnose")

router = APIRouter(prefix="/api", tags=["diagnose"])

_ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "application/octet-stream", ""}


async def run_diagnosis_pipeline(
    *,
    file_bytes: bytes,
    crop: Crop | None,
    farmer: Farmer,
    db: AsyncSession,
    channel: str = "app",
    image_url: str | None = None,
    use_llm: bool = True,
) -> tuple[Diagnosis, dict]:
    """Shared by the app and SMS paths. Returns (saved row, response dict)."""
    started = time.perf_counter()

    try:
        tensor = await run_in_threadpool(preprocess_bytes, file_bytes)
    except ImageProcessingError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Store a normalised JPEG (upright, EXIF/GPS stripped, ≤1600px).
    if image_url is None:
        try:
            jpeg = await run_in_threadpool(to_storage_jpeg, file_bytes)
            _, image_url = await run_in_threadpool(
                upload_image, jpeg, "photo.jpg", "image/jpeg", "diagnoses"
            )
        except StorageUnavailable as e:
            # The farmer still gets their diagnosis; only the photo isn't kept.
            logger.warning("Photo storage unavailable: %s", e)
            image_url = ""

    # Full distribution so we can restrict it to the crop the farmer picked.
    all_preds = await run_in_threadpool(predict, tensor, 38)

    disease_by_class: dict[str, Disease] = {}
    if crop is not None:
        rows = (await db.execute(select(Disease).where(Disease.crop_id == crop.id))).scalars().all()
        disease_by_class = {d.model_class_name: d for d in rows}

    filtered = [p for p in all_preds if p["class_name"] in disease_by_class]
    crop_supported = bool(filtered) or crop is None
    if filtered:
        # Renormalise within the crop so the numbers read as "of the
        # possibilities for this crop, how likely is each".
        total = sum(p["confidence"] for p in filtered) or 1.0
        predictions = [
            {**p, "confidence": p["confidence"] / total, "raw_confidence": p["confidence"]}
            for p in filtered[:3]
        ]
        # A crop-restricted answer is only as good as the model's belief that
        # the photo shows this crop at all.
        if total < 0.2:
            predictions[0]["confidence"] = min(predictions[0]["confidence"], 0.5)
    else:
        predictions = all_preds[:3]

    top = predictions[0]
    class_name = top["class_name"]
    confidence = float(top["confidence"])

    disease = disease_by_class.get(class_name)
    if disease is None:
        disease = (
            await db.execute(select(Disease).where(Disease.model_class_name == class_name))
        ).scalar_one_or_none()

    is_healthy = is_healthy_class(class_name)
    display_disease = disease_display_name(class_name)
    crop_name = crop_display_name(crop.name) if crop else crop_display_name(
        class_name.partition("___")[0].replace("_", " ")
    )
    low_confidence = confidence < LOW_CONFIDENCE_THRESHOLD or not crop_supported

    advice: dict | None = None
    advice_source = "curated"
    if not is_healthy and use_llm:
        try:
            raw = await generate_treatment_advice(
                crop_name=crop_name or "crop",
                disease_name=display_disease,
                confidence=confidence,
            )
            advice = normalize_advice(raw, class_name, confidence)
            advice_source = "ai"
        except GeminiUnavailable:
            pass
    if advice is None:
        advice = fallback_advice(class_name, confidence)
    if not crop_supported:
        advice["immediate_actions"].insert(
            0,
            f"AgroSense can't yet diagnose {crop_name} reliably. Treat this result as a rough guide and confirm with an extension officer.",
        )

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    row = Diagnosis(
        farmer_id=farmer.id,
        crop_id=crop.id if crop else None,
        image_url=image_url or "",
        predicted_disease_id=disease.id if disease else None,
        confidence_score=confidence,
        all_predictions=[
            {"class_index": p.get("class_index"), "class_name": p["class_name"], "confidence": float(p["confidence"])}
            for p in predictions
        ],
        is_healthy=is_healthy,
        treatment_advice=json.dumps(advice),
        channel=channel,
        status="completed",
        processing_time_ms=elapsed_ms,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    response = {
        "id": row.id,
        "crop_name": crop_name or "Unknown crop",
        "image_url": image_url or None,
        "predicted_disease": display_disease,
        "confidence": confidence,
        "is_healthy": is_healthy,
        "top_predictions": [
            PredictionItem(
                class_name=p["class_name"],
                display_name=disease_display_name(p["class_name"]),
                confidence=float(p["confidence"]),
            )
            for p in predictions
        ],
        "treatment_advice": TreatmentAdvice(**advice),
        "processing_time_ms": elapsed_ms,
        "created_at": row.created_at,
        "low_confidence": low_confidence,
        "crop_supported": crop_supported,
        "advice_source": advice_source,
    }
    return row, response


@router.post(
    "/diagnose",
    response_model=DiagnosisResponse,
    dependencies=[Depends(RateLimit(10, 60, "diagnose")), Depends(RateLimit(60, 86400, "diagnose-day"))],
)
async def diagnose(
    crop_id: UUID = Form(...),
    file: UploadFile = File(...),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    if (file.content_type or "").lower() not in _ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Please upload a photo (JPEG or PNG).",
        )

    crop = (await db.execute(select(Crop).where(Crop.id == crop_id))).scalar_one_or_none()
    if not crop:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Crop not found")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    file_bytes = await file.read(max_bytes + 1)
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Photo is too large. Maximum size is {settings.max_upload_mb} MB.",
        )
    if not file_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="The photo upload was empty.")

    _, response = await run_diagnosis_pipeline(file_bytes=file_bytes, crop=crop, farmer=farmer, db=db)
    return DiagnosisResponse(**response)


@router.get("/diagnoses/stats")
async def my_diagnosis_stats(
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Counts for the home screen."""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = now - timedelta(days=7)
    row = (
        await db.execute(
            select(
                func.count(Diagnosis.id),
                func.coalesce(func.sum(case((Diagnosis.created_at >= today, 1), else_=0)), 0),
                func.coalesce(func.sum(case((Diagnosis.created_at >= week, 1), else_=0)), 0),
                func.coalesce(func.sum(case((Diagnosis.is_healthy.is_(True), 1), else_=0)), 0),
            ).where(Diagnosis.farmer_id == farmer.id)
        )
    ).one()
    total, today_count, week_count, healthy = (int(x or 0) for x in row)
    return {
        "total": total,
        "today": today_count,
        "last_7_days": week_count,
        "healthy": healthy,
        "issues_found": total - healthy,
    }


def _list_item(d: Diagnosis, crop_name: str | None, class_name: str | None, disease_name: str | None) -> dict:
    return {
        "id": str(d.id),
        "crop_name": crop_display_name(crop_name) or "Unknown crop",
        "predicted_disease": disease_display_name(class_name) if class_name else (disease_name or "Unknown"),
        "confidence": d.confidence_score,
        "is_healthy": d.is_healthy,
        "image_url": d.image_url or None,
        "channel": d.channel,
        "status": d.status,
        "created_at": d.created_at.isoformat(),
    }


@router.get("/diagnoses")
async def list_my_diagnoses(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Current farmer's diagnosis history, newest first."""
    stmt = (
        select(Diagnosis, Crop.name, Disease.model_class_name, Disease.display_name)
        .outerjoin(Crop, Crop.id == Diagnosis.crop_id)
        .outerjoin(Disease, Disease.id == Diagnosis.predicted_disease_id)
        .where(Diagnosis.farmer_id == farmer.id)
        .order_by(Diagnosis.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()
    return [_list_item(d, crop_name, cls, dn) for d, crop_name, cls, dn in rows]


def _legacy_severity(text: str, is_healthy: bool) -> str:
    t = text.lower()
    if is_healthy:
        return "none"
    if any(w in t for w in ("very serious", "destroy", "deadly", "severe")):
        return "high"
    if any(w in t for w in ("serious", "spreads", "significant")):
        return "moderate"
    return "low"


@router.get("/diagnoses/{diagnosis_id}")
async def get_my_diagnosis(
    diagnosis_id: UUID,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    """Single diagnosis with full treatment advice — current farmer only."""
    stmt = (
        select(Diagnosis, Crop.name, Disease.model_class_name)
        .outerjoin(Crop, Crop.id == Diagnosis.crop_id)
        .outerjoin(Disease, Disease.id == Diagnosis.predicted_disease_id)
        .where(Diagnosis.id == diagnosis_id, Diagnosis.farmer_id == farmer.id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Diagnosis not found")

    d, crop_name, class_name = row
    raw_preds = d.all_predictions or []
    top_predictions = [
        {
            "class_name": p["class_name"],
            "display_name": disease_display_name(p["class_name"]),
            "confidence": p["confidence"],
        }
        for p in raw_preds
        if isinstance(p, dict) and "class_name" in p
    ]
    cls = class_name or (top_predictions[0]["class_name"] if top_predictions else "")

    # New rows store a JSON object; legacy rows stored plain text.
    advice = None
    if d.treatment_advice:
        try:
            parsed = json.loads(d.treatment_advice)
            advice = normalize_advice(parsed, cls, d.confidence_score) if isinstance(parsed, dict) else None
        except (ValueError, TypeError):
            parsed = None
        if advice is None:
            text = d.treatment_advice
            advice = {
                "severity": _legacy_severity(text, d.is_healthy),
                "summary": text,
                "immediate_actions": [],
                "organic_treatment": None,
                "chemical_treatment": None,
                "prevention": None,
            }
    elif cls:
        advice = fallback_advice(cls, d.confidence_score)

    review = (
        await db.execute(
            select(ExpertReview)
            .where(ExpertReview.diagnosis_id == d.id)
            .order_by(ExpertReview.reviewed_at.desc())
        )
    ).scalars().first()

    return {
        "id": str(d.id),
        "crop_name": crop_display_name(crop_name) or "Unknown crop",
        "image_url": d.image_url or None,
        "predicted_disease": disease_display_name(cls) if cls else "Unknown",
        "confidence": d.confidence_score,
        "is_healthy": d.is_healthy,
        "low_confidence": d.confidence_score < LOW_CONFIDENCE_THRESHOLD,
        "top_predictions": top_predictions,
        "treatment_advice": advice,
        "processing_time_ms": d.processing_time_ms or 0,
        "channel": d.channel,
        "status": d.status,
        "expert_review": {
            "is_ai_correct": review.is_ai_correct,
            "notes": review.expert_notes,
            "reviewed_at": review.reviewed_at.isoformat(),
        } if review else None,
        "created_at": d.created_at.isoformat(),
    }


@router.delete("/diagnoses/{diagnosis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_diagnosis(
    diagnosis_id: UUID,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
):
    d = (
        await db.execute(
            select(Diagnosis).where(Diagnosis.id == diagnosis_id, Diagnosis.farmer_id == farmer.id)
        )
    ).scalar_one_or_none()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Diagnosis not found")
    url = d.image_url
    await db.execute(sa_delete(ExpertReview).where(ExpertReview.diagnosis_id == d.id))
    await db.execute(
        sa_update(SMSInteraction).where(SMSInteraction.diagnosis_id == d.id).values(diagnosis_id=None)
    )
    await db.delete(d)
    await db.commit()
    if url:
        await run_in_threadpool(delete_object_by_url, url)
    return None
