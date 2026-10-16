from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def utcnow() -> datetime:
    """Timezone-aware 'now' for timestamptz columns."""
    return datetime.now(timezone.utc)


_engine_kwargs: dict = {"echo": False, "pool_pre_ping": True}
if settings.database_url.startswith("postgresql"):
    _engine_kwargs.update(pool_size=5, max_overflow=5, pool_recycle=1800)
    # Supabase's transaction pooler (port 6543) doesn't support prepared
    # statements; disabling the cache is harmless on a direct connection.
    _engine_kwargs["connect_args"] = {"statement_cache_size": 0}

# Engine = the actual connection pool to Postgres
engine = create_async_engine(settings.database_url, **_engine_kwargs)


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