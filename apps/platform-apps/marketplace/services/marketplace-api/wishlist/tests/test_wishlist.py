import pytest
from uuid import uuid4
from unittest.mock import AsyncMock
from fastapi import HTTPException
from wishlist.service import WishlistService
from wishlist.repository import WishlistRepository
from datetime import datetime, timezone

@pytest.fixture
def repo():
    return AsyncMock(spec=WishlistRepository)

@pytest.fixture
def service(repo):
    return WishlistService(repository=repo)

@pytest.mark.asyncio
async def test_get_wishlist_validation(service, repo):
    storefront_id = uuid4()
    
    # Neither provided
    with pytest.raises(HTTPException) as exc:
        await service.get_wishlist(storefront_id)
    assert exc.value.status_code == 400
    
    # Both provided
    with pytest.raises(HTTPException) as exc:
        await service.get_wishlist(storefront_id, buyer_id=uuid4(), anonymous_key="anon")
    assert exc.value.status_code == 400

@pytest.mark.asyncio
async def test_add_item(service, repo):
    storefront_id = uuid4()
    buyer_id = uuid4()
    listing_id = uuid4()
    wishlist_id = uuid4()
    
    repo.get_or_create_wishlist.return_value = {
        "id": wishlist_id,
        "storefront_id": storefront_id,
        "buyer_id": buyer_id,
        "anonymous_key": None,
        "name": "My Wishlist",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    repo.get_items.return_value = []
    
    await service.add_item(storefront_id, listing_id, buyer_id=buyer_id)
    
    repo.get_or_create_wishlist.assert_called_with(storefront_id, buyer_id, None)
    repo.add_item.assert_called_once_with(wishlist_id, listing_id)
