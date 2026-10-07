"""
shared/sms/otp.py
─────────────────
Redis-backed Phone OTP challenge creation and atomic verification.
"""

import hashlib
import hmac
import logging
import re
import secrets
import uuid
from typing import Tuple

from core.config import settings
from shared.database.redis import get_redis
from shared.sms.service import get_sms_service

logger = logging.getLogger("zolexora.sms.otp")

PHONE_OTP_TTL_SECONDS = 300  # 5 minutes
PHONE_OTP_COOLDOWN_SECONDS = 60  # 1 minute resend cooldown
PHONE_OTP_MAX_ATTEMPTS = 5


def _phone_key(*parts: str) -> str:
    return ":".join((settings.REDIS_NAMESPACE, "phone_otp", *parts))


def _phone_digest(value: str) -> str:
    # The UI may send either `+91XXXXXXXXXX` or the normalized 10-digit
    # number. They must resolve to the same Redis challenge key.
    normalized = re.sub(r"\D", "", value)[-10:]
    return hashlib.sha256(normalized.encode()).hexdigest()


def _otp_digest(challenge_id: str, otp: str) -> str:
    pepper = settings.AUTH_OTP_PEPPER.get_secret_value() if settings.AUTH_OTP_PEPPER else "dev-pepper-secret-fallback"
    return hmac.new(pepper.encode(), f"{challenge_id}:{otp}".encode(), hashlib.sha256).hexdigest()


async def create_phone_otp_challenge(phone: str, purpose: str, user_id: str) -> Tuple[bool, str]:
    """
    Generate and dispatch a 6-digit Phone OTP with Redis-backed cooldown and rate limiting.
    """
    redis = get_redis()
    phone_hash = _phone_digest(phone)
    challenge_key = _phone_key(purpose, user_id, phone_hash)
    cooldown_key = _phone_key("cooldown", purpose, user_id, phone_hash)

    # 1. Enforce cooldown
    if await redis.exists(cooldown_key):
        ttl = await redis.ttl(cooldown_key)
        return False, f"Please wait {max(1, ttl)}s before requesting a new OTP"

    # 2. Rate-limiting (max 5 per hour)
    rate_key = _phone_key("rate", purpose, user_id)
    count = await redis.incr(rate_key)
    if count == 1:
        await redis.expire(rate_key, 3600)
    if count > 5:
        return False, "Hourly OTP request limit exceeded. Please try again later."

    # 3. Generate OTP
    otp = f"{secrets.randbelow(1_000_000):06d}"
    challenge_id = str(uuid.uuid4())

    # 4. Save challenge to Redis
    async with redis.pipeline(transaction=True) as pipeline:
        pipeline.hset(
            challenge_key,
            mapping={
                "challenge_id": challenge_id,
                "otp_digest": _otp_digest(challenge_id, otp),
                "phone": phone,
                "attempts": "0",
            },
        )
        pipeline.expire(challenge_key, PHONE_OTP_TTL_SECONDS)
        pipeline.set(cooldown_key, "1", ex=PHONE_OTP_COOLDOWN_SECONDS)
        await pipeline.execute()

    # 5. Dispatch via SMS Service (supports multi-account quota failover)
    sms_service = get_sms_service()
    res = await sms_service.send_otp(phone=phone, otp=otp)
    if not res.success:
        logger.error("Failed to deliver SMS OTP to %s: %s", phone, res.error)
        return False, res.error or "Failed to send SMS OTP"

    return True, "OTP sent successfully"


_CONSUME_PHONE_OTP_LUA = """
local key = KEYS[1]
if redis.call('EXISTS', key) == 0 then return {0} end
local expected = redis.call('HGET', key, 'otp_digest')
if expected ~= ARGV[1] then
  local attempts = redis.call('HINCRBY', key, 'attempts', 1)
  if attempts >= tonumber(ARGV[2]) then redis.call('DEL', key) end
  return {-1, attempts}
end
redis.call('DEL', key)
return {1}
"""


async def verify_phone_otp_challenge(phone: str, otp: str, purpose: str, user_id: str) -> Tuple[bool, str]:
    """
    Verify and consume the one-time password atomically from Redis.
    """
    redis = get_redis()
    phone_hash = _phone_digest(phone)
    challenge_key = _phone_key(purpose, user_id, phone_hash)

    challenge_id = await redis.hget(challenge_key, "challenge_id")
    if not challenge_id:
        return False, "OTP expired or not requested"

    digest = _otp_digest(challenge_id, otp.strip())
    result = await redis.eval(_CONSUME_PHONE_OTP_LUA, 1, challenge_key, digest, PHONE_OTP_MAX_ATTEMPTS)

    if result[0] == 0:
        # Check if already verified recently
        verified_key = _phone_key("verified", purpose, user_id, phone_hash)
        if await redis.exists(verified_key):
            return True, "Phone number already verified"
        return False, "OTP expired or already used"
    if result[0] == -1:
        attempts = result[1] if len(result) > 1 else "?"
        return False, f"Invalid OTP (attempt {attempts}/{PHONE_OTP_MAX_ATTEMPTS})"

    verified_key = _phone_key("verified", purpose, user_id, phone_hash)
    await redis.set(verified_key, "1", ex=900)  # 15 minutes validity
    return True, "Phone number verified successfully"


async def is_phone_verified(phone: str, purpose: str, user_id: str) -> bool:
    """Check if a phone number was recently verified in Redis."""
    redis = get_redis()
    phone_hash = _phone_digest(phone)
    verified_key = _phone_key("verified", purpose, user_id, phone_hash)
    return bool(await redis.exists(verified_key))
