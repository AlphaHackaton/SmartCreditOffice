"""Runtime settings with a dependency-free import path."""

import os
from dataclasses import dataclass, field

DEFAULT_DATABASE_URL = "postgresql+psycopg://credit:credit@db:5432/credit"


@dataclass(frozen=True, slots=True)
class Settings:
    app_mode: str = "stub"
    database_url: str = field(default_factory=lambda: DEFAULT_DATABASE_URL)
    api_prefix: str = "/api/v1"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_mode=os.getenv("APP_MODE", "stub").lower(),
            database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        )


settings = Settings.from_env()
