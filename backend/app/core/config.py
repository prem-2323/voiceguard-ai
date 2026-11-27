from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "VoiceGuard AI API"
    environment: str = "development"
    database_url: str = "sqlite:///./data/voiceguard.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    log_level: str = "INFO"
    jwt_secret: str = "local-demo-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, ge=1, le=1440)
    whisper_model_path: str = ""
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_max_audio_mb: int = 20

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        if self.jwt_algorithm != "HS256":
            raise ValueError("JWT_ALGORITHM must be HS256")
        if "*" in self.allowed_origins:
            raise ValueError("CORS_ORIGINS cannot contain * when credentialed requests are enabled")
        if self.environment.casefold() not in {"development", "dev", "test", "testing"}:
            secret = self.jwt_secret.casefold()
            if len(self.jwt_secret.encode("utf-8")) < 32 or any(
                marker in secret for marker in ("local-demo-secret", "change-me", "replace-with")
            ):
                raise ValueError("Set JWT_SECRET to a private random value of at least 32 bytes outside development")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
