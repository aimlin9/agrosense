"""Weather endpoints — forecast and Gemini-powered advisory."""
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.farmer import Farmer
from app.schemas.weather import (
    AdvisoryResponse,
    CurrentConditions,
    DailyForecast,
    WeatherResponse,
)
from app.services.auth_dependencies import get_current_farmer
from app.services.gemini_service import generate_planting_advisory
from app.services.weather_service import get_forecast


router = APIRouter(prefix="/api/weather", tags=["weather"])


def _format_forecast(data: dict) -> WeatherResponse:
    daily_raw = data.get("daily", {})
    dates = daily_raw.get("time", [])
    daily = [
        DailyForecast(
            date=dates[i],
            temp_max_c=daily_raw.get("temperature_2m_max", [None] * len(dates))[i],
            temp_min_c=daily_raw.get("temperature_2m_min", [None] * len(dates))[i],
            precipitation_mm=daily_raw.get("precipitation_sum", [None] * len(dates))[i],
            wind_max_kph=daily_raw.get("wind_speed_10m_max", [None] * len(dates))[i],
            weather_code=daily_raw.get("weather_code", [None] * len(dates))[i],
        )
        for i in range(len(dates))
    ]

    current_raw = data.get("current", {})
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


@router.get("", response_model=WeatherResponse)
async def get_weather(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    farmer: Farmer = Depends(get_current_farmer),
):
    """7-day forecast for the given location."""
    try:
        data = await get_forecast(lat, lng)
    except Exception as e:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"Weather service unavailable: {e}",
        )
    return _format_forecast(data)


@router.get("/advisory", response_model=AdvisoryResponse)
async def get_advisory(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    crop_name: str = Query("maize"),
    region: str = Query("Ghana"),
    farmer: Farmer = Depends(get_current_farmer),
):
    """Gemini planting advisory based on the 7-day forecast."""
    try:
        data = await get_forecast(lat, lng)
    except Exception as e:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"Weather service unavailable: {e}",
        )

    weather = _format_forecast(data)
    summary = _summarize_for_gemini(weather)

    try:
        advice = generate_planting_advisory(
            region=region,
            crop_name=crop_name,
            forecast_summary=summary,
        )
    except Exception as e:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"Advisory service unavailable: {e}",
        )

    return AdvisoryResponse(**advice)