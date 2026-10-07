"""Canonical provider-neutral PostgreSQL pool and transaction boundary."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg

from database.config import DatabaseConfig

logger = logging.getLogger("zolexora.postgres")
_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    try:
        config = DatabaseConfig.from_env()
    except ValueError:
        logger.warning("DATABASE_URL is absent or invalid; PostgreSQL pool disabled")
        return
    _pool = await asyncpg.create_pool(
        dsn=config.asyncpg_url,
        min_size=config.pool_min,
        max_size=config.pool_max,
        command_timeout=config.command_timeout,
        statement_cache_size=0,
        server_settings={"application_name": "zolexora-marketplace-api", "timezone": "UTC"},
    )
    logger.info("PostgreSQL pool ready")


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("PostgreSQL pool is not initialized")
    return _pool


def is_pool_ready() -> bool:
    return _pool is not None


@asynccontextmanager
async def connection() -> AsyncIterator[asyncpg.Connection]:
    async with get_pool().acquire() as value:
        yield value


@asynccontextmanager
async def transaction() -> AsyncIterator[asyncpg.Connection]:
    async with connection() as value:
        async with value.transaction():
            yield value


async def pg_conn_dep() -> AsyncIterator[asyncpg.Connection]:
    async with connection() as value:
        yield value
