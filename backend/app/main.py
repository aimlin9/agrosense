from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.routers import auth as auth_router
from app.services.ml_service import load_model
from app.routers import diagnose as diagnose_router
from app.routers import prices as prices_router
from app.routers import plots as plots_router
from app.routers import weather as weather_router
from app.routers import admin as admin_router
from app.routers import sms as sms_router
from app.routers import crops as crops_router
# Add to imports near the top
from fastapi_limiter import FastAPILimiter
from redis.asyncio import Redis as AsyncRedis
from app.services.rate_limit import farmer_or_ip_identifier

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    print("[lifespan] Loading ML model...")
    load_model()
    print("[lifespan] Startup complete")
    # Initialize rate limiter (Redis-backed, shared across workers)
    redis_client = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    await FastAPILimiter.init(redis_client, identifier=farmer_or_ip_identifier)
    yield
    await FastAPILimiter.close()
    # ── Shutdown ──
    print("[lifespan] Shutting down")


app = FastAPI(
    title="AgroSense API",
    description="AI-powered crop disease advisory for smallholder farmers",
    version="0.1.0",
    lifespan=lifespan,
)


# ─── Routers ─────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(diagnose_router.router)
app.include_router(prices_router.router)
app.include_router(plots_router.router)
app.include_router(weather_router.router)
app.include_router(admin_router.router)
app.include_router(sms_router.router)
app.include_router(crops_router.router)

# ─── Health checks ───────────────────────────────────
@app.get("/")
def read_root():
    return {
        "service": "AgroSense API",
        "version": "0.1.0",
        "status": "operational",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
async def db_health_check(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT 1"))
    value = result.scalar()
    return {
        "status": "ok" if value == 1 else "error",
        "database": "postgresql",
    }


