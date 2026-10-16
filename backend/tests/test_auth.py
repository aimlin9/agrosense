import pytest
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.farmer import Farmer
from app.services.phone import InvalidPhoneNumber, normalize_phone


@pytest.mark.parametrize("raw,expected", [
    ("0244123456", "+233244123456"),
    ("024 412 3456", "+233244123456"),
    ("233244123456", "+233244123456"),
    ("+233 24 412 3456", "+233244123456"),
    ("00233244123456", "+233244123456"),
    ("+2348031234567", "+2348031234567"),
])
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["12", "02441234", "hello", "+233 24 412 34567"])
def test_normalize_phone_rejects(raw):
    with pytest.raises(InvalidPhoneNumber):
        normalize_phone(raw)


async def test_register_stores_e164_and_login_with_any_format(client):
    r = await client.post("/api/auth/register", json={"phone_number": "055 900 0001", "password": "password123"})
    assert r.status_code == 201
    assert r.json()["phone_number"] == "+233559000001"
    for variant in ("0559000001", "+233559000001", "233 55 900 0001"):
        r = await client.post("/api/auth/login", json={"phone_number": variant, "password": "password123"})
        assert r.status_code == 200, variant


async def test_duplicate_phone_and_email_return_409(client):
    body = {"phone_number": "0559000002", "password": "password123", "email": "kofi@example.com"}
    assert (await client.post("/api/auth/register", json=body)).status_code == 201
    assert (await client.post("/api/auth/register", json=body)).status_code == 409
    other = {"phone_number": "0559000003", "password": "password123", "email": "KOFI@example.com"}
    r = await client.post("/api/auth/register", json=other)
    assert r.status_code == 409 and "email" in r.json()["detail"].lower()


async def test_invalid_phone_is_422(client):
    r = await client.post("/api/auth/register", json={"phone_number": "123456789", "password": "password123"})
    assert r.status_code == 422


async def test_wrong_password_401(client, farmer):
    phone, _, _ = farmer
    r = await client.post("/api/auth/login", json={"phone_number": phone, "password": "nope-nope"})
    assert r.status_code == 401


async def test_me_and_update_profile(client, farmer):
    _, _, h = farmer
    r = await client.get("/api/auth/me", headers=h)
    assert r.status_code == 200
    me = r.json()
    assert me["full_name"] == "Ama Mensah" and "gps_lat" in me
    r = await client.patch("/api/auth/me", headers=h, json={"district": "Ejura", "gps_lat": 7.38, "gps_lng": -1.36})
    assert r.status_code == 200 and r.json()["district"] == "Ejura" and r.json()["gps_lat"] == 7.38


async def test_single_session_and_logout(client, farmer):
    phone, password, old = farmer
    r = await client.post("/api/auth/login", json={"phone_number": phone, "password": password})
    new = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = await client.get("/api/auth/me", headers=old)
    assert r.status_code == 401 and r.json()["detail"] == "session_invalidated"
    assert (await client.get("/api/auth/me", headers=new)).status_code == 200
    assert (await client.post("/api/auth/logout", headers=new)).status_code == 204
    assert (await client.get("/api/auth/me", headers=new)).status_code == 401


async def test_change_password(client, farmer):
    phone, password, h = farmer
    r = await client.post("/api/auth/me/password", headers=h, json={"current_password": "wrong", "new_password": "brand-new-pass"})
    assert r.status_code == 400
    r = await client.post("/api/auth/me/password", headers=h, json={"current_password": password, "new_password": "brand-new-pass"})
    assert r.status_code == 200
    r = await client.post("/api/auth/login", json={"phone_number": phone, "password": "brand-new-pass"})
    assert r.status_code == 200


async def test_sms_only_farmer_can_claim_account(client):
    async with AsyncSessionLocal() as db:
        db.add(Farmer(phone_number="+233559000099", password_hash="sms-no-login", is_sms_user=True))
        await db.commit()
    # The legacy placeholder hash must not crash login.
    r = await client.post("/api/auth/login", json={"phone_number": "0559000099", "password": "whatever1"})
    assert r.status_code == 401
    r = await client.post("/api/auth/register", json={"phone_number": "0559000099", "password": "password123", "full_name": "Yaw"})
    assert r.status_code == 201
    r = await client.post("/api/auth/login", json={"phone_number": "0559000099", "password": "password123"})
    assert r.status_code == 200
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Farmer).where(Farmer.phone_number == "+233559000099"))).scalars().all()
        assert len(rows) == 1


async def test_login_rate_limited(client):
    body = {"phone_number": "0559111111", "password": "password123"}
    codes = [(await client.post("/api/auth/login", json=body)).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10
    assert codes[-1] == 429


async def test_google_without_config_is_401(client):
    r = await client.post("/api/auth/google", json={"id_token": "x" * 40})
    assert r.status_code == 401


async def test_delete_account(client, farmer):
    _, _, h = farmer
    assert (await client.delete("/api/auth/me", headers=h)).status_code == 204
    assert (await client.get("/api/auth/me", headers=h)).status_code == 401
