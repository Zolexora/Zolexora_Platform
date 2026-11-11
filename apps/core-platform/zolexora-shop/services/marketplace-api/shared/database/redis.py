"""Provider-neutral Redis pool for caches, rate limits and trending reels.

Sessions belong to the Zolexora auth service; nothing here holds credentials."""

import hashlib
import json
import logging
from urllib.parse import urlsplit

from redis.asyncio import ConnectionPool, Redis
from redis.exceptions import RedisError

from core.config import settings

logger = logging.getLogger("zolexora.redis")
TTL_PRODUCT = 60 * 60
TTL_TRENDING = 15 * 60
TTL_RATE_LIMIT = 60

_pool: ConnectionPool | None = None
_client: Redis | None = None


def _key(*parts: str) -> str:
    return ":".join((settings.REDIS_NAMESPACE, *parts))


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def init_redis() -> None:
    global _pool, _client
    if _client is not None:
        return
    parsed = urlsplit(settings.REDIS_URL)
    if parsed.scheme not in {"redis", "rediss"} or not parsed.hostname:
        raise ValueError("REDIS_URL must be a Redis URL")
    _pool = ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=settings.REDIS_POOL_MAX,
        decode_responses=True,
        socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT,
        socket_timeout=settings.REDIS_CONNECT_TIMEOUT,
    )
    _client = Redis(connection_pool=_pool)
    logger.info("Redis pool initialized")


async def check_redis_connection() -> bool:
    try:
        return bool(_client and await _client.ping())
    except RedisError:
        return False


async def close_redis() -> None:
    global _pool, _client
    if _pool is not None:
        await _pool.aclose()
    _pool = None
    _client = None


def get_redis() -> Redis:
    if _client is None:
        raise RuntimeError("Redis is not initialized")
    return _client


def is_redis_ready() -> bool:
    return _client is not None


async def redis_dep() -> Redis:
    return get_redis()


async def cache_product(product_id: str, data: dict) -> None:
    await get_redis().set(_key("catalog", "product", product_id), json.dumps(data), ex=TTL_PRODUCT)


async def get_cached_product(product_id: str) -> dict | None:
    raw = await get_redis().get(_key("catalog", "product", product_id))
    return json.loads(raw) if raw else None


async def invalidate_product_cache(product_id: str) -> None:
    await get_redis().delete(_key("catalog", "product", product_id))


async def check_rate_limit(identity: str, limit: int = 60) -> bool:
    redis = get_redis()
    key = _key("rate", "limit", _digest(identity))
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, TTL_RATE_LIMIT)
    return count <= limit


async def add_reel_score(reel_id: str, score: float) -> None:
    redis = get_redis()
    key = _key("reels", "trending")
    await redis.zadd(key, {reel_id: score})
    await redis.expire(key, TTL_TRENDING)


async def get_trending_reels(limit: int = 20) -> list[str]:
    return await get_redis().zrevrange(_key("reels", "trending"), 0, limit - 1)


async def ping() -> bool:
    return await check_redis_connection()

