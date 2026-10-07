"""Authentication and authorization dependencies."""

import re

from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.config import settings
from core.database import get_db
from shared.database.redis import get_session, validate_csrf
from users.repositories import UserRepository, get_user_repository
from shared.database.postgres import connection

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
SESSION_COOKIE = "z_session"
CSRF_COOKIE = "z_csrf"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def db_dep() -> AsyncIOMotorDatabase:
    return get_db()


async def current_user(
    request: Request,
    bearer: str | None = Depends(oauth2),
    repo: UserRepository = Depends(get_user_repository),
) -> dict:
    cookie = request.cookies.get(SESSION_COOKIE)
    if cookie and bearer:
        raise HTTPException(400, "Multiple session credentials are not allowed")
    token = cookie or bearer
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        session = await get_session(token)
    except Exception as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc
    if not session:
        raise HTTPException(401, "Invalid or expired session")
    user = await repo.get_by_id(session["user_id"], internal=True)
    if user is None:
        # Administrators are intentionally not rows in public.users. Their
        # Firebase-verified email maps directly to the separated admin directory.
        async with connection() as conn:
            admin = await conn.fetchrow(
                "SELECT id,email,full_name,is_active,created_at FROM public.admins WHERE id=$1::uuid",
                session["user_id"],
            )
        if admin:
            user = {
                "id": str(admin["id"]), "email": admin["email"],
                "name": admin["full_name"], "full_name": admin["full_name"],
                "role": "admin", "coin_balance": 0, "is_active": admin["is_active"],
                "is_email_verified": True, "is_phone_verified": False,
                "auth_provider": "firebase",
                "picture": None, "created_at": admin["created_at"].isoformat(), "auth_version": 1,
                "status": "active",
            }
    if (
        not user
        or not user["is_active"]
        or user.get("status", "active") != "active"
        or not user["is_email_verified"]
    ):
        raise HTTPException(401, "Invalid or expired session")
    if user["auth_version"] != session["auth_version"]:
        raise HTTPException(401, "Invalid or expired session")
    if cookie and request.method not in SAFE_METHODS:
        origin = request.headers.get("origin")
        csrf_cookie = request.cookies.get(CSRF_COOKIE, "")
        csrf_header = request.headers.get("x-csrf-token", "")
        if origin not in settings.CORS_ORIGINS or not csrf_cookie or csrf_cookie != csrf_header:
            raise HTTPException(403, "CSRF validation failed")
        if not await validate_csrf(token, csrf_header):
            raise HTTPException(403, "CSRF validation failed")
    user.pop("password_hash", None)
    user.pop("auth_version", None)
    request.state.authenticated_user = user
    return user


async def optional_user(
    request: Request,
    bearer: str | None = Depends(oauth2),
    repo: UserRepository = Depends(get_user_repository),
) -> dict | None:
    if not request.cookies.get(SESSION_COOKIE) and not bearer:
        return None
    try:
        return await current_user(request, bearer, repo)
    except HTTPException:
        return None


async def is_development_mock_seller(user: dict, repo: UserRepository | None = None) -> bool:
    """Recognize the configured local-only seller fixture by either identity field."""
    if settings.APP_ENV.lower() in {"prod", "production", "staging"}:
        return False
    configured_uid = settings.SELLER_MOCK_VERIFIED_FIREBASE_UID
    if not configured_uid:
        return False
    if user.get("firebase_uid") == configured_uid:
        return True
    # Older identities may have the Firebase subject only in external_identity
    # because users.firebase_uid is populated with COALESCE during migration.
    if repo is not None:
        try:
            subject = await repo.get_external_identity_subject(user["id"])
        except Exception:
            return False
        return subject == configured_uid
    return False


async def seller_only(
    user=Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
):
    mock_seller = await is_development_mock_seller(user, repo)
    if user["role"] not in ("seller", "admin") and not mock_seller:
        raise HTTPException(403, "Sellers only")
    return user


async def admin_only(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admins only")
    return user


def validate_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email address")
    return email
