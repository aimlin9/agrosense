from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.crop import Crop
from app.models.market_price import MarketPrice
from app.routers.weather import rules_advisory
from app.schemas.weather import DailyForecast, WeatherResponse


async def test_root_and_health(client):
    assert (await client.get("/")).json()["status"] == "operational"
    assert (await client.get("/health")).status_code == 200
    assert (await client.head("/health")).status_code == 200
    r = await client.get("/health/ready")
    assert r.json()["model"] is True and r.json()["redis"] is False


async def test_latest_prices_computes_real_change(client):
    async with AsyncSessionLocal() as db:
        tomato = (await db.execute(select(Crop).where(Crop.name == "Tomato"))).scalar_one()
        now = datetime.now(timezone.utc)
        for i, price in enumerate(["10.00"] * 8 + ["11.00"] * 7):
            db.add(MarketPrice(crop_id=tomato.id, market_name="Makola Market", region="Greater Accra",
                               price_per_kg=Decimal(price), recorded_at=now - timedelta(days=14 - i), source="test"))
        await db.commit()
        tid = str(tomato.id)
    rows = (await client.get("/api/prices/latest", params={"crop_id": tid})).json()
    makola = next(r for r in rows if r["market_name"] == "Makola Market")
    assert makola["trend"] == "up" and makola["change_pct_7d"] == 10.0
    assert len(makola["history"]) == 14
    assert makola["crop_name"] == "Tomato"


def _weather(rain):
    return WeatherResponse(latitude=5.6, longitude=-0.2, daily=[
        DailyForecast(date=f"2026-10-{10 + i}", temp_max_c=35, temp_min_c=24, precipitation_mm=r, wind_max_kph=10)
        for i, r in enumerate(rain)
    ])


def test_rules_advisory_wet_and_dry():
    wet = rules_advisory(_weather([12, 15, 8, 10, 3, 0, 0]), "Tomato")
    assert "wet" in wet["headline"].lower() and wet["warnings"]
    dry = rules_advisory(_weather([0] * 7), "Maize")
    assert "dry" in dry["headline"].lower()
    assert any("heat" in w.lower() for w in dry["warnings"])


async def test_sms_help_and_price(client):
    r = await client.post("/api/sms/webhook", data={"From": "+233201234567", "Body": "help"})
    assert r.status_code == 200 and "AgroSense help" in r.text
    r = await client.post("/api/sms/webhook", data={"From": "+233201234567", "Body": "price tomato"})
    assert r.status_code == 200 and "Tomato prices" in r.text


async def test_admin_login_wrong_creds(client):
    r = await client.post("/api/auth/admin/login", json={"email": "nobody@x.com", "password": "nope"})
    assert r.status_code == 401
