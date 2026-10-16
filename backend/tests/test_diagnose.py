import io
from pathlib import Path

from PIL import Image

from app.services.catalog import disease_display_name, fallback_advice, normalize_advice

TOMATO = (Path(__file__).resolve().parent / "fixtures" / "tomato_leaf.jpg").read_bytes()


async def _crop_id(client, name):
    crops = (await client.get("/api/crops")).json()
    return next(c["id"] for c in crops if c["name"] == name)


async def test_crops_have_clean_names(client):
    crops = (await client.get("/api/crops")).json()
    names = [c["name"] for c in crops]
    assert "Maize" in names and "Bell pepper" in names and "Corn (maize)" not in names
    assert names[0] == "Tomato"
    cassava = next(c for c in crops if c["name"] == "Cassava")
    assert cassava["supported"] is False


async def test_full_diagnosis_pipeline_degrades_gracefully(client, farmer):
    _, _, h = farmer
    crop_id = await _crop_id(client, "Tomato")
    r = await client.post(
        "/api/diagnose", headers=h,
        data={"crop_id": crop_id},
        files={"file": ("leaf.jpg", TOMATO, "image/jpeg")},
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["crop_name"] == "Tomato"
    assert d["crop_supported"] is True
    assert all(p["class_name"].startswith("Tomato___") for p in d["top_predictions"])
    assert 0 < d["confidence"] <= 1
    # No Gemini key in tests, so curated advice — never empty.
    assert d["advice_source"] == "curated"
    assert d["treatment_advice"]["summary"]
    assert d["image_url"] is None  # R2 not configured; diagnosis still succeeds

    items = (await client.get("/api/diagnoses", headers=h)).json()
    assert items[0]["id"] == d["id"]
    detail = (await client.get(f"/api/diagnoses/{d['id']}", headers=h)).json()
    assert detail["predicted_disease"] == d["predicted_disease"]
    assert detail["treatment_advice"]["immediate_actions"]
    stats = (await client.get("/api/diagnoses/stats", headers=h)).json()
    assert stats["total"] == 1 and stats["today"] == 1

    assert (await client.delete(f"/api/diagnoses/{d['id']}", headers=h)).status_code == 204
    assert (await client.get(f"/api/diagnoses/{d['id']}", headers=h)).status_code == 404


async def test_unsupported_crop_is_flagged(client, farmer):
    _, _, h = farmer
    r = await client.post(
        "/api/diagnose", headers=h,
        data={"crop_id": await _crop_id(client, "Cassava")},
        files={"file": ("leaf.jpg", TOMATO, "image/jpeg")},
    )
    assert r.status_code == 200
    d = r.json()
    assert d["crop_supported"] is False and d["low_confidence"] is True


async def test_rejects_non_image_and_oversize(client, farmer):
    _, _, h = farmer
    crop_id = await _crop_id(client, "Tomato")
    r = await client.post("/api/diagnose", headers=h, data={"crop_id": crop_id},
                          files={"file": ("x.jpg", b"not an image at all", "image/jpeg")})
    assert r.status_code == 400
    r = await client.post("/api/diagnose", headers=h, data={"crop_id": crop_id},
                          files={"file": ("x.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 415
    big = b"\xff" * (10 * 1024 * 1024 + 10)
    r = await client.post("/api/diagnose", headers=h, data={"crop_id": crop_id},
                          files={"file": ("x.jpg", big, "image/jpeg")})
    assert r.status_code == 413


async def test_png_with_alpha_works(client, farmer):
    _, _, h = farmer
    buf = io.BytesIO()
    Image.open(io.BytesIO(TOMATO)).convert("RGBA").save(buf, format="PNG")
    r = await client.post("/api/diagnose", headers=h, data={"crop_id": await _crop_id(client, "Tomato")},
                          files={"file": ("leaf.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200


async def test_diagnose_requires_auth(client):
    r = await client.post("/api/diagnose", data={"crop_id": "x"}, files={"file": ("a.jpg", TOMATO, "image/jpeg")})
    assert r.status_code in (401, 403)


def test_catalog_names():
    assert disease_display_name("Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot") == "Gray leaf spot"
    assert disease_display_name("Tomato___healthy") == "Healthy"


def test_normalize_advice_repairs_bad_llm_output():
    out = normalize_advice({"severity": "CATASTROPHIC", "immediate_actions": "spray"}, "Tomato___Late_blight", 0.9)
    assert out["severity"] == "high"
    assert isinstance(out["immediate_actions"], list) and out["immediate_actions"]
    assert out["summary"]


def test_low_confidence_fallback_warns():
    adv = fallback_advice("Tomato___Early_blight", 0.4)
    assert "not sure" in adv["immediate_actions"][0]
