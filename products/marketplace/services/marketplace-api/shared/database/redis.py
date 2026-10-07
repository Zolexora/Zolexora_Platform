"""Provider-neutral Redis pool, opaque sessions, and verification challenges."""

import hashlib
import hmac
import json
import logging
import secrets
import time
import uuid
from urllib.parse import urlsplit

from redis.asyncio import ConnectionPool, Redis
from redis.exceptions import RedisError

from core.config import settings

logger = logging.getLogger("zolexora.redis")
TTL_PRODUCT = 60 * 60
TTL_TRENDING = 15 * 60
TTL_RATE_LIMIT = 60
OTP_ATTEMPT_LIMIT = 5

_pool: ConnectionPool | None = None
_client: Redis | None = None


def _key(*parts: str) -> str:
    return ":".join((settings.REDIS_NAMESPACE, *parts))


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _otp_digest(challenge_id: str, otp: str) -> str:
    if settings.AUTH_OTP_PEPPER is None:
        raise RuntimeError("OTP verification is not configured")
    return hmac.new(settings.AUTH_OTP_PEPPER.get_secret_value().encode(), f"{challenge_id}:{otp}".encode(), hashlib.sha256).hexdigest()


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


_SESSION_MEMORY_CACHE: dict[str, tuple[float, dict]] = {}


def _invalidate_session_memory_cache(digest: str | None = None) -> None:
    if digest:
        _SESSION_MEMORY_CACHE.pop(digest, None)
    else:
        _SESSION_MEMORY_CACHE.clear()


async def create_session(user_id: str, auth_version: int, *, label: str | None = None) -> tuple[str, str, dict]:
    token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    session_id = str(uuid.uuid4())
    now = int(time.time())
    record = {
        "user_id": user_id,
        "session_id": session_id,
        "auth_version": auth_version,
        "issued_at": now,
        "expires_at": now + settings.SESSION_TTL_SECONDS,
        "csrf_digest": _digest(csrf_token),
    }
    if label:
        record["label"] = label[:80]
    digest = _digest(token)
    session_key = _key("auth", "session", digest)
    user_key = _key("auth", "user-sessions", user_id)
    redis = get_redis()
    async with redis.pipeline(transaction=True) as pipeline:
        pipeline.set(session_key, json.dumps(record, separators=(",", ":")), ex=settings.SESSION_TTL_SECONDS)
        pipeline.sadd(user_key, digest)
        pipeline.expire(user_key, settings.SESSION_TTL_SECONDS)
        await pipeline.execute()
    _SESSION_MEMORY_CACHE[digest] = (now, dict(record))
    return token, csrf_token, record


async def get_session(token: str) -> dict | None:
    if not token or len(token) > 256:
        return None
    digest = _digest(token)
    now = time.time()
    if digest in _SESSION_MEMORY_CACHE:
        ts, cached = _SESSION_MEMORY_CACHE[digest]
        if now - ts < 15 and cached.get("expires_at", 0) > now:
            return dict(cached)

    raw = await get_redis().get(_key("auth", "session", digest))
    if not raw:
        return None
    record = json.loads(raw)
    _SESSION_MEMORY_CACHE[digest] = (now, dict(record))
    return record


async def revoke_session(token: str) -> None:
    if not token:
        return
    digest = _digest(token)
    _invalidate_session_memory_cache(digest)
    redis = get_redis()
    session_key = _key("auth", "session", digest)
    raw = await redis.get(session_key)
    async with redis.pipeline(transaction=True) as pipeline:
        pipeline.delete(session_key)
        if raw:
            pipeline.srem(_key("auth", "user-sessions", json.loads(raw)["user_id"]), digest)
        await pipeline.execute()


async def revoke_all_user_sessions(user_id: str) -> int:
    _invalidate_session_memory_cache()
    redis = get_redis()
    user_key = _key("auth", "user-sessions", user_id)
    digests = await redis.smembers(user_key)
    keys = [_key("auth", "session", digest) for digest in digests]
    if keys:
        await redis.delete(*keys)
    await redis.delete(user_key)
    return len(keys)


async def validate_csrf(token: str, csrf_token: str) -> bool:
    session = await get_session(token)
    return bool(session and hmac.compare_digest(session["csrf_digest"], _digest(csrf_token)))


async def begin_registration(email: str, payload: dict, otp: str) -> bool:
    redis = get_redis()
    email_key = _digest(email)
    if await redis.exists(_key("auth", "resend-cooldown", email_key)):
        return False
    rate_key = _key("auth", "registration-rate", email_key)
    count = await redis.incr(rate_key)
    if count == 1:
        await redis.expire(rate_key, settings.REGISTRATION_RATE_WINDOW_SECONDS)
    if count > settings.REGISTRATION_RATE_LIMIT:
        return False
    challenge_id = str(uuid.uuid4())
    pending_key = _key("auth", "pending", email_key)
    mapping = {
        **payload,
        "email": email,
        "challenge_id": challenge_id,
        "otp_digest": _otp_digest(challenge_id, otp),
        "attempts": "0",
    }
    async with redis.pipeline(transaction=True) as pipeline:
        pipeline.hset(pending_key, mapping={key: str(value) for key, value in mapping.items()})
        pipeline.expire(pending_key, settings.OTP_TTL_SECONDS)
        pipeline.set(_key("auth", "resend-cooldown", email_key), "1", ex=settings.OTP_RESEND_COOLDOWN_SECONDS)
        await pipeline.execute()
    return True


async def resend_registration(email: str, otp: str) -> bool:
    redis = get_redis()
    email_key = _digest(email)
    pending_key = _key("auth", "pending", email_key)
    cooldown = _key("auth", "resend-cooldown", email_key)
    if await redis.exists(cooldown) or not await redis.exists(pending_key):
        return False
    rate_key = _key("auth", "registration-rate", email_key)
    count = await redis.incr(rate_key)
    if count == 1:
        await redis.expire(rate_key, settings.REGISTRATION_RATE_WINDOW_SECONDS)
    if count > settings.REGISTRATION_RATE_LIMIT:
        return False
    challenge_id = str(uuid.uuid4())
    async with redis.pipeline(transaction=True) as pipeline:
        pipeline.hset(pending_key, mapping={"challenge_id": challenge_id, "otp_digest": _otp_digest(challenge_id, otp), "attempts": "0"})
        pipeline.expire(pending_key, settings.OTP_TTL_SECONDS)
        pipeline.set(cooldown, "1", ex=settings.OTP_RESEND_COOLDOWN_SECONDS)
        await pipeline.execute()
    return True


_CONSUME_PENDING = """
local key = KEYS[1]
if redis.call('EXISTS', key) == 0 then return {0} end
local expected = redis.call('HGET', key, 'otp_digest')
if expected ~= ARGV[1] then
  local attempts = redis.call('HINCRBY', key, 'attempts', 1)
  if attempts >= tonumber(ARGV[2]) then redis.call('DEL', key) end
  return {-1, attempts}
end
local data = redis.call('HGETALL', key)
redis.call('DEL', key)
return {1, unpack(data)}
"""


async def consume_registration(email: str, otp: str) -> tuple[str, dict | None]:
    key = _key("auth", "pending", _digest(email))
    redis = get_redis()
    challenge_id = await redis.hget(key, "challenge_id")
    if not challenge_id:
        return "expired", None
    result = await redis.eval(_CONSUME_PENDING, 1, key, _otp_digest(challenge_id, otp), OTP_ATTEMPT_LIMIT)
    if result[0] == 0:
        return "expired", None
    if result[0] == -1:
        return "invalid", None
    values = result[1:]
    return "verified", dict(zip(values[::2], values[1::2], strict=True))


async def pending_registration_ttl(email: str) -> int:
    return await get_redis().ttl(_key("auth", "pending", _digest(email)))


async def create_password_reset(user_id: str) -> str:
    token = secrets.token_urlsafe(48)
    await get_redis().set(
        _key("auth", "password-reset", _digest(token)), user_id, ex=settings.OTP_TTL_SECONDS,
    )
    return token


async def consume_password_reset(token: str) -> str | None:
    if not token or len(token) > 256:
        return None
    return await get_redis().getdel(_key("auth", "password-reset", _digest(token)))


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


def session_token_digest(token: str) -> str:
    """Test/audit helper; never returns token material."""
    return _digest(token)
