"""Only an owner makes, changes or removes an owner; verification and suspension don't undo each other."""

import uuid

import pytest
from fastapi import HTTPException

from seller_orgs.repository import PostgresSellerRepository
from seller_orgs.router import admin_update_organization_suspension, update_org_member_role
from seller_orgs.schemas import AdminSuspensionUpdate, SellerOrgMemberUpdateRole
from tests.commerce_seed import BUYER_1, BUYER_2

ADMIN = {"id": str(uuid.uuid4()), "is_admin": True, "permissions": ["sellers:write"]}


async def _org(repo):
    org = await repo.create_organization(name="Org", slug=f"org-{uuid.uuid4().hex[:6]}", owner_user_id=uuid.UUID(BUYER_1))
    admin = await repo.add_member(org_id=org["id"], user_id=uuid.UUID(BUYER_2), role="ADMIN", actor_user_id=uuid.UUID(BUYER_1))
    owner = await repo.connection.fetchval("SELECT id FROM seller_org_member WHERE organization_id = $1 AND role = 'OWNER'", org["id"])
    return org, admin, owner


@pytest.mark.asyncio
async def test_an_org_admin_cannot_take_or_touch_ownership(pg):
    repo = PostgresSellerRepository(pg)
    org, admin, owner = await _org(repo)
    as_admin = {"id": BUYER_2, "role": "ADMIN"}
    for member_id, role in ((admin["id"], "OWNER"), (owner, "MEMBER")):
        with pytest.raises(HTTPException) as exc:
            await update_org_member_role(org["id"], member_id, SellerOrgMemberUpdateRole(role=role),
                                         user=as_admin, _org=org, _member_role=as_admin, repo=repo)
        assert exc.value.status_code == 403
    with pytest.raises(PermissionError):
        await repo.remove_member(org_id=org["id"], member_id=owner, actor_user_id=uuid.UUID(BUYER_2), actor_role="ADMIN")
    # The owner still can.
    out = await repo.update_member_role(org_id=org["id"], member_id=admin["id"], new_role="MANAGER", actor_user_id=uuid.UUID(BUYER_1))
    assert out["role"] == "MANAGER"


@pytest.mark.asyncio
async def test_unsuspending_or_verifying_never_skips_the_other(pg):
    repo = PostgresSellerRepository(pg)
    org, *_ = await _org(repo)
    admin_id = uuid.UUID(ADMIN["id"])

    unsuspended = await admin_update_organization_suspension(org["id"], AdminSuspensionUpdate(action="UNSUSPEND", reason="x"), user=ADMIN, repo=repo)
    assert unsuspended["status"] == "PENDING_VERIFICATION"  # not verified yet, so not ACTIVE

    await admin_update_organization_suspension(org["id"], AdminSuspensionUpdate(action="SUSPEND", reason="fraud"), user=ADMIN, repo=repo)
    verified = await repo.update_organization_verification(org_id=org["id"], verification_status="VERIFIED", admin_user_id=admin_id)
    assert verified["status"] == "SUSPENDED"  # verification does not lift a suspension

    lifted = await admin_update_organization_suspension(org["id"], AdminSuspensionUpdate(action="UNSUSPEND", reason="ok"), user=ADMIN, repo=repo)
    assert lifted["status"] == "ACTIVE"
    with pytest.raises(ValueError):
        AdminSuspensionUpdate(action="unsuspend-typo", reason="x")
