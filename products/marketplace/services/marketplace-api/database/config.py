import os
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True, repr=False)
class DatabaseConfig:
    url: str
    pool_min: int = 1
    pool_max: int = 10
    command_timeout: int = 30

    def __post_init__(self) -> None:
        parsed = urlsplit(self.url)
        if parsed.scheme not in {"postgres", "postgresql", "postgresql+asyncpg"} or not parsed.hostname:
            raise ValueError("DATABASE_URL must be a PostgreSQL URL")
        if self.pool_min < 1 or self.pool_min > self.pool_max:
            raise ValueError("Database pool sizes are invalid")
        if self.command_timeout < 1:
            raise ValueError("Database command timeout is invalid")

    def __repr__(self) -> str:
        return "DatabaseConfig(url=<redacted>)"

    @classmethod
    def from_env(cls) -> "DatabaseConfig":
        raw_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL") or "postgresql://marketplace_local:marketplace-local-only@postgres:5432/marketplace_local"
        return cls(
            raw_url,
            int(os.getenv("DATABASE_POOL_MIN", "1")),
            int(os.getenv("DATABASE_POOL_MAX", "10")),
            int(os.getenv("DATABASE_COMMAND_TIMEOUT", "30")),
        )

    @property
    def asyncpg_url(self) -> str:
        return self.url.replace("postgresql+asyncpg://", "postgresql://", 1).replace("postgres://", "postgresql://", 1)
