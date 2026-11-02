"""Platform-admin access via the Zolexora auth service.

Every protected route forwards the caller's bearer token to the auth service's
/api/v1/auth/me, which checks the signature, expiry and revocation. Only tokens
with is_platform_admin=true are let through.
"""
import os
import httpx
from fastapi import Header, HTTPException

AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL", "").rstrip("/")


async def require_platform_admin(authorization: str = Header("")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    if not AUTH_SERVICE_URL:
        raise HTTPException(503, "AUTH_SERVICE_URL is not set (Infisical)")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{AUTH_SERVICE_URL}/api/v1/auth/me", headers={"Authorization": authorization})
    except httpx.HTTPError:
        raise HTTPException(503, "Auth service unreachable")
    if res.status_code != 200:
        raise HTTPException(401, "Invalid or expired session")
    user = res.json().get("user") or {}
    if user.get("is_platform_admin") is not True:
        raise HTTPException(403, "Platform admin access required")
    return user
