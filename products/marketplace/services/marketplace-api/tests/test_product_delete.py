import pytest
from fastapi import HTTPException

from routers.other import admin_delete_product
from routers.products import delete_product
from storefronts.models import StorefrontContext, StorefrontKey, StorefrontDefinition, StorefrontContextSource

dummy_context = StorefrontContext(
    storefront=StorefrontDefinition(
        id="store_zolexora",
        key=StorefrontKey.ZOLEXORA_SHOP,
        display_name="Zolexora Shop",
        canonical_host="shop.zolexora.com",
        hosts=frozenset(["shop.zolexora.com"]),
        origins=frozenset(["https://shop.zolexora.com"])
    ),
    source=StorefrontContextSource.CLIENT_HINT
)


class ProductCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        self.docs.append(doc.copy())

    async def find_one(self, query):
        for doc in self.docs:
            if all(doc.get(key) == value for key, value in query.items()):
                return doc.copy()
        return None

    async def delete_one(self, query):
        before = len(self.docs)
        self.docs = [
            doc for doc in self.docs
            if not all(doc.get(key) == value for key, value in query.items())
        ]
        return type("DeleteResult", (), {"deleted_count": before - len(self.docs)})()


class FakeDB:
    def __init__(self):
        self.storefront_listings = ProductCollection()


@pytest.mark.asyncio
async def test_seller_delete_success():
    db = FakeDB()
    await db.storefront_listings.insert_one({
        "id": "prod-123",
        "title": "Seller Product",
        "seller_id": "seller-1",
        "storefront_id": "zolexora-shop",
        "is_active": True,
    })

    response = await delete_product("prod-123", context=dummy_context, user={"id": "seller-1", "role": "seller"}, db=db)

    assert response == {"message": "Deleted"}
    assert await db.storefront_listings.find_one({"id": "prod-123"}) is None


@pytest.mark.asyncio
async def test_seller_delete_missing_returns_404():
    db = FakeDB()

    with pytest.raises(HTTPException) as exc:
        await delete_product("non-existent", context=dummy_context, user={"id": "seller-1", "role": "seller"}, db=db)

    assert exc.value.status_code == 404
    assert "Product not found" in exc.value.detail


@pytest.mark.asyncio
async def test_seller_delete_twice_returns_404():
    db = FakeDB()
    await db.storefront_listings.insert_one({
        "id": "prod-123",
        "title": "Seller Product",
        "seller_id": "seller-1",
        "storefront_id": "zolexora-shop",
        "is_active": True,
    })

    assert await delete_product("prod-123", context=dummy_context, user={"id": "seller-1", "role": "seller"}, db=db) == {
        "message": "Deleted"
    }
    with pytest.raises(HTTPException) as exc:
        await delete_product("prod-123", context=dummy_context, user={"id": "seller-1", "role": "seller"}, db=db)

    assert exc.value.status_code == 404
    assert "Product not found" in exc.value.detail


@pytest.mark.asyncio
async def test_seller_cannot_delete_another_seller_product():
    db = FakeDB()
    await db.storefront_listings.insert_one({
        "id": "prod-456",
        "title": "Other Seller Product",
        "seller_id": "seller-2",
        "storefront_id": "zolexora-shop",
        "is_active": True,
    })

    with pytest.raises(HTTPException) as exc:
        await delete_product("prod-456", context=dummy_context, user={"id": "seller-1", "role": "seller"}, db=db)

    assert exc.value.status_code == 404
    assert "Product not found or not yours" in exc.value.detail
    assert await db.storefront_listings.find_one({"id": "prod-456"}) is not None


@pytest.mark.asyncio
async def test_admin_delete_success():
    db = FakeDB()
    await db.storefront_listings.insert_one({
        "id": "prod-789",
        "title": "Some Product",
        "seller_id": "seller-1",
        "storefront_id": "zolexora-shop",
        "is_active": True,
    })

    response = await delete_product("prod-789", context=dummy_context, user={"id": "admin-1", "role": "admin"}, db=db)

    assert response == {"message": "Deleted"}
    assert await db.storefront_listings.find_one({"id": "prod-789"}) is None


@pytest.mark.asyncio
async def test_admin_delete_via_admin_route_success():
    db = FakeDB()
    await db.storefront_listings.insert_one({
        "id": "prod-789",
        "title": "Some Product",
        "seller_id": "seller-1",
        "storefront_id": "zolexora-shop",
        "is_active": True,
    })

    response = await admin_delete_product("prod-789", u={"id": "admin-1", "role": "admin"}, context=dummy_context, db=db)

    assert response == {"message": "Deleted"}
    assert await db.storefront_listings.find_one({"id": "prod-789"}) is None


@pytest.mark.asyncio
async def test_admin_delete_via_admin_route_missing_returns_404():
    db = FakeDB()

    with pytest.raises(HTTPException) as exc:
        await admin_delete_product("non-existent", u={"id": "admin-1", "role": "admin"}, context=dummy_context, db=db)

    assert exc.value.status_code == 404
    assert "Product not found" in exc.value.detail
