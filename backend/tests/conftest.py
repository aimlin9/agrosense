"""Test harness.

Runs the real app (real TFLite model, real routers, real SQL) against a
throwaway SQLite database. Redis, Gemini and R2 are deliberately left
unconfigured so every test also exercises the graceful-degradation paths.
"""
import json
import os
import tempfile
from pathlib import Path

_db_file = Path(tempfile.gettempdir()) / "agrosense_test.db"
if _db_file.exists():
    _db_file.unlink()

os.environ.update(
    DATABASE_URL=f"sqlite+aiosqlite:///{_db_file.as_posix()}",
    REDIS_URL="redis://127.0.0.1:1/0",  # nothing listens here
    SECRET_KEY="test-secret-key-that-is-long-enough-123456",
    GEMINI_API_KEY="",
    R2_ENDPOINT_URL="",
    TWILIO_AUTH_TOKEN="",
    GOOGLE_WEB_CLIENT_ID="",
    AUTO_INDICATIVE_PRICES="false",
)

import httpx  # noqa: E402
import pytest  # noqa: E402

import app.models  # noqa: E402,F401
from app.database import AsyncSessionLocal, Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.crop import Crop  # noqa: E402
from app.models.disease import Disease  # noqa: E402
from app.services import rate_limit  # noqa: E402
from app.services.ml_service import load_model  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
async def database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    classes = json.loads((BACKEND / "ml" / "class_names.json").read_text())
    async with AsyncSessionLocal() as db:
        crops: dict[str, Crop] = {}
        for cn in classes:
            crop_name = cn.split("___")[0].replace("_", " ").strip()
            if crop_name not in crops:
                crops[crop_name] = Crop(name=crop_name)
                db.add(crops[crop_name])
        db.add(Crop(name="Cassava"))  # a crop the model doesn't know
        await db.flush()
        for cn in classes:
            crop_name = cn.split("___")[0].replace("_", " ").strip()
            db.add(Disease(crop_id=crops[crop_name].id, model_class_name=cn, display_name=cn))
        await db.commit()
    load_model()
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
def reset_rate_limits():
    rate_limit._memory_windows.clear()
    yield


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


_counter = iter(range(100000))


@pytest.fixture
async def farmer(client):
    """Registers a fresh farmer and returns (phone, password, headers)."""
    n = next(_counter)
    phone = f"024{n:07d}"
    password = "correct-horse-1"
    r = await client.post("/api/auth/register", json={
        "phone_number": phone, "password": password, "full_name": "Ama Mensah",
        "region": "Ashanti", "primary_crop": "Tomato",
    })
    assert r.status_code == 201, r.text
    r = await client.post("/api/auth/login", json={"phone_number": phone, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    rate_limit._memory_windows.clear()
    return phone, password, {"Authorization": f"Bearer {token}"}
