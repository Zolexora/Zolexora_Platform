from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock


def fake_pg_pool(db_bytes: int = 0, tables: list | None = None):
    """asyncpg-like pool whose connection answers the telemetry queries."""
    tables = tables or []
    conn = MagicMock()
    conn.fetchval = AsyncMock(return_value=db_bytes)
    conn.fetch = AsyncMock(return_value=tables)
    conn.fetchrow = AsyncMock(return_value={
        "db_bytes": db_bytes,
        "table_bytes": sum(t["total_bytes"] for t in tables),
        "row_count": sum(t["row_count"] for t in tables),
    })
    pool = MagicMock()

    @asynccontextmanager
    async def acquire():
        yield conn

    pool.acquire = acquire
    return pool
