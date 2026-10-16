"""Gemini service — treatment advice, planting advisories, SMS intent.

All public functions are async and safe to call from request handlers: the
blocking SDK call runs in a worker thread with a hard timeout, results are
cached in Redis, and callers get a clear exception they can fall back from.
"""
import asyncio
import hashlib
import json
import logging
import re

import google.generativeai as genai

from app.config import settings
from app.services.redis_client import cache_get_json, cache_set_json

logger = logging.getLogger("agrosense.gemini")

if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)

_model = genai.GenerativeModel(
    settings.gemini_model,
    generation_config={"response_mime_type": "application/json", "temperature": 0.4},
)

ADVICE_TTL = 7 * 24 * 3600      # treatment advice doesn't change week to week
ADVISORY_TTL = 6 * 3600         # matches the weather cache
INTENT_TTL = 24 * 3600


class GeminiUnavailable(RuntimeError):
    pass


_PROMPT_TEMPLATE = """\
You are an agricultural advisor for smallholder farmers in Ghana, West Africa.

A farmer's plant has been diagnosed with the following condition:

  Crop:       {crop_name}
  Disease:    {disease_name}
  Confidence: {confidence_pct}%

Write practical treatment advice for this farmer. Constraints:
- Recommend products and methods available in Ghana (not US-only brands).
- Always offer organic/cultural options before chemical pesticides.
- Be specific and actionable; avoid generic platitudes.
- Use simple English; the farmer may have limited formal education.
- If confidence is below 70%, emphasize getting a second opinion from an extension officer.

Respond ONLY with JSON in exactly this shape:

{{
  "severity": "low" | "moderate" | "high",
  "summary": "2-3 sentence plain-English explanation of what this disease is",
  "immediate_actions": ["Action 1", "Action 2", "Action 3"],
  "organic_treatment": "Organic/cultural treatment in 1-2 sentences",
  "chemical_treatment": "Chemical treatment if needed, in 1-2 sentences, or null",
  "prevention": "How to prevent recurrence, in 1-2 sentences"
}}
"""

_ADVISORY_TEMPLATE = """\
You are an agricultural advisor for Ghanaian smallholder farmers.

Based on this 7-day weather forecast, give the farmer simple, actionable planting/farming advice.

Location: {region}
Crop being grown: {crop_name}

Forecast summary:
{forecast_summary}

Respond ONLY with JSON in exactly this shape:

{{
  "headline": "One sentence summarizing what the farmer should focus on this week",
  "rainfall_outlook": "1-2 sentence rainfall summary in plain English",
  "temperature_outlook": "1-2 sentence temperature summary",
  "recommendations": ["Action 1", "Action 2", "Action 3"],
  "warnings": ["Warning 1 if any"]
}}
"""

_INTENT_TEMPLATE = """\
Classify this farmer's SMS into ONE intent. They are smallholder farmers in Ghana.

Message: "{message}"
Has photo: {has_photo}

Possible intents:
- diagnosis: farmer describes a sick plant or sends a photo of one
- price_check: farmer asks about market prices
- weather: farmer asks about weather, rain, planting time
- help: farmer asks how to use the service, or sends "HELP"
- other: anything else, including greetings

Respond ONLY with JSON in exactly this shape:

{{
  "intent": "diagnosis" | "price_check" | "weather" | "help" | "other",
  "crop_mentioned": "Tomato" | "Maize" | "Pepper" | "Potato" | null,
  "summary": "Short rephrasing of what the farmer wants"
}}
"""


def _extract_json(text: str) -> dict:
    """Parse JSON from a model response, tolerating stray code fences."""
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON found in Gemini response: {text[:200]}")
    return json.loads(text[start : end + 1])


def _generate_sync(prompt: str) -> dict:
    response = _model.generate_content(
        prompt,
        request_options={"timeout": settings.gemini_timeout_seconds},
    )
    return _extract_json(response.text)


async def _generate(prompt: str) -> dict:
    if not settings.gemini_api_key:
        raise GeminiUnavailable("GEMINI_API_KEY is not configured")
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_generate_sync, prompt),
            timeout=settings.gemini_timeout_seconds + 5,
        )
    except Exception as e:
        logger.warning("Gemini call failed: %r", e)
        raise GeminiUnavailable(str(e)) from e


def _key(*parts: object) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()


async def generate_treatment_advice(crop_name: str, disease_name: str, confidence: float) -> dict:
    """Structured treatment advice. Cached per disease and confidence band."""
    band = "low" if confidence < 0.7 else "high"
    cache_key = f"advice:v2:{_key(crop_name.lower(), disease_name.lower(), band)}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    prompt = _PROMPT_TEMPLATE.format(
        crop_name=crop_name,
        disease_name=disease_name,
        confidence_pct=round(confidence * 100),
    )
    advice = await _generate(prompt)
    await cache_set_json(cache_key, advice, ADVICE_TTL)
    return advice


async def generate_planting_advisory(region: str, crop_name: str, forecast_summary: str) -> dict:
    cache_key = f"advisory:v2:{_key(region.lower(), crop_name.lower(), forecast_summary)}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    prompt = _ADVISORY_TEMPLATE.format(
        region=region,
        crop_name=crop_name,
        forecast_summary=forecast_summary,
    )
    advisory = await _generate(prompt)
    await cache_set_json(cache_key, advisory, ADVISORY_TTL)
    return advisory


_KEYWORDS = {
    "price_check": ("price", "cost", "sell", "market", "how much", "sika"),
    "weather": ("weather", "rain", "sun", "forecast", "plant when", "nsuo"),
    "help": ("help", "menu", "start", "info"),
}
_CROP_WORDS = {
    "tomato": "Tomato", "maize": "Maize", "corn": "Maize", "pepper": "Pepper",
    "potato": "Potato", "orange": "Orange", "apple": "Apple", "grape": "Grape",
    "squash": "Squash", "strawberry": "Strawberry", "peach": "Peach",
}


def classify_sms_keywords(message: str, has_photo: bool) -> dict:
    """Deterministic classifier — used first (free, instant) and as fallback."""
    m = (message or "").lower()
    crop = next((v for k, v in _CROP_WORDS.items() if k in m), None)
    if has_photo:
        intent = "diagnosis"
    else:
        intent = next((i for i, words in _KEYWORDS.items() if any(w in m for w in words)), "other")
    return {"intent": intent, "crop_mentioned": crop, "summary": message[:80]}


async def classify_sms_intent(message: str, has_photo: bool = False) -> dict:
    """Keyword match first; only ask Gemini when the message is ambiguous."""
    quick = classify_sms_keywords(message, has_photo)
    if quick["intent"] != "other" or not (message or "").strip():
        return quick

    cache_key = f"intent:v1:{_key(message.lower().strip())}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return cached
    try:
        result = await _generate(_INTENT_TEMPLATE.format(message=message, has_photo=has_photo))
    except GeminiUnavailable:
        return quick
    await cache_set_json(cache_key, result, INTENT_TTL)
    return result
