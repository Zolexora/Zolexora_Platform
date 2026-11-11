"""Identity via the Zolexora auth service (same model as platform-admin).

Every bearer token is checked by the auth service's /api/v1/auth/me, which verifies the
signature, expiry and revocation. TMS never verifies tokens itself. Results are cached
for a short time so a page load doesn't call the auth service once per request; a
revoked session stops working within CACHE_TTL_SECONDS.
"""
import hashlib
import time
from typing import Any, Dict

import httpx
from jose import jwt

from app.core.config import settings

CACHE_TTL_SECONDS = 30
_CACHE_MAX = 10_000
_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}


class AuthServiceError(Exception):
    """The auth service could not be reached or is not configured (-> 503)."""


class InvalidToken(Exception):
    """The auth service rejected the token (-> 401)."""


def auth_service_url() -> str:
    """One Infisical value works with and without Docker: a local auth service is
    host.docker.internal from our container (TMS_IN_DOCKER=1) and localhost otherwise."""
    url = (settings.AUTH_SERVICE_URL or "").rstrip("/")
    a, b = ("localhost", "host.docker.internal") if settings.TMS_IN_DOCKER else ("host.docker.internal", "localhost")
    return url.replace(f"//{a}:", f"//{b}:", 1)


def _test_token(token: str) -> Dict[str, Any]:
    # Test suite only: HS256 tokens signed with JWT_SECRET, shaped like the auth service user.
    claims = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
    uid = claims.get("uid") or claims.get("sub")
    return {**claims, "uid": uid}


async def introspect(token: str) -> Dict[str, Any]:
    """Returns the auth service user ({uid, email, org_id, role, permissions, is_platform_admin})."""
    if settings.ENVIRONMENT == "test" and settings.JWT_SECRET:
        try:
            return _test_token(token)
        except Exception as e:
            raise InvalidToken(str(e)) from e

    key = hashlib.sha256(token.encode()).hexdigest()
    hit = _cache.get(key)
    now = time.monotonic()
    if hit and hit[0] > now:
        return hit[1]

    base = auth_service_url()
    if not base:
        raise AuthServiceError("AUTH_SERVICE_URL is not set (Infisical)")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{base}/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as e:
        raise AuthServiceError("Auth service unreachable") from e
    if res.status_code in (401, 403):
        raise InvalidToken("Rejected by auth service")
    if res.status_code != 200:
        raise AuthServiceError(f"Auth service returned {res.status_code}")
    user = (res.json() or {}).get("user") or {}
    if not user.get("uid"):
        raise InvalidToken("Auth service returned no user")

    if len(_cache) >= _CACHE_MAX:
        _cache.clear()
    _cache[key] = (now + CACHE_TTL_SECONDS, user)
    return user
