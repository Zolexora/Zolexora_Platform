"""Platform admins (auth-service accounts, no users row) list and suspend users, with an audit row."""

import uuid

import pytest

from admin_management.router import list_managed_users, update_user_status
from admin_management.schemas import UserStatusPatch
from tests.commerce_seed import BUYER_2

ADMIN = {"id": str(uuid.uuid4()), "email": "ops@zolexora.com", "is_admin": True, "permissions": ["users:read", "users:write"]}


class FakeRequest:
    class state:  # noqa: N801
        pass
    client = None
    headers: dict = {}


@pytest.fixture
def pool(pg, monkeypatch):
    """The routes' connection() and transaction() use the test's connection."""
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def same():
        async with pg.transaction():
            yield pg

    monkeypatch.setattr("admin_management.router.connection", same)
    monkeypatch.setattr("admin_management.router.transaction", same)


@pytest.mark.asyncio
async def test_admin_lists_and_suspends_a_user(pg, pool):
    page = await list_managed_users(status=None, search=None, limit=100, offset=0, _admin=ADMIN)
    assert page.total >= 1 and any(u.id == BUYER_2 for u in page.items)

    out = await update_user_status(BUYER_2, UserStatusPatch(status="suspended", reason="Chargeback fraud"), FakeRequest(), admin=ADMIN)
    assert out.status == "suspended" and out.is_active is False
    assert await pg.fetchval("SELECT count(*) FROM admin_audit_logs WHERE target_user_id = $1::uuid", BUYER_2) == 1
