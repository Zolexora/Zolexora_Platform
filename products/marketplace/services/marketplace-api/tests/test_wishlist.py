import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from core.deps import current_user, db_dep
from storefronts.dependencies import require_storefront_context
from storefronts.models import StorefrontContext, StorefrontDefinition, StorefrontKey, StorefrontContextSource
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_wishlist_endpoints():
    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[
        {"product_id": "prod_1", "created_at": "2026-08-18T16:00:00Z"}
    ])
    mock_db.wishlist.find = MagicMock(return_value=mock_cursor)
    
    mock_products_cursor = MagicMock()
    mock_products_cursor.to_list = AsyncMock(return_value=[
        {"id": "prod_1", "title": "Silk Saree", "price": 1999}
    ])
    mock_db.products.find = MagicMock(return_value=mock_products_cursor)
    mock_db.wishlist.find_one = AsyncMock(return_value=None)
    mock_db.wishlist.insert_one = AsyncMock(return_value=AsyncMock(inserted_id="w_1"))
    mock_db.wishlist.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

    fake_user = {
        "id": "0bc66f05-dea8-4e44-85c1-78c7e266dd24",
        "email": "test@mahilamadel.store",
        "role": "buyer"
    }

    definition = StorefrontDefinition(
        id="sf_mm_123",
        key=StorefrontKey.MAHILA_MADEL,
        display_name="Mahila Madel",
        canonical_host="mahilamadel.store",
        hosts=frozenset(["mahilamadel.store"]),
        origins=frozenset(["https://mahilamadel.store"])
    )

    fake_sf_ctx = StorefrontContext(
        storefront=definition,
        source=StorefrontContextSource.CLIENT_HINT,
    )

    app.dependency_overrides[current_user] = lambda: fake_user
    app.dependency_overrides[db_dep] = lambda: mock_db
    app.dependency_overrides[require_storefront_context] = lambda: fake_sf_ctx

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. GET /api/wishlist
            res = await client.get("/api/wishlist")
            assert res.status_code == 200
            data = res.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["title"] == "Silk Saree"

            # 2. POST /api/wishlist/prod_1 (Toggle on)
            res = await client.post("/api/wishlist/prod_1")
            assert res.status_code == 200
            data = res.json()
            assert data["added"] is True
            assert data["product_id"] == "prod_1"

            # 3. DELETE /api/wishlist/prod_1
            res = await client.delete("/api/wishlist/prod_1")
            assert res.status_code == 200
            assert res.json()["success"] is True
    finally:
        app.dependency_overrides.pop(current_user, None)
        app.dependency_overrides.pop(db_dep, None)
        app.dependency_overrides.pop(require_storefront_context, None)
