from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:256337@localhost:5432/inkfold"
    secret_key: str = "inkfold-development-secret-change-in-production"
    admin_username: str = "admin"
    admin_password: str = "admin123"
    frontend_url: str = "http://localhost:5173"
    access_token_minutes: int = 60 * 24 * 7
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

settings = Settings()
