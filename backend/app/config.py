"""Runtime settings with a dependency-free import path."""

import os
from dataclasses import dataclass, field
from decimal import Decimal
from typing import TYPE_CHECKING

DEFAULT_DATABASE_URL = "postgresql+psycopg://credit:credit@db:5432/credit"
DEFAULT_KEY_RATE_PCT = "16.5"


@dataclass(frozen=True, slots=True)
class Settings:
    app_mode: str = "stub"
    database_url: str = field(default_factory=lambda: DEFAULT_DATABASE_URL)
    api_prefix: str = "/api/v1"
    jwt_secret: str = "dev-only-secret-change-me-please-32-bytes"
    key_rate_pct: str = DEFAULT_KEY_RATE_PCT
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_mode=os.getenv("APP_MODE", "stub").lower(),
            database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
            jwt_secret=os.getenv("JWT_SECRET", "dev-only-secret-change-me-please-32-bytes"),
            key_rate_pct=os.getenv("KEY_RATE_PCT", DEFAULT_KEY_RATE_PCT),
            llm_base_url=os.getenv("LLM_BASE_URL"),
            llm_api_key=os.getenv("LLM_API_KEY"),
            llm_model=os.getenv("LLM_MODEL"),
        )

    def policy(self) -> "Policy":
        """Credit policy v1 with the configured key rate (env `KEY_RATE_PCT`)."""
        from app.domain.scoring.policy import POLICY_V1

        return POLICY_V1.with_key_rate(Decimal(self.key_rate_pct))


settings = Settings.from_env()

if TYPE_CHECKING:  # pragma: no cover
    from app.domain.scoring.policy import Policy
