"""Format service responses into SMS-friendly text under 320 chars."""


def format_diagnosis_sms(disease: str, confidence: float, advice_summary: str | None) -> str:
    """Tight diagnosis reply for SMS."""
    conf_pct = round(confidence * 100)
    parts = [f"AgroSense diagnosis: {disease} ({conf_pct}% confident)."]
    if advice_summary:
        parts.append(advice_summary[:180])
    parts.append("Reply HELP for more options.")
    return " ".join(parts)[:320]


def format_prices_sms(crop_name: str, prices: list[dict]) -> str:
    """Latest prices summary."""
    if not prices:
        return f"AgroSense: no recent {crop_name} prices found. Try another crop."
    top = prices[:3]
    lines = [f"{crop_name} prices (GHS/kg):"]
    for p in top:
        lines.append(f"- {p['market']}: {p['price_kg']:.2f}")
    return "AgroSense: " + " ".join(lines)[:300]


def format_weather_sms(today_high: float, today_low: float, rain_mm: float, advice: str) -> str:
    """Weather + brief advice."""
    return (
        f"AgroSense weather: {today_low:.0f}-{today_high:.0f}°C today, "
        f"{rain_mm:.1f}mm rain. {advice[:180]}"
    )[:320]


def format_help_sms() -> str:
    return (
        "AgroSense help:\n"
        "• Send a photo of a sick plant for diagnosis\n"
        "• Text 'price tomato' for market prices\n"
        "• Text 'weather' for forecast\n"
        "• Reply STOP to opt out"
    )


def format_unknown_sms() -> str:
    return (
        "AgroSense didn't understand. "
        "Send a photo of a sick plant, "
        "or text 'price <crop>' or 'weather'. "
        "Text HELP for options."
    )