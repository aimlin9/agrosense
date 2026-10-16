import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("agrosense")

_DEFAULT_SECRET = "change-this-to-a-real-secret-min-32-chars-long"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ─── Runtime ───────────────────────────────────────────
    environment: str = "development"  # development | production
    # Comma-separated list of origins allowed to call the API from a browser
    # (the marketing site, an admin dashboard). Native apps don't need CORS.
    cors_origins: str = "https://aimlin9.github.io,http://localhost:8081,http://localhost:3000"

    # ─── Database ──────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://agrosense:agrosense_dev_password@localhost:5432/agrosense"

    # ─── Redis ─────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ─── Auth ──────────────────────────────────────────────
    secret_key: str = _DEFAULT_SECRET
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080

    # Keep indicative market prices current (startup + every 12 hours).
    # Turn off once a live price feed writes real prices.
    auto_indicative_prices: bool = True

    # ─── Uploads ───────────────────────────────────────────
    max_upload_mb: int = 10

    # ─── Cloudflare R2 ─────────────────────────────────────
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "agrosense-photos"
    r2_endpoint_url: str = ""
    r2_public_url: str = ""

    # ─── Google Gemini ─────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: int = 30

    # ─── Twilio ────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    # Reject webhook calls without a valid X-Twilio-Signature. Only enforced
    # when twilio_auth_token is set, so local testing with curl still works.
    twilio_validate_signature: bool = True

    # ─── Google Sign-In ────────────────────────────────────
    google_web_client_id: str = ""
    google_android_client_id: str = ""
    google_ios_client_id: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def r2_configured(self) -> bool:
        return bool(self.r2_endpoint_url and self.r2_access_key_id and self.r2_secret_access_key)


settings = Settings()

if settings.secret_key == _DEFAULT_SECRET:
    if settings.is_production:
        raise RuntimeError("SECRET_KEY must be set in production.")
    logger.warning("SECRET_KEY is the insecure default — fine for local dev only.")
