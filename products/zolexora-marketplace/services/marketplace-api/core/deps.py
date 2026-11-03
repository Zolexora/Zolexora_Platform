"""Authentication and authorization dependencies.

Sign-in belongs to the Zolexora auth service. Every request carries its bearer token,
which core.auth_service checks with the auth service. Buyers and sellers are public
(Track 1) users with a local marketplace profile; administrators are auth-service
platform admins (Track 3) and have no local profile.
"""

import logging

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.auth_service import AuthServiceError, InvalidToken, introspect
from core.database import get_db
from users.repositories import UserRepository, get_user_repository

logger = logging.getLogger("zolexora.auth")
bearer = HTTPBearer(auto_error=False)


async def db_dep() -> AsyncIOMotorDatabase:
    return get_db()


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})


def _admin(identity: dict) -> dict:
    return {
        "id": identity["uid"],
        "email": identity.get("email") or "",
        "name": identity.get("email") or "Administrator",
        "full_name": identity.get("email") or "Administrator",
        "role": "admin",
        "admin_role": identity.get("role") or "",
        "permissions": list(identity.get("permissions") or []),
        "coin_balance": 0,
        "is_active": True,
        "status": "active",
    }


async def current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    repo: UserRepository = Depends(get_user_repository),
) -> dict:
    if not credentials:
        raise _unauthorized()
    try:
        identity = await introspect(credentials.credentials)
    except InvalidToken as exc:
        raise _unauthorized("Invalid or expired session") from exc
    except AuthServiceError as exc:
        logger.error("Auth service unavailable: %s", exc)
        raise HTTPException(503, "Authentication service unavailable") from exc

    if identity.get("is_platform_admin") is True:
        user = _admin(identity)
    elif identity.get("email") and identity.get("email_verified") is True:
        user = await repo.sync_identity(identity)
        if not user["is_active"] or user.get("status", "active") != "active":
            raise HTTPException(403, "Account is suspended")
    else:
        # Employee (Track 2) tokens and unverified accounts have no marketplace access.
        raise HTTPException(403, "This account cannot use the marketplace")

    request.state.authenticated_user = user
    return user


async def optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    repo: UserRepository = Depends(get_user_repository),
) -> dict | None:
    if not credentials:
        return None
    try:
        return await current_user(request, credentials, repo)
    except HTTPException:
        return None


async def seller_only(user=Depends(current_user)):
    if user["role"] not in ("seller", "admin"):
        raise HTTPException(403, "Sellers only")
    return user


async def admin_only(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admins only")
    return user
