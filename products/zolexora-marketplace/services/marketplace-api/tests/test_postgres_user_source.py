
import pytest
from fastapi import HTTPException
from starlette.requests import Request

import core.deps as deps
from core.deps import admin_only, current_user
from routers.other import DiscountReq, admin_set_role, admin_stats, admin_users, coin_balance, generate_discount
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


class ForbiddenUsersCollection:
    def __getattr__(self, name):
        raise AssertionError(f"db.users must not be used for current user data: {name}")


class Cursor:
    def __init__(self, items):
        self.items = items

    async def to_list(self, _limit):
        return self.items


class Collection:
    def __init__(self, docs=None):
        self.docs = docs or []
        self.inserted = []
        self.deleted_filter = None
        self.updated = []
        self.deleted = []

    def find(self, query, projection=None):
        return Cursor([d.copy() for d in self.docs if _matches(d, query)])

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if _matches(doc, query):
                return doc.copy()
        return None

    async def insert_one(self, doc):
        self.inserted.append(doc)

    async def insert_many(self, docs):
        self.inserted.extend(docs)

    async def update_one(self, query, update):
        self.updated.append((query, update))

    async def update_many(self, query, update):
        self.updated.append((query, update))

    async def delete_one(self, query):
        self.deleted.append(query)
        before = len(self.docs)
        self.docs = [doc for doc in self.docs if not _matches(doc, query)]
        return type("DeleteResult", (), {"deleted_count": before - len(self.docs)})()

    async def delete_many(self, query):
        self.deleted_filter = query

    async def count_documents(self, query):
        return len([d for d in self.docs if _matches(d, query)])


class FakeDB:
    def __init__(self):
        self.users = ForbiddenUsersCollection()
        self.cart = Collection([{"user_id": "buyer-1", "product_id": "product-1", "quantity": 2, "storefront_id": "zolexora-shop"}])
        self.storefront_listings = Collection([{
            "id": "product-1",
            "product_id": "master-1",
            "price": {"amount_minor": 10000, "currency": "INR"},
            "seller_id": "seller-1",
            "status": "active",
            "storefront_id": "zolexora-shop"
        }])
        self.master_products = Collection([{
            "id": "master-1",
            "title": "Test Product",
            "images": ["image.jpg"],
            "seller_id": "seller-1",
            "seller_name": "Seller",
            "category": "Test"
        }])
        self.inventory_balances = Collection([{
            "product_id": "master-1",
            "seller_id": "seller-1",
            "available_quantity": 999
        }])
        self.orders = Collection()
        self.coin_transactions = Collection()
        self.discount_codes = Collection()
        self.reels = Collection()
        self.reel_views = Collection()


class FakeUserRepo:
    def __init__(self, users=None):
        self.users = users or {}
        self.adjustments = []
        self.roles = []
        self.active_updates = []

    async def get_by_id(self, user_id, *, internal=False):
        user = self.users.get(user_id)
        return user.copy() if user else None

    async def list_users(self, limit=50, offset=0, role=None):
        users = list(self.users.values())
        if role:
            role = "buyer" if role == "viewer" else role
            users = [user for user in users if user.get("role") == role]
        return [user.copy() for user in users[offset:offset + limit]]

    async def count_users(self, role=None, created_since=None):
        users = await self.list_users(role=role)
        return len(users)

    async def adjust_coin_balance(self, user_id, delta):
        self.adjustments.append((user_id, delta))
        self.users[user_id]["coin_balance"] += delta
        if self.users[user_id]["coin_balance"] < 0:
            raise AssertionError("test attempted an overdraw")
        return self.users[user_id]["coin_balance"]

    async def set_role(self, user_id, role):
        self.roles.append((user_id, role))
        return user_id in self.users

    async def set_active(self, user_id, active):
        self.active_updates.append((user_id, active))
        if user_id not in self.users:
            return False
        self.users[user_id]["is_active"] = active
        return True


def _matches(doc, query):
    return all(doc.get(key) == value for key, value in query.items())


# Removed obsolete cart and checkout tests


@pytest.mark.asyncio
async def test_coin_balance_uses_authenticated_postgres_user():
    assert await coin_balance({"id": "buyer-1", "coin_balance": 42}) == {"coin_balance": 42}


@pytest.mark.asyncio
async def test_generate_discount_debits_postgres_profile():
    db = FakeDB()
    user = {"id": "buyer-1", "coin_balance": 100}
    repo = FakeUserRepo({"buyer-1": {"coin_balance": 100}})

    discount = await generate_discount(
        DiscountReq(coins_to_spend=50),
        user=user,
        db=db,
        user_repo=repo,
    )

    assert discount["coins_spent"] == 50
    assert repo.adjustments == [("buyer-1", -50)]
    assert db.discount_codes.inserted


@pytest.mark.asyncio
async def test_generate_discount_rejects_insufficient_postgres_coin_balance():
    db = FakeDB()
    user = {"id": "buyer-1", "coin_balance": 10}
    repo = FakeUserRepo({"buyer-1": {"coin_balance": 10}})

    with pytest.raises(HTTPException) as exc:
        await generate_discount(
            DiscountReq(coins_to_spend=50),
            user=user,
            db=db,
            user_repo=repo,
        )

    assert exc.value.status_code == 400
    assert repo.adjustments == []
    assert db.discount_codes.inserted == []


@pytest.mark.asyncio
async def test_admin_set_role_updates_postgres_profile():
    repo = FakeUserRepo({"user-1": {"coin_balance": 0}})

    assert await admin_set_role("user-1", "seller", u={"id": "admin-1"}, user_repo=repo) == {
        "message": "Updated"
    }
    assert repo.roles == [("user-1", "seller")]


@pytest.mark.asyncio
async def test_current_user_resolves_opaque_session_to_postgres_profile(monkeypatch):
    repo = FakeUserRepo({
        "auth-user-1": {
            "id": "auth-user-1",
            "email": "buyer@example.com",
            "role": "buyer",
            "is_active": True,
            "is_email_verified": True,
            "auth_version": 1,
            "coin_balance": 12,
        }
    })

    async def fake_session(token):
        assert token == "valid-token"
        return {"user_id": "auth-user-1", "auth_version": 1}

    monkeypatch.setattr(deps, "get_session", fake_session)

    user = await current_user(_request(), "valid-token", repo)

    assert user["id"] == "auth-user-1"
    assert user["coin_balance"] == 12


@pytest.mark.asyncio
async def test_current_user_rejects_missing_token():
    with pytest.raises(HTTPException) as exc:
        await current_user(_request(), None, FakeUserRepo())

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_current_user_rejects_invalid_opaque_session(monkeypatch):
    async def fake_session(_token):
        return None

    monkeypatch.setattr(deps, "get_session", fake_session)

    with pytest.raises(HTTPException) as exc:
        await current_user(_request(), "bad-token", FakeUserRepo())

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_current_user_rejects_inactive_postgres_profile(monkeypatch):
    repo = FakeUserRepo({
        "auth-user-1": {
            "id": "auth-user-1",
            "email": "buyer@example.com",
            "role": "buyer",
            "is_active": False,
            "is_email_verified": True,
            "auth_version": 1,
        }
    })

    async def fake_session(_token):
        return {"user_id": "auth-user-1", "auth_version": 1}

    monkeypatch.setattr(deps, "get_session", fake_session)

    with pytest.raises(HTTPException) as exc:
        await current_user(_request(), "valid-token", repo)

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_admin_only_allows_admin_profile():
    user = await admin_only(user={"id": "admin-1", "role": "admin"})

    assert user["id"] == "admin-1"


@pytest.mark.asyncio
async def test_admin_only_rejects_non_admin_profile():
    with pytest.raises(HTTPException) as exc:
        await admin_only(user={"id": "buyer-1", "role": "buyer"})

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_admin_stats_and_users_read_postgres_profiles():
    db = FakeDB()
    db.storefront_listings.docs = [
        {"id": "prod-1", "product_id": "prod-1", "status": "active", "price": {"amount_minor": 1000, "currency": "INR"}, "seller_id": "seller-1", "storefront_id": "zolexora-shop"},
        {"id": "prod-2", "product_id": "prod-2", "status": "paused", "price": {"amount_minor": 1000, "currency": "INR"}, "seller_id": "seller-1", "storefront_id": "zolexora-shop"}
    ]
    db.orders.docs = [{"id": "order-1", "payment_status": "paid", "storefront_id": "zolexora-shop"}, {"id": "order-2", "status": "pending", "storefront_id": "zolexora-shop"}]
    repo = FakeUserRepo({
        "admin-1": {"id": "admin-1", "role": "admin"},
        "seller-1": {"id": "seller-1", "role": "seller"},
        "buyer-1": {"id": "buyer-1", "role": "buyer"},
    })
    dummy_context = StorefrontContext(
        storefront=StorefrontDefinition("id", StorefrontKey.ZOLEXORA_SHOP, "Name", "host", frozenset(), frozenset(), "INR", "en", True),
        source=StorefrontContextSource.CLIENT_HINT
    )
    stats = await admin_stats(u={"id": "admin-1", "role": "admin"}, context=dummy_context, db=db, user_repo=repo)
    users = await admin_users(u={"id": "admin-1", "role": "admin"}, user_repo=repo)

    assert stats["total_users"] == 3
    assert stats["viewers"] == 1
    assert stats["sellers"] == 1
    assert stats["total_products"] == 2
    assert [u["id"] for u in users] == ["admin-1", "seller-1", "buyer-1"]


def _request(method: str = "GET", headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    return Request({"type": "http", "method": method, "path": "/api/auth/me", "headers": headers or []})
