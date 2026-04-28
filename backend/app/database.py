from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


# Engine = the actual connection pool to Postgres
engine = create_async_engine(
    settings.database_url,
    echo=False,           # set True if you want SQL logged to console (noisy)
    pool_pre_ping=True,   # checks connections are still alive before using
)


# Factory that produces new sessions on demand
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Base class that all our model classes will inherit from
class Base(DeclarativeBase):
    pass


# Dependency for FastAPI to inject sessions into endpoints
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session