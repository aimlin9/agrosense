"""Gemini service for generating farmer-friendly treatment advice.

Given a predicted disease (e.g., "Tomato Late Blight") and crop name,
calls Gemini 1.5 Flash to produce structured treatment advice tailored
to Ghanaian smallholder farmers.

Returns structured JSON the frontend can render directly.
"""

import json
import re

import google.generativeai as genai

from app.config import settings


# Configure the Gemini SDK once at module import
genai.configure(api_key=settings.gemini_api_key)

# Gemini 1.5 Flash: fast, cheap, plenty smart for this task. Free tier is generous.
_model = genai.GenerativeModel("gemini-2.5-flash")


# ── Prompt template ────────────────────────────────────────────────
# Carefully crafted to (a) localize advice to Ghana, (b) prefer organic options,
# (c) return JSON we can parse, (d) acknowledge uncertainty.
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
- If the prediction says "healthy", briefly confirm what to keep doing.

Respond ONLY with valid JSON in exactly this shape (no markdown, no commentary):

{{
  "severity": "low" | "moderate" | "high" | "none",
  "summary": "2-3 sentence plain-English explanation of what this disease is",
  "immediate_actions": ["Action 1", "Action 2", "Action 3"],
  "organic_treatment": "Organic/cultural treatment in 1-2 sentences",
  "chemical_treatment": "Chemical treatment if needed, in 1-2 sentences. Or null if not needed.",
  "prevention": "How to prevent recurrence, in 1-2 sentences"
}}
"""


def _extract_json(text: str) -> dict:
    """Extract JSON from Gemini's response.
    
    Gemini sometimes wraps JSON in ```json ... ``` despite our instruction not to.
    This finds the first { and last } and parses what's between.
    """
    # Strip optional code fences
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # Find the JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON found in Gemini response: {text[:200]}")
    
    return json.loads(text[start : end + 1])


def generate_treatment_advice(
    crop_name: str,
    disease_name: str,
    confidence: float,
) -> dict:
    """Get structured treatment advice from Gemini.
    
    Args:
        crop_name: e.g., "Tomato"
        disease_name: e.g., "Late blight" (the human-readable form)
        confidence: 0.0 to 1.0
    
    Returns:
        Dict with keys: severity, summary, immediate_actions, organic_treatment,
        chemical_treatment, prevention. See _PROMPT_TEMPLATE for exact shape.
    
    Raises:
        ValueError if Gemini returns malformed output.
    """
    confidence_pct = round(confidence * 100)
    prompt = _PROMPT_TEMPLATE.format(
        crop_name=crop_name,
        disease_name=disease_name,
        confidence_pct=confidence_pct,
    )

    response = _model.generate_content(prompt)
    advice = _extract_json(response.text)
    
    return advice