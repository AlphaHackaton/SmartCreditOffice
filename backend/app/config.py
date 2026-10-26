"""Runtime settings with a dependency-free import path."""

import os
from dataclasses import dataclass, field

DEFAULT_DATABASE_URL = "postgresql+psycopg://credit:credit@db:5432/credit"


@dataclass(frozen=True, slots=True)
class Settings:
    app_mode: str = "stub"
    database_url: str = field(default_factory=lambda: DEFAULT_DATABASE_URL)
    api_prefix: str = "/api/v1"
    jwt_secret: str = "dev-only-secret-change-me-please-32-bytes"
    key_rate_pct: str = "16.5"
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_mode=os.getenv("APP_MODE", "stub").lower(),
            database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
            jwt_secret=os.getenv("JWT_SECRET", "dev-only-secret-change-me-please-32-bytes"),
            key_rate_pct=os.getenv("KEY_RATE_PCT", "16.5"),
            llm_base_url=os.getenv("LLM_BASE_URL"),
            llm_api_key=os.getenv("LLM_API_KEY"),
            llm_model=os.getenv("LLM_MODEL"),
        )


settings = Settings.from_env()
