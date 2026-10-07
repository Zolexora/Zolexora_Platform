"""Server-authoritative admin membership and permission checks."""

import json

from fastapi import Depends, HTTPException

from core.deps import current_user
from shared.database.postgres import connection


async def admin_context(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Marketplace administrator access required")
    async with connection() as conn:
        row = await conn.fetchrow(
            """SELECT id, email, full_name, role::text,
                      permissions, is_active
               FROM public.admins WHERE lower(email)=lower($1)""",
            user.get("email", ""),
        )
    if row is None or not row["is_active"]:
        raise HTTPException(403, "Administrator account is inactive")
    permissions = row["permissions"]
    if isinstance(permissions, str):
        try:
            permissions = json.loads(permissions)
        except json.JSONDecodeError:
            permissions = []
    if not isinstance(permissions, list):
        permissions = []
    return {**dict(row), "permissions": permissions, "user": user}


def require_permission(permission: str):
    async def dependency(admin: dict = Depends(admin_context)) -> dict:
        if admin["role"] != "super_admin" and permission not in admin["permissions"]:
            raise HTTPException(403, f"Missing administrator permission: {permission}")
        return admin

    return dependency
