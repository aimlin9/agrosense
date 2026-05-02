"""SMS webhook — Twilio POSTs here when a farmer texts our number.

Pipeline:
  1. Receive From / Body / MediaUrl0 from Twilio
  2. Look up or create Farmer record by phone
  3. Classify intent via Gemini
  4. Dispatch to handler (diagnosis / prices / weather / help / unknown)
  5. Save SMSInteraction log
  6. Return TwiML reply
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
from fastapi import APIRouter, Depends, Form, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.crop import Crop
from app.models.disease import Disease
from app.models.farmer import Farmer
from app.models.market_price import MarketPrice
from app.models.sms_interaction import SMSInteraction
from app.services.gemini_service import (
    classify_sms_intent,
    generate_treatment_advice,
)
from app.services.image_service import ImageProcessingError, preprocess_bytes
from app.services.ml_service import predict
from app.services.sms_formatters import (
    format_diagnosis_sms,
    format_help_sms,
    format_prices_sms,
    format_unknown_sms,
    format_weather_sms,
)
from app.services.sms_service import build_twiml_response
from app.services.weather_service import get_forecast


router = APIRouter(prefix="/api/sms", tags=["sms"])


# ── helpers ───────────────────────────────────────────────────

async def _get_or_create_sms_farmer(phone: str, db: AsyncSession) -> Farmer:
    """SMS farmers don't register — auto-create a minimal Farmer row."""
    farmer = (
        await db.execute(select(Farmer).where(Farmer.phone_number == phone))
    ).scalar_one_or_none()
    if farmer:
        return farmer
    farmer = Farmer(
        phone_number=phone,
        full_name=None,
        password_hash="sms-no-login",  # they never log in via password
        is_sms_user=True,
    )
    db.add(farmer)
    await db.flush()
    return farmer


async def _handle_diagnosis(
    message: str,
    media_url: str | None,
    crop_hint: str | None,
    farmer: Farmer,
    db: AsyncSession,
) -> str:
    """Run diagnosis. With photo: real ML. Without photo: degrade gracefully."""
    if not media_url:
        return (
            "AgroSense: please send a photo of the sick plant for diagnosis. "
            "Text HELP for options."
        )

    # Download the photo from Twilio's media URL
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(media_url)
            resp.raise_for_status()
            file_bytes = resp.content
    except Exception:
        return "AgroSense: couldn't download your photo. Please try again."

    # Run inference
    try:
        tensor = preprocess_bytes(file_bytes)
    except ImageProcessingError:
        return "AgroSense: that file isn't a recognizable photo. Please send a clear plant image."

    predictions = predict(tensor, top_k=1)
    top = predictions[0]

    disease = (
        await db.execute(
            select(Disease).where(Disease.model_class_name == top["class_name"])
        )
    ).scalar_one_or_none()
    display = disease.display_name if disease else top["class_name"]

    # Brief Gemini advice (skip if healthy)
    advice_summary = None
    if disease and "healthy" not in top["class_name"].lower():
        try:
            advice = generate_treatment_advice(
                crop_name=crop_hint or "your crop",
                disease_name=display,
                confidence=top["confidence"],
            )
            advice_summary = advice.get("summary")
        except Exception:
            pass

    return format_diagnosis_sms(display, top["confidence"], advice_summary)


async def _handle_price_check(crop_hint: str | None, db: AsyncSession) -> str:
    if not crop_hint:
        return "AgroSense: which crop? Text 'price tomato' or 'price maize'."

    crop = (
        await db.execute(select(Crop).where(Crop.name.ilike(f"%{crop_hint}%")))
    ).scalar_one_or_none()
    if not crop:
        return f"AgroSense: no prices found for {crop_hint}. Try Tomato, Maize, Pepper."

    rows = (
        await db.execute(
            select(MarketPrice)
            .where(MarketPrice.crop_id == crop.id)
            .order_by(MarketPrice.recorded_at.desc())
            .limit(3)
        )
    ).scalars().all()

    prices = [
        {
            "market": p.market_name,
            "price_kg": float(p.price_per_kg or Decimal("0")),
        }
        for p in rows
    ]
    return format_prices_sms(crop.name, prices)


async def _handle_weather(farmer: Farmer) -> str:
    """For SMS farmers we don't have GPS — default to Accra for MVP."""
    lat, lng = 5.6037, -0.1870  # Accra default
    try:
        data = await get_forecast(lat, lng)
    except Exception:
        return "AgroSense: weather service unavailable. Try again later."

    today = data["daily"]
    high = today["temperature_2m_max"][0]
    low = today["temperature_2m_min"][0]
    rain = today["precipitation_sum"][0]

    advice = "Good day for fieldwork." if rain < 1 else "Rain expected — protect crops."
    if high > 32:
        advice = "Hot day — water crops in the morning."
    return format_weather_sms(high, low, rain, advice)


# ── webhook ──────────────────────────────────────────────────

@router.post("/webhook")
async def twilio_webhook(
    From: str = Form(...),
    Body: str = Form(""),
    NumMedia: int = Form(0),
    MediaUrl0: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    farmer = await _get_or_create_sms_farmer(From, db)

    has_photo = NumMedia > 0 and bool(MediaUrl0)
    body_text = (Body or "").strip()

    # Classify intent
    try:
        classification = classify_sms_intent(body_text, has_photo=has_photo)
        intent = classification.get("intent", "other")
        crop_hint = classification.get("crop_mentioned")
    except Exception:
        # If Gemini fails, fall back to keyword match
        intent = "diagnosis" if has_photo else "other"
        crop_hint = None

    # Dispatch
    diagnosis_id = None
    if intent == "diagnosis":
        reply = await _handle_diagnosis(body_text, MediaUrl0, crop_hint, farmer, db)
    elif intent == "price_check":
        reply = await _handle_price_check(crop_hint, db)
    elif intent == "weather":
        reply = await _handle_weather(farmer)
    elif intent == "help":
        reply = format_help_sms()
    else:
        reply = format_unknown_sms()

    # Log
    db.add(SMSInteraction(
        farmer_id=farmer.id,
        phone_number=From,
        inbound_message=body_text or None,
        inbound_media_url=MediaUrl0,
        outbound_message=reply,
        diagnosis_id=diagnosis_id,
        intent=intent,
    ))
    await db.commit()

    twiml = build_twiml_response(reply)
    return Response(content=twiml, media_type="application/xml")