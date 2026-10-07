"""
shared/verification/email_otp.py
────────────────────────────────
Redis-backed email OTP challenge creation, rate limiting, and verification.
"""

import hashlib
import hmac
import logging
import secrets
import uuid
from typing import Tuple

from core.config import settings
from core.email import send_otp_email
from shared.database.redis import get_redis

logger = logging.getLogger("zolexora.verification.email")

EMAIL_OTP_TTL_SECONDS = 300  # 5 minutes
EMAIL_OTP_COOLDOWN_SECONDS = 60  # 1 minute resend cooldown
EMAIL_OTP_MAX_ATTEMPTS = 5


def _email_key(*parts: str) -> str:
    return ":".join((settings.REDIS_NAMESPACE, "email_otp", *parts))


def _email_digest(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def _otp_digest(challenge_id: str, otp: str) -> str:
    pepper = settings.AUTH_OTP_PEPPER.get_secret_value() if settings.AUTH_OTP_PEPPER else "dev-pepper-secret-fallback"
    return hmac.new(pepper.encode(), f"{challenge_id}:{otp}".encode(), hashlib.sha256).hexdigest()


async def create_email_otp_challenge(email: str, purpose: str, user_id: str, name: str = "Customer") -> Tuple[bool, str]:
    """
    Generate and dispatch a 6-digit Email OTP with Redis-backed cooldown and rate limiting.
    """
    redis = get_redis()
    email_clean = email.strip().lower()
    email_hash = _email_digest(email_clean)
    challenge_key = _email_key(purpose, user_id, email_hash)
    cooldown_key = _email_key("cooldown", purpose, user_id, email_hash)

    # 1. Enforce cooldown
    if await redis.exists(cooldown_key):
        ttl = await redis.ttl(cooldown_key)
        return False, f"Please wait {max(1, ttl)}s before requesting a new email OTP"

    # 2. Rate-limiting (max 5 per hour)
    # Rate-limit each destination independently. Using only the anonymous
    # registration user id would make one test address block every email.
    rate_key = _email_key("rate", purpose, user_id, email_hash)
    count = await redis.incr(rate_key)
    if count == 1:
        await redis.expire(rate_key, 3600)
    if count > 5:
        return False, "Hourly email OTP limit exceeded. Please try again later."

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
                "email": email_clean,
                "attempts": "0",
            },
        )
        pipeline.expire(challenge_key, EMAIL_OTP_TTL_SECONDS)
        pipeline.set(cooldown_key, "1", ex=EMAIL_OTP_COOLDOWN_SECONDS)
        await pipeline.execute()

    # 5. Dispatch via email service
    try:
        await send_otp_email(email=email_clean, name=name, otp=otp)
    except Exception as exc:
        logger.error("Failed to send OTP email to %s: %s", email_clean, exc)
        # Do not leave a user locked behind a cooldown or an unusable challenge
        # when the provider rejects the delivery.
        await redis.delete(challenge_key, cooldown_key)
        await redis.decr(rate_key)
        return False, "Failed to deliver verification email"

    return True, "Verification email sent successfully"


_CONSUME_EMAIL_OTP_LUA = """
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


async def verify_email_otp_challenge(email: str, otp: str, purpose: str, user_id: str) -> Tuple[bool, str]:
    """
    Verify and consume the email one-time password atomically from Redis.
    """
    redis = get_redis()
    email_clean = email.strip().lower()
    email_hash = _email_digest(email_clean)
    challenge_key = _email_key(purpose, user_id, email_hash)

    challenge_id = await redis.hget(challenge_key, "challenge_id")
    if not challenge_id:
        return False, "Email OTP expired or not requested"

    digest = _otp_digest(challenge_id, otp.strip())
    result = await redis.eval(_CONSUME_EMAIL_OTP_LUA, 1, challenge_key, digest, EMAIL_OTP_MAX_ATTEMPTS)

    if result[0] == 0:
        verified_key = _email_key("verified", purpose, user_id, email_hash)
        if await redis.exists(verified_key):
            return True, "Email already verified"
        return False, "Email OTP expired or already used"
    if result[0] == -1:
        attempts = result[1] if len(result) > 1 else "?"
        return False, f"Invalid email verification code (attempt {attempts}/{EMAIL_OTP_MAX_ATTEMPTS})"

    verified_key = _email_key("verified", purpose, user_id, email_hash)
    await redis.set(verified_key, "1", ex=900)  # 15 minutes validity
    return True, "Email verified successfully"


async def is_email_verified(email: str, purpose: str, user_id: str) -> bool:
    """Check if an email was recently verified in Redis."""
    redis = get_redis()
    email_clean = email.strip().lower()
    email_hash = _email_digest(email_clean)
    verified_key = _email_key("verified", purpose, user_id, email_hash)
    return bool(await redis.exists(verified_key))
