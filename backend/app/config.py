from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ─── Database ──────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://agrosense:agrosense_dev_password@localhost:5432/agrosense"

    # ─── Redis ─────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ─── Auth ──────────────────────────────────────────────
    secret_key: str = "change-this-to-a-real-secret-min-32-chars-long"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080

    # ─── Cloudflare R2 ─────────────────────────────────────
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "agrosense-photos"
    r2_endpoint_url: str = ""
    r2_public_url: str = ""

    # ─── Google Gemini ─────────────────────────────────────
    gemini_api_key: str = ""


settings = Settings()