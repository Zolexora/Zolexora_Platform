"""Admin permission checks.

Administrators are Zolexora auth-service platform admins; their role and permissions
come from the auth service (managed in platform-admin), never from this database.
"""

from core.deps import admin_only as admin_context, has_permission, require_permission

__all__ = ["admin_context", "has_permission", "require_permission"]
