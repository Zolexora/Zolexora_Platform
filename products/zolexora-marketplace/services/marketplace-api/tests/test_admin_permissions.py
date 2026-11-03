"""Regression tests: admin writes need the matching auth-service permission, and a local
marketplace profile can never be an administrator."""
import pytest
from fastapi import HTTPException

from core import deps
from core.deps import has_permission, require_permission


def admin(role="", perms=()):
    return {"id": "a1", "role": "admin", "admin_role": role, "permissions": list(perms)}


def test_permission_rules():
    assert has_permission(admin(perms=["users:write"]), "users:write")
    assert not has_permission(admin(perms=["users:read"]), "users:write")
    assert has_permission(admin(perms=["*"]), "catalog:write")
    assert has_permission(admin(role="superadmin"), "orders:write")


@pytest.mark.asyncio
async def test_require_permission_rejects_admins_without_it():
    check = require_permission("users:write")
    with pytest.raises(HTTPException) as exc:
        await check(admin=admin(perms=["users:read"]))
    assert exc.value.status_code == 403
    assert (await check(admin=admin(perms=["users:write"])))["id"] == "a1"


@pytest.mark.asyncio
async def test_local_admin_role_is_treated_as_buyer(monkeypatch):
    async def introspect(token):
        return {"uid": "u1", "email": "a@b.c", "email_verified": True, "is_platform_admin": False}

    class Repo:
        async def sync_identity(self, identity):
            return {"id": "u1", "role": "admin", "is_active": True, "status": "active"}

    class Req:
        class state:
            pass

    monkeypatch.setattr(deps, "introspect", introspect)
    creds = type("C", (), {"credentials": "t"})()
    user = await deps.current_user(Req(), creds, Repo())
    assert user["role"] == "buyer"
    with pytest.raises(HTTPException):
        await deps.admin_only(user)


@pytest.mark.asyncio
async def test_admins_cannot_hand_out_the_admin_role():
    from routers.other import admin_set_role
    with pytest.raises(HTTPException) as exc:
        await admin_set_role("u1", "admin", u=admin(perms=["*"]), user_repo=None)
    assert exc.value.status_code == 400
