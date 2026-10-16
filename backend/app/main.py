import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import engine, get_db
from app.routers import admin as admin_router
from app.routers import auth as auth_router
from app.routers import crops as crops_router
from app.routers import diagnose as diagnose_router
from app.routers import plots as plots_router
from app.routers import prices as prices_router
from app.routers import sms as sms_router
from app.routers import weather as weather_router
from app.services import redis_client
from app.services.ml_service import is_loaded, load_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("agrosense")

API_VERSION = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading ML model…")
    load_model()
    if not await redis_client.ping():
        logger.warning("Redis unreachable at startup — caching and rate limits will degrade gracefully.")
    logger.info("Startup complete")
    yield
    await redis_client.close()
    await engine.dispose()
    logger.info("Shut down")


app = FastAPI(
    title="AgroSense API",
    description="AI-powered crop disease advisory for smallholder farmers",
    version=API_VERSION,
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    started = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    if request.url.path not in ("/health", "/"):
        logger.info("%s %s %s %.0fms id=%s", request.method, request.url.path, response.status_code, elapsed, request_id)
    return response


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side. Please try again."},
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
    return {"service": "AgroSense API", "version": API_VERSION, "status": "operational"}


@app.api_route("/health", methods=["GET", "HEAD"])
async def health(db: AsyncSession = Depends(get_db)):
    """Liveness check that also touches the database, keeping the free-tier
    Supabase project warm. Answers HEAD so UptimeRobot's default ping works."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/health/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    checks = {"model": is_loaded(), "redis": await redis_client.ping()}
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        checks["database"] = False
    ok = checks["model"] and checks["database"]
    return JSONResponse(status_code=200 if ok else 503, content={"status": "ok" if ok else "degraded", **checks})


@app.get("/health/db")
async def db_health_check(db: AsyncSession = Depends(get_db)):
    value = (await db.execute(text("SELECT 1"))).scalar()
    return {"status": "ok" if value == 1 else "error", "database": "postgresql"}
