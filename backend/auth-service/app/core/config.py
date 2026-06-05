from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

env_path = Path(__file__).parent.parent.parent / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(env_path),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str
    supabase_key: str
    service_role: str | None = None
    encryption_key: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

settings = Settings()
