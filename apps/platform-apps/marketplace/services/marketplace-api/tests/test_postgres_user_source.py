
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from core.deps import admin_only
from routers.other import admin_stats, admin_users
from storefronts.models import StorefrontContext, StorefrontKey, StorefrontContextSource, StorefrontDefinition

def _mock_context() -> StorefrontContext:
    definition = StorefrontDefinition(
        id="sf_123",
        key=StorefrontKey.ZOLEXORA_SHOP,
        display_name="Zolexora Shop",
        canonical_host="shop.zolexora.com",
        hosts=frozenset(["shop.zolexora.com"]),
        origins=frozenset(["https://shop.zolexora.com"]),
    )
    return StorefrontContext(storefront=definition, source=StorefrontContextSource.HOST)


class FakeUserRepo:
    def __init__(self, users=None):
        self.users = users or {}
        self.active_updates = []

    async def get_by_id(self, user_id, *, internal=False):
        user = self.users.get(user_id)
        return user.copy() if user else None

    async def list_users(self, limit=50, offset=0):
        users = list(self.users.values())
        return [user.copy() for user in users[offset:offset + limit]]

    async def count_users(self, created_since=None):
        users = await self.list_users()
        return len(users)

    async def set_active(self, user_id, active):
        self.active_updates.append((user_id, active))
        if user_id not in self.users:
            return False
        self.users[user_id]["is_active"] = active
        return True


@pytest.mark.asyncio
async def test_admin_only_allows_admin_profile():
    user = await admin_only(user={"id": "admin-1", "is_admin": True})

    assert user["id"] == "admin-1"


@pytest.mark.asyncio
async def test_admin_only_rejects_non_admin_profile():
    with pytest.raises(HTTPException) as exc:
        await admin_only(user={"id": "buyer-1"})

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_admin_stats_and_users_read_postgres_profiles():
    repo = FakeUserRepo({
        "admin-1": {"id": "admin-1", "is_admin": True},
        "seller-1": {"id": "seller-1"},
        "buyer-1": {"id": "buyer-1"},
    })
    dummy_context = StorefrontContext(
        storefront=StorefrontDefinition("id", StorefrontKey.ZOLEXORA_SHOP, "Name", "host", frozenset(), frozenset(), "INR", "en", True),
        source=StorefrontContextSource.CLIENT_HINT
    )
    class Catalog:  # the PostgreSQL listing and order counts
        async def fetchrow(self, sql, key):
            assert key == "zolexora-shop"
            return {"total": 2, "active": 1}

        async def fetchval(self, sql, *args):
            return 0

    stats = await admin_stats(u={"id": "admin-1", "is_admin": True}, context=dummy_context, user_repo=repo, pg=Catalog())
    users = await admin_users(u={"id": "admin-1", "is_admin": True}, user_repo=repo)

    assert stats["total_users"] == 3
    assert stats["total_products"] == 2 and stats["active_products"] == 1
    assert [u["id"] for u in users] == ["admin-1", "seller-1", "buyer-1"]


def _request(method: str = "GET", headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    return Request({"type": "http", "method": method, "path": "/api/auth/me", "headers": headers or []})
