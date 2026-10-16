"""SMS webhook — Twilio POSTs here when a farmer texts our number.

Pipeline:
  1. Verify the request really came from Twilio (X-Twilio-Signature)
  2. Look up or create the Farmer record by phone
  3. Classify intent (keywords first, Gemini for ambiguous messages)
  4. Dispatch to handler (diagnosis / prices / weather / help / unknown)
  5. Save SMSInteraction log
  6. Return TwiML reply
"""
import logging
from decimal import Decimal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.request_validator import RequestValidator

from app.config import settings
from app.database import get_db
from app.models.crop import Crop
from app.models.farmer import Farmer
from app.models.market_price import MarketPrice
from app.models.sms_interaction import SMSInteraction
from app.routers.diagnose import run_diagnosis_pipeline
from app.services.catalog import crop_display_name
from app.services.gemini_service import classify_sms_intent
from app.services.phone import InvalidPhoneNumber, normalize_phone
from app.services.sms_formatters import (
    format_diagnosis_sms,
    format_help_sms,
    format_prices_sms,
    format_unknown_sms,
    format_weather_sms,
)
from app.services.sms_service import build_twiml_response
from app.services.weather_service import get_forecast

logger = logging.getLogger("agrosense.sms")

router = APIRouter(prefix="/api/sms", tags=["sms"])

ACCRA = (5.6037, -0.1870)
_CROP_ALIASES = {"maize": "Corn (maize)", "corn": "Corn (maize)", "pepper": "Pepper, bell"}


def _public_url(request: Request) -> str:
    """The URL Twilio signed — reconstructed behind Render's proxy."""
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc))
    url = f"{proto}://{host}{request.url.path}"
    if request.url.query:
        url += f"?{request.url.query}"
    return url


async def _verify_twilio(request: Request, form: dict) -> None:
    if not (settings.twilio_validate_signature and settings.twilio_auth_token):
        return
    signature = request.headers.get("x-twilio-signature", "")
    validator = RequestValidator(settings.twilio_auth_token)
    if not validator.validate(_public_url(request), form, signature):
        logger.warning("Rejected SMS webhook with invalid Twilio signature")
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid signature")


async def _get_or_create_sms_farmer(phone: str, db: AsyncSession) -> Farmer:
    """SMS farmers don't register — auto-create a minimal Farmer row."""
    farmer = (
        await db.execute(select(Farmer).where(Farmer.phone_number == phone))
    ).scalars().first()
    if farmer:
        return farmer
    farmer = Farmer(
        phone_number=phone,
        full_name=None,
        password_hash=None,  # can't log in until they register in the app
        is_sms_user=True,
        auth_provider="phone",
        profile_complete=True,
    )
    db.add(farmer)
    await db.flush()
    return farmer


async def _find_crop(crop_hint: str | None, db: AsyncSession) -> Crop | None:
    if not crop_hint:
        return None
    name = _CROP_ALIASES.get(crop_hint.lower(), crop_hint)
    return (
        await db.execute(select(Crop).where(Crop.name.ilike(f"%{name}%")).order_by(Crop.name))
    ).scalars().first()


async def _handle_diagnosis(
    media_url: str | None,
    crop_hint: str | None,
    farmer: Farmer,
    db: AsyncSession,
):
    """Returns (reply, diagnosis_id)."""
    if not media_url:
        return (
            "AgroSense: please send a clear photo of one sick leaf, and the crop name "
            "(e.g. 'tomato'). Text HELP for options.",
            None,
        )
    auth = (settings.twilio_account_sid, settings.twilio_auth_token) if settings.twilio_auth_token else None
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(media_url, auth=auth)
            resp.raise_for_status()
            file_bytes = resp.content
    except Exception as e:
        logger.warning("SMS media download failed: %r", e)
        return "AgroSense: we couldn't download your photo. Please try again.", None

    crop = await _find_crop(crop_hint, db)
    try:
        row, result = await run_diagnosis_pipeline(
            file_bytes=file_bytes,
            crop=crop,
            farmer=farmer,
            db=db,
            channel="sms",
        )
    except HTTPException:
        return "AgroSense: that file isn't a photo we can read. Please send a clear plant image.", None

    advice = result["treatment_advice"]
    reply = format_diagnosis_sms(
        f"{result['crop_name']} - {result['predicted_disease']}",
        result["confidence"],
        advice.immediate_actions[0] if advice and advice.immediate_actions else None,
    )
    return reply, row.id


async def _handle_price_check(crop_hint: str | None, db: AsyncSession) -> str:
    if not crop_hint:
        return "AgroSense: which crop? Text 'price tomato' or 'price maize'."
    crop = await _find_crop(crop_hint, db)
    if not crop:
        return f"AgroSense: no prices found for {crop_hint}. Try tomato, maize or pepper."

    rows = (
        await db.execute(
            select(MarketPrice)
            .where(MarketPrice.crop_id == crop.id)
            .order_by(MarketPrice.recorded_at.desc())
            .limit(30)
        )
    ).scalars().all()
    latest: dict[str, MarketPrice] = {}
    for p in rows:
        latest.setdefault(p.market_name, p)
    prices = [
        {"market": p.market_name.replace(" Market", "").replace(" Central", ""),
         "price_kg": float(p.price_per_kg or Decimal("0"))}
        for p in list(latest.values())[:3]
    ]
    return format_prices_sms(crop_display_name(crop.name), prices)


async def _handle_weather(farmer: Farmer) -> str:
    lat, lng = (farmer.gps_lat, farmer.gps_lng) if farmer.gps_lat and farmer.gps_lng else ACCRA
    try:
        data = await get_forecast(lat, lng)
        daily = data["daily"]
        high = daily["temperature_2m_max"][0] or 0.0
        low = daily["temperature_2m_min"][0] or 0.0
        rain = daily["precipitation_sum"][0] or 0.0
    except Exception:
        return "AgroSense: weather service unavailable. Try again later."

    advice = "Good day for fieldwork." if rain < 1 else "Rain expected - hold off on spraying."
    if high > 32:
        advice = "Hot day - water crops early in the morning."
    return format_weather_sms(high, low, rain, advice)


# No IP rate limit here: every request comes from Twilio's IPs, so it would
# throttle all farmers together. The signature check is the guard.
@router.post("/webhook")
async def twilio_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    form = {k: v for k, v in (await request.form()).items() if isinstance(v, str)}
    await _verify_twilio(request, form)

    raw_from = form.get("From", "")
    try:
        phone = normalize_phone(raw_from)
    except InvalidPhoneNumber:
        phone = raw_from.strip()
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Missing From")

    body_text = (form.get("Body") or "").strip()
    try:
        num_media = int(form.get("NumMedia") or 0)
    except ValueError:
        num_media = 0
    media_url = form.get("MediaUrl0") or None
    has_photo = num_media > 0 and bool(media_url)

    farmer = await _get_or_create_sms_farmer(phone, db)

    classification = await classify_sms_intent(body_text, has_photo=has_photo)
    intent = classification.get("intent", "other")
    crop_hint = classification.get("crop_mentioned")

    diagnosis_id = None
    if intent == "diagnosis":
        reply, diagnosis_id = await _handle_diagnosis(media_url, crop_hint, farmer, db)
    elif intent == "price_check":
        reply = await _handle_price_check(crop_hint, db)
    elif intent == "weather":
        reply = await _handle_weather(farmer)
    elif intent == "help":
        reply = format_help_sms()
    else:
        reply = format_unknown_sms()

    db.add(SMSInteraction(
        farmer_id=farmer.id,
        phone_number=phone,
        inbound_message=body_text or None,
        inbound_media_url=media_url,
        outbound_message=reply,
        diagnosis_id=diagnosis_id,
        intent=intent,
    ))
    await db.commit()

    return Response(content=build_twiml_response(reply), media_type="application/xml")
