"""Weather endpoints — forecast and planting advisory."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.farmer import Farmer
from app.schemas.weather import (
    AdvisoryResponse,
    CurrentConditions,
    DailyForecast,
    WeatherResponse,
)
from app.services.auth_dependencies import get_current_farmer
from app.services.catalog import crop_display_name
from app.services.gemini_service import GeminiUnavailable, generate_planting_advisory
from app.services.rate_limit import RateLimit
from app.services.weather_service import get_forecast

logger = logging.getLogger("agrosense.weather")

router = APIRouter(prefix="/api/weather", tags=["weather"])


def _col(daily: dict, key: str, n: int) -> list:
    values = daily.get(key) or []
    return list(values) + [None] * (n - len(values))


def _format_forecast(data: dict) -> WeatherResponse:
    daily_raw = data.get("daily", {}) or {}
    dates = daily_raw.get("time", []) or []
    n = len(dates)
    tmax = _col(daily_raw, "temperature_2m_max", n)
    tmin = _col(daily_raw, "temperature_2m_min", n)
    rain = _col(daily_raw, "precipitation_sum", n)
    prob = _col(daily_raw, "precipitation_probability_max", n)
    wind = _col(daily_raw, "wind_speed_10m_max", n)
    code = _col(daily_raw, "weather_code", n)
    daily = [
        DailyForecast(
            date=dates[i],
            temp_max_c=tmax[i],
            temp_min_c=tmin[i],
            precipitation_mm=rain[i],
            precipitation_probability_pct=prob[i],
            wind_max_kph=wind[i],
            weather_code=code[i],
        )
        for i in range(n)
    ]

    current_raw = data.get("current") or {}
    current = CurrentConditions(
        temperature_c=current_raw.get("temperature_2m"),
        humidity_pct=current_raw.get("relative_humidity_2m"),
        precipitation_mm=current_raw.get("precipitation"),
        wind_kph=current_raw.get("wind_speed_10m"),
        weather_code=current_raw.get("weather_code"),
    ) if current_raw else None

    return WeatherResponse(
        latitude=data["latitude"],
        longitude=data["longitude"],
        timezone=data.get("timezone"),
        current=current,
        daily=daily,
        stale=bool(data.get("stale")),
    )


def _summarize_for_gemini(weather: WeatherResponse) -> str:
    lines = []
    if weather.current:
        lines.append(
            f"Right now: {weather.current.temperature_c}°C, "
            f"{weather.current.humidity_pct}% humidity, "
            f"{weather.current.precipitation_mm} mm precipitation."
        )
    for day in weather.daily:
        lines.append(
            f"{day.date}: high {day.temp_max_c}°C, low {day.temp_min_c}°C, "
            f"{day.precipitation_mm} mm rain expected, "
            f"max wind {day.wind_max_kph} km/h."
        )
    return "\n".join(lines)


def rules_advisory(weather: WeatherResponse, crop_name: str) -> dict:
    """Deterministic advisory used when the LLM is unavailable."""
    days = weather.daily
    rain = [d.precipitation_mm or 0.0 for d in days]
    highs = [d.temp_max_c for d in days if d.temp_max_c is not None]
    total_rain = sum(rain)
    wet_days = sum(1 for r in rain if r >= 2)
    max_high = max(highs) if highs else None
    crop = crop_name.lower()

    recs: list[str] = []
    warnings: list[str] = []

    if total_rain >= 40 or wet_days >= 4:
        headline = f"A wet week ahead — protect your {crop} from waterlogging and leaf disease."
        rainfall = f"About {total_rain:.0f} mm of rain is expected over {wet_days} wet days."
        recs += [
            "Clear drainage channels so water does not stand around the roots.",
            "Hold off on spraying until a dry window of at least 6 hours.",
            "Inspect leaves every two days — fungal disease spreads fast in wet weather.",
        ]
        warnings.append("Heavy, repeated rain raises the risk of blight and leaf spot.")
    elif total_rain >= 10:
        headline = f"Moderate rain this week — a good window for planting and fertilising {crop}."
        rainfall = f"Around {total_rain:.0f} mm of rain is expected, spread over {wet_days} days."
        recs += [
            "Plant or transplant just before the rainy days so seedlings establish.",
            "Apply fertiliser when the soil is moist, not right before heavy rain.",
            "Weed now while the soil is soft.",
        ]
    else:
        headline = f"A mostly dry week — plan irrigation for your {crop}."
        rainfall = f"Very little rain is expected ({total_rain:.0f} mm in total)."
        recs += [
            "Water early in the morning or late in the evening to reduce evaporation.",
            "Mulch around plants to keep moisture in the soil.",
            "Delay planting new seed until rain returns, unless you can irrigate.",
        ]

    if max_high is not None and max_high >= 34:
        temperature = f"Hot days ahead, reaching {max_high:.0f}°C."
        warnings.append("High heat can stress plants and cause flowers to drop. Water consistently.")
    elif max_high is not None:
        temperature = f"Daytime highs around {max_high:.0f}°C — comfortable for most crops."
    else:
        temperature = "Temperature data is unavailable."

    windy = [d for d in days if (d.wind_max_kph or 0) >= 40]
    if windy:
        warnings.append("Strong winds expected on some days. Stake tall plants and avoid spraying then.")

    return {
        "headline": headline,
        "rainfall_outlook": rainfall,
        "temperature_outlook": temperature,
        "recommendations": recs,
        "warnings": warnings,
    }


async def _forecast_or_502(lat: float, lng: float) -> WeatherResponse:
    try:
        data = await get_forecast(lat, lng)
    except Exception as e:
        logger.warning("get_forecast failed: %r", e)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Weather service is temporarily unavailable. Please try again shortly.",
        )
    return _format_forecast(data)


@router.get(
    "",
    response_model=WeatherResponse,
    dependencies=[Depends(RateLimit(60, 60, "weather"))],
)
async def get_weather(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    farmer: Farmer = Depends(get_current_farmer),
):
    """7-day forecast for the given location."""
    return await _forecast_or_502(lat, lng)


@router.get(
    "/advisory",
    response_model=AdvisoryResponse,
    dependencies=[Depends(RateLimit(20, 60, "advisory"))],
)
async def get_advisory(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    crop_name: str | None = Query(None, max_length=100),
    region: str | None = Query(None, max_length=100),
    farmer: Farmer = Depends(get_current_farmer),
):
    """Planting advisory for the 7-day forecast. Defaults to the farmer's
    primary crop and region."""
    weather = await _forecast_or_502(lat, lng)
    crop = crop_display_name(crop_name or farmer.primary_crop) or "maize"
    place = region or (f"{farmer.region} Region, Ghana" if farmer.region else "Ghana")

    try:
        advice = await generate_planting_advisory(
            region=place,
            crop_name=crop,
            forecast_summary=_summarize_for_gemini(weather),
        )
        source = "ai"
        fallback = rules_advisory(weather, crop)
        advice = {
            "headline": str(advice.get("headline") or fallback["headline"]),
            "rainfall_outlook": str(advice.get("rainfall_outlook") or fallback["rainfall_outlook"]),
            "temperature_outlook": str(advice.get("temperature_outlook") or fallback["temperature_outlook"]),
            "recommendations": [str(x) for x in (advice.get("recommendations") or fallback["recommendations"]) if x][:5],
            "warnings": [str(x) for x in (advice.get("warnings") or []) if x and str(x).strip().lower() not in {"none", "n/a"}][:4],
        }
    except (GeminiUnavailable, AttributeError, TypeError):
        advice = rules_advisory(weather, crop)
        source = "rules"

    return AdvisoryResponse(**advice, crop_name=crop, source=source)
