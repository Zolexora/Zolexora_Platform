"""Authentication and authorization dependencies.

Sign-in belongs to the Zolexora auth service. Every request carries its bearer token,
which core.auth_service checks with the auth service. Access follows only from how the
person signed in; the marketplace keeps no roles of its own:

- Track 1 (public): shoppers. In the seller portal they act for a seller organisation they
  are an active member of (X-Organization-Id, else their oldest), or create one.
- Track 2 (employee): staff of a Zolexora organisation linked to a seller organisation; they
  act only for that organisation.
- Track 3 (platform admin): administrators, with the permissions in their token.
"""

import logging
import uuid

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.auth_service import AuthServiceError, InvalidToken, introspect
from core.database import get_db
from shared.database.postgres import connection, pg_conn_dep
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
        "is_admin": True,
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
    elif identity.get("org_id"):
        user = await _employee(identity, repo)
    elif identity.get("email") and identity.get("email_verified") is True:
        user = await repo.sync_identity(identity)
        if not user["is_active"] or user.get("status", "active") != "active":
            raise HTTPException(403, "Account is suspended")
    else:
        # Unverified accounts have no marketplace access.
        raise HTTPException(403, "This account cannot use the marketplace")

    if identity.get("is_platform_admin") is not True:
        # Only a platform-admin token administers; nothing stored locally can grant it.
        user = {**user, "is_admin": False}
    if "seller_org_id" not in user and request.headers.get("X-Organization-Id"):
        # Owners choose among their seller organisations (checked against membership where used).
        user = {**user, "requested_org_id": request.headers["X-Organization-Id"]}
    request.state.authenticated_user = user
    return user


# Auth-service employee roles → seller organisation roles (OWNER stays with the Track 1 owner).
_EMPLOYEE_MEMBER_ROLES = {"owner": "ADMIN", "admin": "ADMIN", "manager": "MANAGER"}


async def _employee(identity: dict, repo: UserRepository) -> dict:
    async with connection() as conn:
        org = await conn.fetchrow(
            "SELECT id, status FROM seller_organization WHERE zolexora_org_id = $1", identity["org_id"],
        )
    if not org or org["status"] in ("SUSPENDED", "REJECTED", "INACTIVE"):
        raise HTTPException(403, "Your organisation is not linked to a marketplace seller account, or it is suspended")
    member_role = _EMPLOYEE_MEMBER_ROLES.get(str(identity.get("role") or "").lower(), "MEMBER")
    user = await repo.sync_employee(identity, org["id"], member_role)
    if not user["is_active"] or user.get("status", "active") != "active":
        raise HTTPException(403, "Account is suspended")
    # Staff act only for their own organisation.
    return {**user, "seller_org_id": str(org["id"]), "zolexora_org_id": identity["org_id"]}


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


def is_admin(user: dict | None) -> bool:
    """A platform admin (Track 3) token."""
    return bool(user) and user.get("is_admin") is True


async def seller_member(user=Depends(current_user), db=Depends(pg_conn_dep)) -> dict:
    """The user acting for a seller organisation they are an active member of: staff for their
    linked one, owners for X-Organization-Id or else their oldest (same rule as TMS)."""
    wanted = user.get("seller_org_id") or user.get("requested_org_id")
    try:
        wanted_id = uuid.UUID(str(wanted)) if wanted else None
        user_id = uuid.UUID(str(user["id"]))
    except ValueError:
        wanted_id = user_id = None
    org_id = None
    if user_id and not is_admin(user):
        org_id = await db.fetchval(
            """SELECT m.organization_id FROM seller_org_member m
               JOIN seller_organization o ON o.id = m.organization_id
               WHERE m.user_id = $1 AND m.status = 'ACTIVE' AND o.status = 'ACTIVE'
                 AND ($2::uuid IS NULL OR m.organization_id = $2)
               ORDER BY m.created_at ASC LIMIT 1""",
            user_id, wanted_id,
        )
    if not org_id:
        raise HTTPException(
            403, "Create or choose a seller organisation first",
            headers={"X-Error-Code": "SELLER_ORGANIZATION_REQUIRED"},
        )
    return {**user, "seller_org_id": str(org_id)}


async def seller_only(user=Depends(current_user), db=Depends(pg_conn_dep)) -> dict:
    """Seller endpoints: a seller organisation member, or a platform admin."""
    return user if is_admin(user) else await seller_member(user, db)


async def admin_only(user=Depends(current_user)):
    if not is_admin(user):
        raise HTTPException(403, "Admins only")
    return user


def has_permission(admin: dict, permission: str) -> bool:
    """Admin permissions come from the auth-service token (managed in platform-admin):
    users:read, users:write, catalog:write, content:write, orders:write, sellers:write, audit:read."""
    perms = admin.get("permissions") or []
    return admin.get("admin_role") in {"superadmin", "super_admin"} or "*" in perms or permission in perms


def require_permission(permission: str):
    async def dependency(admin: dict = Depends(admin_only)) -> dict:
        if not has_permission(admin, permission):
            raise HTTPException(403, f"Missing administrator permission: {permission}")
        return admin

    return dependency
