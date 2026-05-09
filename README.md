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

### ✅ Week 4 — Supporting features + SMS gateway

- **Market prices** — 30-day price history seeded for 10 crops × 5 Ghanaian markets (Kumasi, Techiman, Makola, Tamale, Kaneshie). Endpoints: `GET /api/prices` (filterable by crop/region/market), `GET /api/prices/trends/{crop_id}` (time-series with 30-day average).
- **Farm plots** — Owner-scoped CRUD: farmers register fields with crop, GPS, planting date, soil/irrigation type. `GET/POST/PATCH/DELETE /api/plots`.
- **Weather** — Open-Meteo integration with **6-hour Redis cache**. `GET /api/weather` returns current conditions + 7-day forecast. Cache key rounds GPS to 2 decimals so neighboring requests share results.
- **Planting advisory** — `GET /api/weather/advisory` feeds the forecast into Gemini for crop-specific, structured JSON advice (rainfall outlook, recommendations, warnings).
- **Admin dashboard** — Separate JWT issuer (`POST /api/auth/admin/login`) with `is_admin` claim. Endpoints: platform stats (totals, top diseases, healthy %), farmer list, farmer detail with recent diagnoses, all-diagnoses list, **expert review submission** for closing the AI feedback loop.
- **Twilio SMS gateway** — Inbound webhook (`POST /api/sms/webhook`) auto-creates SMS-only farmer records, classifies intent via Gemini (`diagnosis | price_check | weather | help | other`), dispatches to the right handler, and returns a TwiML reply formatted under 320 chars. Same backend services power the SMS path as the app path — no degraded experience.

### ✅ Week 5 — Mobile app (React Native + Expo)

The most rewarding chapter. Built the entire user-facing app that brings the backend to farmers' phones.

**Foundation:**
- Expo Router file-based navigation, TypeScript throughout
- JWT auth via SecureStore (login + register screens), Zustand store, auto-redirect on token expiry
- Axios client with auth interceptors, React Query for server-state caching
- Bottom tab navigation: Home, Diagnose, Prices, Weather, History

**Diagnosis flow (camera → backend → result):**
- Camera + gallery picker via `expo-camera` and `expo-image-picker`
- Crop selector chips fetched from `/api/crops`
- Multipart upload to `/api/diagnose` with 60s timeout for full Gemini pipeline
- Result screen renders predicted disease, confidence pill, severity badge (color-coded), Gemini summary, numbered immediate actions, organic + chemical treatment with Ghana-specific products (Kocide, Ridomil Gold, Dithane), prevention tips, top-3 alternative predictions
- End-to-end latency: photo → diagnosis displayed in ~10 seconds on device

**History:**
- `GET /api/diagnoses` lists farmer's past diagnoses with crop, disease, confidence, image thumbnail
- Pull-to-refresh + auto-refresh on tab focus
- Tap any card → `app/diagnosis/[id].tsx` dynamic route → full detail screen
- Backend enriches old plain-text advice with severity heuristic (high/moderate/low) so legacy rows render cleanly

**Prices:**
- Filter by crop chip, see live prices across 5 Ghanaian markets (Kumasi, Techiman, Makola, Tamale, Kaneshie)
- Trend arrows (📈 / 📉 / ➡️) with directional color coding
- GHS pricing displayed per kg

**Weather:**
- `expo-location` GPS with reverse geocoding ("📍 Kumasi, Ashanti Region")
- Real-time current conditions (temp, humidity, rain, wind)
- 7-day horizontal forecast cards with rain volume per day
- Gemini-generated planting advisory tailored to maize + Ghana, with structured recommendations and warnings ("Sow Monday May 4th to take advantage of upcoming rains")
- Falls back to Accra coordinates when permission is denied

### ✅ Week 6 — UI polish & onboarding

Shipped the visual transformation that takes AgroSense from "a developer made this" to "a designer made this."

**Typography & design system:**
- Inter font family (Regular, Medium, SemiBold, Bold, ExtraBold) loaded via `@expo-google-fonts/inter`
- Centralized theme tokens in `mobile/constants/theme.ts` — colors, fonts, spacing, radius, shadows
- Splash screen held until fonts + auth state both ready, no font flash

**Home screen redesign:**
- Stats row: today's diagnoses, all-time count, current temperature
- Hero CTA card with shadow + rounded corners
- Most-recent-diagnosis card (only renders if history exists) with crop, disease, confidence, date — taps through to detail
- Quick-access shortcuts grid (Prices, Weather, History)
- Tip card with photography advice

**3-dot anchored dropdown menu (Material 3 pattern):**
- `MenuSheet.tsx` component using `Modal` + absolute positioning + `measureInWindow` to anchor to trigger
- Two items: Feedback (opens `mailto:` with pre-filled subject + platform info), Settings (navigates to settings stack)
- Tap-outside dismissal, no scrim

**Settings screen:**
- Separate stack route at `app/settings/` with proper back chevron
- Profile card (avatar, name, phone, region with 📍 emoji)
- Support section (email link), About section (version via `expo-application`, privacy & terms placeholder)
- GitHub link gated by `__DEV__` flag — visible in dev/portfolio builds, hidden in production
- Logout with confirmation alert
- "Made with 🌱 in Ghana" footer

**Onboarding flow (first-launch only, persisted via SecureStore):**
- 3-slide horizontal carousel: Diagnose → Plant → Sell
- Full-bleed Unsplash photography (dewy leaf macro, cornfield, harvested tomatoes)
- Branded green LinearGradient overlay (transparent at top → 92% green at bottom) keeps text readable on any photo
- AgroSense brand top-left + Skip top-right floating over the photo with text shadows
- 32px Inter ExtraBold titles, 15px body copy, animated dot indicator, white CTA button on dark green strip
- "Get started" on slide 3 → register; "Sign in" link → login; "Skip" → login at any time
- `markOnboardingSeen()` action persists `onboarding_seen` flag so returning users skip straight to login

**Photo attribution:**
- `ATTRIBUTIONS.md` at repo root crediting Unsplash photographers, PlantVillage dataset (Hughes & Salathé 2015), MobileNetV2, Inter font, Open-Meteo, and other open source dependencies

### ✅ Week 7a — Google Sign-In (native Android)

Brought social authentication to AgroSense for a smoother portfolio + recruiter experience while keeping phone-number auth as the primary path for SMS-only farmers.

**Backend:**
- Schema migration: `phone_number` and `password_hash` made nullable; added `auth_provider`, `google_sub`, `profile_picture_url`, `profile_complete` columns with backfill of existing phone-auth rows
- `POST /api/auth/google` — verifies Google ID token signature against accepted client IDs (web/Android/iOS), with 600-sec clock-skew tolerance
- Account linking: existing phone-auth farmers with a matching email get auto-linked to Google (provider becomes `phone+google`)
- New users created with `profile_complete=False` to gate access until phone collected
- `PATCH /api/auth/me/complete-profile` — accepts phone + region + primary_crop, marks profile complete

**Mobile:**
- `@react-native-google-signin/google-signin` integration via Expo dev build
- Reusable `GoogleSignInButton` component with real four-color Google "G" SVG logo
- "Continue with Google" button on login + register screens, "Sign up with Google" variant on register
- `Complete Profile` screen at `app/onboarding/complete-profile.tsx` — collects phone (required for SMS), region, primary crop
- Auth store action `loginWithGoogle()` returns `{ profileComplete }` so caller can route accordingly
- Routing logic in `_layout.tsx` enforces complete-profile gate for any farmer where `profile_complete=false`

**Infrastructure:**
- Google Cloud OAuth project `AgroSense` with three client IDs (web, Android, iOS)
- EAS development build profile configured (`buildType: apk`)
- Android keystore generated by EAS, SHA-1 fingerprint registered with Google Cloud Console
- Production keystore SHA-1 will be added during Week 7c

### 🚧 Week 7b — Production polish, privacy, deploy

**App identity (✅ done):**
- Selected production app icon: dark-green scan-focused design — single white leaf with corner camera focus brackets and a scanning radar overlay. Communicates "AI plant diagnosis" specifically, not generic "plant app."
- Brand color locked: **`#0F5427`** (forest green). Used for adaptive icon background, splash screen background (light + dark mode), and consistently across the app theme.
- `scripts/generate_app_icons.py` — Pillow-based asset generator. Produces `icon.png` (1024² full), `android-icon-foreground.png` (1024² with logo at 70% scale for Android safe-zone compliance), `splash-icon.png` (1024² with logo at 45%), and `favicon.png` (48²) from one source PNG. Reproducible if the logo ever changes.
- Wired into `mobile/app.json`: top-level `icon`, `android.adaptiveIcon` (foreground + brand `backgroundColor`), `expo-splash-screen` plugin (matched `backgroundColor` for both light + dark mode). Removed unused `backgroundImage` and `monochromeImage` adaptive-icon layers from the Expo template.

**Backend hardening (✅ done):**
- Rate limiting via `fastapi-limiter` (Redis-backed, works across multiple workers). 10/min per farmer on `/api/diagnose` (the expensive ML+Gemini path), 5/min per IP on `/api/auth/login` + `/api/auth/register`, 10/min per IP on `/api/auth/google`. Returns `429 Too Many Requests` with a `Retry-After` header.

**Remaining (🔜):**
- Privacy policy + terms of service generated via Termly
- Backend deploy to Railway (FastAPI + PostgreSQL + Redis)
- Update mobile API base URL to deployed Railway endpoint

### 🔜 Week 7c — Production APK

- `eas build --profile production` for `.aab` (Play Store) + `.apk` (sideload distribution)
- Add production keystore SHA-1 to Google Cloud Console Android client
- Distribute APK to 5 real farmers in Ejura, document feedback
### 🔜 Week 8 — Demo & portfolio

- 90-second demo video, portfolio post, pitch deck, LinkedIn launch
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
## 🚧 Known TODOs

- **iOS Google Sign-In** — `mobile/app.json`'s `iosUrlScheme` is a placeholder (`com.googleusercontent.apps._REPLACE_WITH_REVERSED_IOS_CLIENT_ID_`). When building for iOS, replace it with the reversed iOS OAuth client ID from Google Cloud Console (the segments are reversed dot-by-dot, e.g. `com.googleusercontent.apps.123-abc` becomes `com.googleusercontent.apps.123-abc` — same thing, just confusingly named). Android builds are unaffected.

## 📜 License

MIT — see [LICENSE](LICENSE).

## 👤 Author

**Ramsey Opoku Gyimah** ([@aimlin9](https://github.com/aimlin9)) — Computer Science student, Accra, Ghana.
