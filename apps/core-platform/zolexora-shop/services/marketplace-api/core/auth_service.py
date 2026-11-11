"""Identity via the Zolexora auth service (same model as TMS and platform-admin).

Every bearer token is checked by the auth service's /api/v1/auth/me, which verifies the
signature, expiry and revocation. The marketplace never verifies tokens itself. Results
are cached briefly so a page load doesn't call the auth service once per request; a
revoked session stops working within CACHE_TTL_SECONDS.
"""

import hashlib
import time
from typing import Any

import httpx

from core.config import settings

CACHE_TTL_SECONDS = 30
_CACHE_MAX = 10_000
_cache: dict[str, tuple[float, dict[str, Any]]] = {}


class AuthServiceError(Exception):
    """The auth service could not be reached or is not configured (-> 503)."""


class InvalidToken(Exception):
    """The auth service rejected the token (-> 401)."""


def auth_service_url() -> str:
    """One Infisical value works with and without Docker: a local auth service is
    host.docker.internal from our container (MARKETPLACE_IN_DOCKER=1) and localhost otherwise."""
    url = settings.AUTH_SERVICE_URL.rstrip("/")
    a, b = ("localhost", "host.docker.internal") if settings.MARKETPLACE_IN_DOCKER else ("host.docker.internal", "localhost")
    return url.replace(f"//{a}:", f"//{b}:", 1)


async def introspect(token: str) -> dict[str, Any]:
    """The auth service user: {uid, email, role, permissions, is_platform_admin, display_name,
    email_verified, phone_number, phone_verified}. Profile fields are present for public users."""
    key = hashlib.sha256(token.encode()).hexdigest()
    now = time.monotonic()
    hit = _cache.get(key)
    if hit and hit[0] > now:
        return hit[1]

    base = auth_service_url()
    if not base:
        raise AuthServiceError("AUTH_SERVICE_URL is not set (Infisical)")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{base}/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as exc:
        raise AuthServiceError("Auth service unreachable") from exc
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
