"""Identity via the Zolexora auth service (same model as platform-admin).

Every bearer token is checked by the auth service's /api/v1/auth/me, which verifies the
signature, expiry and revocation. TMS never verifies tokens itself. Results are cached
for a short time so a page load doesn't call the auth service once per request; a
revoked session stops working within CACHE_TTL_SECONDS.
"""
from collections import OrderedDict
import hashlib
import time
from typing import Any, Dict, Optional

import httpx
from jose import jwt

from app.core.config import settings

CACHE_TTL_SECONDS = 30
_CACHE_MAX = 10_000
_cache: OrderedDict[str, tuple[float, Dict[str, Any]]] = OrderedDict()
_client: Optional[httpx.AsyncClient] = None
_client_factory: Any = None


def _get_client() -> httpx.AsyncClient:
    """Reuse one keep-alive AsyncClient per process while still honoring test monkeypatches."""
    global _client, _client_factory
    if _client is None or _client.is_closed or _client_factory is not httpx.AsyncClient:
        _client_factory = httpx.AsyncClient
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(12.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        )
    return _client


async def close_client() -> None:
    global _client, _client_factory
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
    _client_factory = None


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
    if hit:
        if hit[0] > now:
            _cache.move_to_end(key)
            return hit[1]
        _cache.pop(key, None)

    base = auth_service_url()
    if not base:
        raise AuthServiceError("AUTH_SERVICE_URL is not set (Infisical)")
    try:
        client = _get_client()
        res = await client.get(f"{base}/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as e:
        raise AuthServiceError("Auth service unreachable") from e
    if res.status_code in (401, 403):
        raise InvalidToken("Rejected by auth service")
    if res.status_code != 200:
        raise AuthServiceError(f"Auth service returned {res.status_code}")
    data = res.json() or {}
    user = data.get("user") or {}
    org = data.get("org") or {}

    if user.get("member_id") and org.get("zolexora_org_id"):
        product = data.get("product")
        if product not in ("tms", "zolexora-tms"):
            raise InvalidToken("Token not issued for Zolexora TMS")
        if org.get("status") not in (None, "active"):
            raise InvalidToken("Business is not active")
        identity: Dict[str, Any] = {
            "uid": str(user["member_id"]),
            "member_id": str(user["member_id"]),
            "kind": user.get("kind"),
            "zolexora_id": user.get("zolexora_id"),
            "email": user.get("email"),
            "phone_number": user.get("phone_number"),
            "display_name": user.get("display_name"),
            "org_id": org.get("zolexora_org_id"),
            "org_name": org.get("name"),
            "org_status": org.get("status"),
            "business_kind": org.get("business_kind"),
            "role": data.get("role"),
            "product": product,
            "permissions": list(data.get("permissions") or []),
            "mfa_setup_required": bool(data.get("mfa_setup_required")),
            "verification": data.get("verification") or {},
            "is_platform_admin": False,
            "is_business_session": True,
        }
    else:
        if not user.get("uid"):
            raise InvalidToken("Auth service returned no user")
        identity = {
            **user,
            "is_business_session": False,
        }

    # Evict expired entries first, then oldest LRU entry to avoid thundering-herd cache clears.
    while _cache and next(iter(_cache.values()))[0] <= now:
        _cache.popitem(last=False)
    while len(_cache) >= _CACHE_MAX:
        _cache.popitem(last=False)
    _cache[key] = (now + CACHE_TTL_SECONDS, identity)
    return identity
