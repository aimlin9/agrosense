from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://agrosense:agrosense_dev_password@localhost:5432/agrosense"

    # Auth (we'll use these next)
    secret_key: str = "change-this-to-a-real-secret-min-32-chars-long"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days


# Single instance imported everywhere else
settings = Settings()