from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional
import httpx
from jose import jwt, jwk
from jose.exceptions import JWTError
from app.core.config import settings

logger = logging.getLogger(__name__)

# Google Firebase public JWKS URL
FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

# In-memory cache for Firebase JWKS keys
_JWKS_CACHE: Dict[str, Any] = {}
_JWKS_CACHE_TIME: Optional[float] = None
_CACHE_TTL_SECONDS = 3600  # 1 hour


async def get_firebase_jwks() -> Dict[str, Any]:
    global _JWKS_CACHE, _JWKS_CACHE_TIME
    now = datetime.now(timezone.utc).timestamp()

    if _JWKS_CACHE and _JWKS_CACHE_TIME and (now - _JWKS_CACHE_TIME < _CACHE_TTL_SECONDS):
        return _JWKS_CACHE

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(FIREBASE_JWKS_URL)
            if resp.status_code == 200:
                _JWKS_CACHE = resp.json()
                _JWKS_CACHE_TIME = now
                logger.info("Fetched and cached Google Firebase JWKS successfully")
                return _JWKS_CACHE
    except Exception as e:
        logger.warning(f"Failed to fetch Firebase JWKS from {FIREBASE_JWKS_URL}: {e}")

    return _JWKS_CACHE


async def verify_firebase_jwt(token: str) -> Dict[str, Any]:
    """
    Verifies a Google Firebase ID token:
    1. Matches the token's `kid` against Google's public JWKS (RS256 only).
    2. Validates signature, expiry, audience and issuer for an allowed project.
    Unsigned or unverifiable tokens are always rejected.
    """
    try:
        headers = jwt.get_unverified_header(token)
    except JWTError as e:
        raise ValueError(f"Invalid token header: {e}")

    # HS256 test tokens are accepted only when running the test suite.
    if settings.ENVIRONMENT == "test" and settings.JWT_SECRET and headers.get("alg") == "HS256":
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})

    allowed_projects = set(settings.FIREBASE_ALLOWED_PROJECTS) or (
        {settings.FIREBASE_PROJECT_ID} if settings.FIREBASE_PROJECT_ID else set()
    )
    if not allowed_projects:
        raise ValueError("FIREBASE_PROJECT_ID / FIREBASE_ALLOWED_PROJECTS is not configured")

    kid = headers.get("kid")
    jwks_data = await get_firebase_jwks()
    matched_key = next((k for k in jwks_data.get("keys", []) if k.get("kid") == kid), None)
    if not matched_key:
        raise ValueError("Token signing key not recognised")

    public_key = jwk.construct(matched_key)
    claims = jwt.decode(
        token,
        public_key.to_pem().decode("utf-8"),
        algorithms=["RS256"],
        options={"verify_aud": False, "verify_iss": False},
    )

    aud = claims.get("aud")
    if aud not in allowed_projects:
        raise ValueError(f"Token issued for unauthorized Firebase project: {aud}")
    if claims.get("iss") != f"https://securetoken.google.com/{aud}":
        raise ValueError("Token issuer does not match Firebase project")
    if not claims.get("sub"):
        raise ValueError("Token subject missing")
    return claims
