"""Admin permission checks.

Administrators are Zolexora auth-service platform admins; their role and permissions
come from the auth service (managed in platform-admin), never from this database.
"""

from fastapi import Depends, HTTPException

from core.deps import current_user


async def admin_context(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Marketplace administrator access required")
    return user


def has_permission(admin: dict, permission: str) -> bool:
    perms = admin.get("permissions") or []
    return admin.get("admin_role") in {"superadmin", "super_admin"} or "*" in perms or permission in perms


def require_permission(permission: str):
    async def dependency(admin: dict = Depends(admin_context)) -> dict:
        if not has_permission(admin, permission):
            raise HTTPException(403, f"Missing administrator permission: {permission}")
        return admin

    return dependency
