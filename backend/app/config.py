import logging
import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM (Groq)
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"  # structured extraction / generation
    groq_vision_model: str = "qwen/qwen3.8-27b"  # OCR of scanned CVs and screenshots

    # LLM (OpenRouter) — writes the tailored CV and the cover letter
    openrouter_api_key: str = ""
    openrouter_model: str = ""
    # Writing model reasoning budget: unbounded, a CV takes ~4 min; 2048 tokens ≈ 45-55 s and no runaway calls
    openrouter_reasoning_tokens: int = 2048
    # Same model as groq_model, used when Groq is rate-limited or down
    openrouter_fallback_model: str = "openai/gpt-oss-120b"
    # Reads job offer screenshots; the second model takes over when the first is unavailable
    openrouter_vision_models: list[str] = ["google/gemini-3.1-flash-lite", "openai/gpt-6-luna"]

    # App
    database_url: str = "sqlite:///./matchpilot.db"
    # URL the browser uses (Vite dev server proxies /api to the backend)
    public_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    max_upload_mb: int = 10

    # Sessions
    secret_key: str = ""
    session_days: int = 7
    cookie_secure: bool = False  # True in production (HTTPS)

    # OAuth providers (leave empty to disable a provider)
    google_client_id: str = ""
    google_client_secret: str = ""
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.secret_key:
        # Dev fallback: sessions are invalidated on every restart until SECRET_KEY is set
        log.warning("SECRET_KEY is not set: using a temporary key (sessions reset on restart).")
        settings.secret_key = secrets.token_urlsafe(48)
    return settings
