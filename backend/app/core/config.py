from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR.parent

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    admin_username: str = "admin"
    admin_password: str
    frontend_url: str = "http://localhost:5173"
    access_token_minutes: int = 60 * 24 * 7
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
