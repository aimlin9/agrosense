# 🌱 AgroSense

**AI-powered crop disease advisory for smallholder farmers in West Africa.**

A farmer photographs a diseased crop. Within seconds the system identifies the disease using a fine-tuned MobileNetV2 model, generates farmer-friendly treatment advice via Gemini, and stores everything for follow-up. Built mobile-first, with an SMS fallback planned for farmers without smartphones.

---

## 📊 The Model

Two-phase transfer learning on MobileNetV2, fine-tuned on PlantVillage (54,305 images, 38 disease classes, 14 crops). Trained on a free Kaggle P100 GPU.

| Phase | What happened | Best val accuracy |
|---|---|---|
| **1** — frozen base | Train classification head only, lr = 1e-3, 10 epochs | **94.6%** |
| **2** — fine-tune | Unfreeze top 30 layers, lr = 1e-5 (100× smaller), 10 epochs | **97.28%** |

Final model: **2.7 MB TFLite file** with default quantization. Negligible accuracy loss vs the Keras original.

### Training curves

![Training curves — Phase 1 + Phase 2](notebooks/training_curves_combined.png)

The dashed vertical line marks the Phase 1 → Phase 2 transition. Notice the brief training-loss spike at epoch 11 (the "fine-tuning shock" as previously-frozen weights start receiving gradients), followed by recovery and a steady climb to 97.28%.

### Predictions on held-out validation images

![Sample predictions on validation set](notebooks/predictions_sample.png)

12 out of 12 correct on a randomly sampled batch from the validation set. Most predictions at 99–100% confidence. The model expresses appropriate uncertainty on visually ambiguous cases — e.g., the Tomato Septoria leaf spot at 53.9% — which is exactly the behavior we want for safety-critical advice.

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│  Mobile / SMS   │────▶│        FastAPI Backend               │
│  (planned)      │     │                                      │
└─────────────────┘     │  ┌─────────────────────────────────┐ │
                        │  │  POST /api/diagnose             │ │
                        │  └────────┬────────────────────────┘ │
                        │           │                          │
                        │           ▼                          │
                        │  1. Validate JWT + crop_id           │
                        │  2. Upload photo → Cloudflare R2     │
                        │  3. Preprocess (Pillow → 224×224)    │
                        │  4. TFLite inference (top-3)         │
                        │  5. Disease lookup (PostgreSQL)      │
                        │  6. Treatment advice (Gemini 2.5)    │
                        │  7. Persist Diagnosis row            │
                        │  8. Return JSON response             │
                        └──────────────────────────────────────┘
```

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| **ML training** | TensorFlow 2.19 + Keras (Kaggle P100 GPU) |
| **Inference** | TFLite via `tf.lite.Interpreter` (singleton, loaded at startup) |
| **Backend** | FastAPI + async SQLAlchemy + Pydantic v2 |
| **Database** | PostgreSQL 16 (Docker) — 10 tables, Alembic migrations |
| **Cache / queues** | Redis 7 (Docker) |
| **Object storage** | Cloudflare R2 (S3-compatible via boto3) |
| **LLM** | Google Gemini 2.5 Flash for treatment advice |
| **Auth** | JWT + bcrypt password hashing |
| **Image processing** | Pillow + NumPy |

---

## 📁 Project structure

```
agrosense/
├── README.md
├── docker-compose.yml          # Postgres 16 + Redis 7
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app, lifespan loads ML model at startup
│   │   ├── config.py           # Pydantic settings, reads .env
│   │   ├── database.py         # Async SQLAlchemy engine + session factory
│   │   ├── models/             # 10 SQLAlchemy ORM tables
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── routers/            # auth, diagnose
│   │   └── services/
│   │       ├── ml_service.py        # TFLite singleton + predict()
│   │       ├── image_service.py     # Pillow preprocessing → [1,224,224,3]
│   │       ├── storage_service.py   # Cloudflare R2 uploads
│   │       ├── gemini_service.py    # Treatment advice from Gemini
│   │       ├── security.py          # JWT + bcrypt
│   │       └── auth_dependencies.py # FastAPI deps for protected routes
│   ├── ml/
│   │   ├── crop_disease_model.tflite   # 2.7 MB, 38 classes
│   │   └── class_names.json
│   ├── alembic/                # Database migrations (2 versions so far)
│   ├── scripts/
│   │   └── seed_crops_and_diseases.py
│   ├── requirements.txt
│   └── .env.example
└── notebooks/
    ├── training_curves_combined.png
    └── predictions_sample.png
```

---

## 🗺️ Progress

### ✅ Week 1 — ML model training

- Loaded PlantVillage dataset (54k images, 38 classes) on Kaggle
- Built two-phase MobileNetV2 transfer learning pipeline with data augmentation
- Phase 1 (frozen base, 10 epochs): 94.6% val accuracy
- Phase 2 (top 30 layers unfrozen, lr 1e-5, 10 epochs): **97.28% val accuracy**
- Smoke-tested on held-out validation images: 12/12 correct
- Exported to TFLite with default quantization (10 MB Keras → 2.7 MB TFLite)
- Saved `class_names.json` for index → label mapping

### ✅ Week 2 — Backend foundation

- Containerized PostgreSQL 16 + Redis 7 via Docker Compose
- Built all 10 SQLAlchemy models per the blueprint schema (farmers, crops, diseases, diagnoses, market_prices, weather_cache, farm_plots, sms_interactions, expert_reviews, admins)
- Configured Alembic for schema migrations (2 migrations applied)
- Implemented JWT auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- bcrypt password hashing with `passlib`
- Seeded reference data: 14 crops + 38 diseases mapped to ML class names

### ✅ Week 3 — AI diagnosis pipeline

- **Cloudflare R2** integration for crop photo storage (S3 API via boto3)
- **Image preprocessing service**: Pillow + NumPy → `[1, 224, 224, 3]` float32 tensor
- **TFLite inference service**: model loaded once via FastAPI lifespan, singleton interpreter, top-3 predictions per request
- **Gemini service**: structured-JSON treatment advice prompt tailored for Ghanaian smallholder farmers (Ghana-available products, organic-first, confidence-aware fallback to extension officer when uncertain)
- **`POST /api/diagnose`**: full pipeline orchestration — auth → R2 upload → preprocess → predict → DB lookup → Gemini → save Diagnosis row → response (~5–10 sec end-to-end)

### 🔜 Up next

- **Week 4** — Market prices, Open-Meteo weather, Twilio SMS gateway, admin endpoints
- **Weeks 5–7** — React Native mobile app (camera, diagnosis screens, history, prices, weather)
- **Week 8** — Deploy to Railway, real user testing, demo, portfolio post

---

## 🚀 Running locally

**Prerequisites:** Python 3.12, Docker Desktop, Git.

```bash
# 1. Clone and enter
git clone https://github.com/aimlin9/agrosense.git
cd agrosense

# 2. Start Postgres + Redis
docker compose up -d

# 3. Install backend deps
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows PowerShell
# source venv/bin/activate    # macOS / Linux
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env — fill in R2 + Gemini credentials, generate SECRET_KEY:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"

# 5. Run database migrations
alembic upgrade head

# 6. Seed reference data
python -m scripts.seed_crops_and_diseases

# 7. Start the API
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` for the interactive Swagger UI.

---

## 🌍 Why this matters

- 2.2M smallholder farmers in Ghana lose 20–40% of crops annually to preventable diseases
- 1 agricultural extension officer per ~1,500 farmers — expert advice is effectively unreachable
- No existing app does AI disease diagnosis for Ghanaian crop varieties
- 33M smallholders across West Africa face the same gap

AgroSense puts a 97% accurate, multilingual, Ghana-aware diagnostician in every farmer's pocket — and via SMS, on every feature phone too.

---

## 📜 License

MIT — see [LICENSE](LICENSE).

## 👤 Author

**Ramsey Opoku Gyimah** ([@aimlin9](https://github.com/aimlin9)) — Computer Science student, Accra, Ghana.
