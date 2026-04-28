from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db


app = FastAPI(
    title="AgroSense API",
    description="AI-powered crop disease advisory for smallholder farmers",
    version="0.1.0",
)


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