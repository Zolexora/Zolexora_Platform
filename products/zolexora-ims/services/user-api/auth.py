"""Identity via the Zolexora auth service (ADR 0004/0005).

Every request carries a business-session token from the auth service. IMS never verifies tokens
itself: the auth service's /api/v1/auth/me checks signature, expiry and revocation and returns the
member, the business (ZX-ORG id), the role and the ims:* permissions. Results are cached for
CACHE_TTL_SECONDS so a page load doesn't call the auth service per request; a revoked session or a
removed permission takes effect within that time.
"""
import hashlib
import os
import time
from typing import Any, Dict, Optional, Tuple

import httpx
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

try:
    from .models import UserProfile
except ImportError:
    from models import UserProfile

PRODUCT = "ims"
CACHE_TTL_SECONDS = 30
_CACHE_MAX = 10_000
_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}

bearer = HTTPBearer(auto_error=False)


class AuthServiceUnavailable(Exception):
    """Auth service not configured or unreachable (-> 503)."""


def auth_service_url() -> str:
    return (os.getenv("AUTH_SERVICE_URL") or "").strip().rstrip("/")


async def introspect(token: str) -> Optional[Dict[str, Any]]:
    """The auth service's view of a token, or None when it rejects it."""
    key = hashlib.sha256(token.encode()).hexdigest()
    now = time.monotonic()
    hit = _cache.get(key)
    if hit and hit[0] > now:
        return hit[1]

    base = auth_service_url()
    if not base:
        raise AuthServiceUnavailable("AUTH_SERVICE_URL is not set (Infisical)")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{base}/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as e:
        raise AuthServiceUnavailable("Auth service unreachable") from e
    if res.status_code in (401, 403):
        return None
    if res.status_code != 200:
        raise AuthServiceUnavailable(f"Auth service returned {res.status_code}")

    me = res.json() or {}
    if len(_cache) >= _CACHE_MAX:
        _cache.clear()
    _cache[key] = (now + CACHE_TTL_SECONDS, me)
    return me


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer)) -> UserProfile:
    """The signed-in member of one business, from an IMS business session."""
    if not credentials:
        raise _unauthorized("Sign in required")
    try:
        me = await introspect(credentials.credentials)
    except AuthServiceUnavailable as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Sign-in service unavailable") from e

    # Only business sessions opened for IMS: personal tokens and other products' sessions are refused.
    user, org = (me or {}).get("user") or {}, (me or {}).get("org") or {}
    if not me or not user.get("member_id") or not org.get("zolexora_org_id") or me.get("product") != PRODUCT:
        raise _unauthorized("Invalid session")
    if org.get("status") not in (None, "active"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This business is not active")

    email = user.get("email")
    return UserProfile(
        id=user["member_id"],
        org_id=org["zolexora_org_id"],
        org_name=org.get("name") or "",
        email=email or "",
        name=user.get("display_name") or (email.split("@")[0] if email else None) or user.get("phone_number") or "Staff",
        role=me.get("role") or "member",
        permissions=list(me.get("permissions") or []),
        zolexora_id=user.get("zolexora_id"),
    )


def require(*permissions: str):
    """Dependency: signed in and holding at least one of `permissions`."""

    async def check(user: UserProfile = Depends(get_current_user)) -> UserProfile:
        if not any(p in user.permissions for p in permissions):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {' or '.join(permissions)}")
        return user

    return check
