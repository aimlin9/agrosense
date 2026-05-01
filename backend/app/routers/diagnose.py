"""Diagnose router — the heart of AgroSense.

POST /api/diagnose: farmer uploads photo + crop_id → full pipeline → diagnosis.
"""
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


router = APIRouter(prefix="/api", tags=["diagnose"])


@router.post("/diagnose", response_model=DiagnosisResponse)
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

    # 4. Run inference
    predictions = predict(tensor, top_k=3)
    top = predictions[0]

    # 5. Look up Disease record by model_class_name
    disease = (
        await db.execute(
            select(Disease).where(Disease.model_class_name == top["class_name"])
        )
    ).scalar_one_or_none()

    is_healthy = "healthy" in top["class_name"].lower()
    display_disease = disease.display_name if disease else top["class_name"]

    # 6. Get treatment advice from Gemini (skip if healthy)
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

    # 7. Save Diagnosis row
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    diagnosis_row = Diagnosis(
        farmer_id=farmer.id,
        crop_id=crop.id,
        image_url=public_url,
        predicted_disease_id=disease.id if disease else None,
        confidence_score=top["confidence"],
        all_predictions=predictions,
        is_healthy=is_healthy,
        treatment_advice=advice_dict["summary"] if advice_dict else None,
        channel="app",
        status="completed",
        processing_time_ms=elapsed_ms,
    )
    db.add(diagnosis_row)
    await db.commit()
    await db.refresh(diagnosis_row)

    # 8. Build response
    top_items = [
        PredictionItem(
            class_name=p["class_name"],
            display_name=disease.display_name if disease and p == top else None,
            confidence=p["confidence"],
        )
        for p in predictions
    ]

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