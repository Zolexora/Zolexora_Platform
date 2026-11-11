"""Regression tests: admin writes need the matching auth-service permission, and a local
marketplace profile can never be an administrator."""
import pytest
from fastapi import HTTPException

from core import deps
from core.deps import has_permission, require_permission


def admin(role="", perms=()):
    return {"id": "a1", "is_admin": True, "admin_role": role, "permissions": list(perms)}


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
async def test_a_local_profile_is_never_an_admin(monkeypatch):
    async def introspect(token):
        return {"uid": "u1", "email": "a@b.c", "email_verified": True, "is_platform_admin": False}

    class Repo:
        async def sync_identity(self, identity):
            return {"id": "u1", "is_admin": True, "is_active": True, "status": "active"}

    class Req:
        headers = {}

        class state:
            pass

    monkeypatch.setattr(deps, "introspect", introspect)
    creds = type("C", (), {"credentials": "t"})()
    user = await deps.current_user(Req(), creds, Repo())
    assert not deps.is_admin(user)
    with pytest.raises(HTTPException):
        await deps.admin_only(user)


def test_marketplace_has_no_role_endpoint():
    from main import app
    assert not [r for r in app.routes if "/users/" in getattr(r, "path", "") and r.path.endswith("/role")]


@pytest.mark.asyncio
@pytest.mark.parametrize("user", [
    {"id": "s1", "zolexora_org_id": "ZX-ORG-AAAA-BBBB-CCCC", "seller_org_id": "o1"},
    {"id": "a1", "is_admin": True},
])
async def test_staff_and_admins_cannot_create_seller_organisations(user):
    from seller_orgs.router import create_seller_organization
    from seller_orgs.schemas import SellerOrgCreate
    with pytest.raises(HTTPException) as exc:
        await create_seller_organization(SellerOrgCreate(name="Shop", slug="shop"), user=user, repo=None)
    assert exc.value.status_code == 403
