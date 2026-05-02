from pydantic import BaseModel


class CurrentConditions(BaseModel):
    temperature_c: float | None = None
    humidity_pct: float | None = None
    precipitation_mm: float | None = None
    wind_kph: float | None = None
    weather_code: int | None = None


class DailyForecast(BaseModel):
    date: str
    temp_max_c: float | None = None
    temp_min_c: float | None = None
    precipitation_mm: float | None = None
    wind_max_kph: float | None = None
    weather_code: int | None = None


class WeatherResponse(BaseModel):
    latitude: float
    longitude: float
    timezone: str | None = None
    current: CurrentConditions | None = None
    daily: list[DailyForecast]
    cached: bool = False


class AdvisoryResponse(BaseModel):
    headline: str
    rainfall_outlook: str
    temperature_outlook: str
    recommendations: list[str]
    warnings: list[str] = []