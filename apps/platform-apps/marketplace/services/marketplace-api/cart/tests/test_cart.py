import uuid
import pytest
from unittest.mock import AsyncMock
from fastapi import HTTPException

from cart.schemas import CartItemCreate
from cart.service import CartService


@pytest.fixture
def mock_repo():
    return AsyncMock()


@pytest.fixture
def service(mock_repo):
    return CartService(repo=mock_repo)


@pytest.mark.asyncio
async def test_get_or_create_cart_creates_new(service, mock_repo):
    storefront_id = uuid.uuid4()
    buyer_id = uuid.uuid4()
    
    mock_repo.get_active_cart.return_value = None
    mock_repo.create_cart.return_value = {"id": uuid.uuid4(), "storefront_id": storefront_id}
    
    cart = await service.get_or_create_cart(storefront_id, "USD", buyer_id=buyer_id)
    
    mock_repo.create_cart.assert_called_once()
    assert cart["storefront_id"] == storefront_id
    assert cart["items"] == []


@pytest.mark.asyncio
async def test_add_item_wrong_storefront(service, mock_repo):
    storefront_id = uuid.uuid4()
    listing_id = uuid.uuid4()
    
    mock_repo.get_listing.return_value = {
        "id": listing_id,
        "storefront_id": uuid.uuid4(),  # Different storefront
        "publication_state": "PUBLISHED"
    }
    
    item = CartItemCreate(storefront_listing_id=listing_id, quantity=1)
    
    with pytest.raises(HTTPException) as exc:
        await service.add_item_to_cart(storefront_id, "USD", item, buyer_id=uuid.uuid4())
        
    assert exc.value.status_code == 400
    assert "belong to this storefront" in exc.value.detail


@pytest.mark.asyncio
async def test_merge_guest_cart(service, mock_repo):
    storefront_id = uuid.uuid4()
    buyer_id = uuid.uuid4()
    anon_key = "guest123"
    
    guest_cart_id = uuid.uuid4()
    auth_cart_id = uuid.uuid4()
    
    # Guest cart exists and matches storefront
    mock_repo.get_active_cart.side_effect = [
        {"id": guest_cart_id, "storefront_id": storefront_id},  # For guest fetch
        {"id": auth_cart_id, "storefront_id": storefront_id},   # For auth fetch inside get_or_create
        {"id": auth_cart_id, "storefront_id": storefront_id}    # Final get_cart
    ]
    mock_repo.get_cart_items.side_effect = [
        [], # Auth cart items inside get_or_create
        [{"storefront_listing_id": uuid.uuid4(), "quantity": 2}], # Guest items
        [] # Final auth items
    ]
    
    await service.merge_guest_cart(storefront_id, "USD", buyer_id, anon_key)
    
    # Should move item to auth cart
    mock_repo.add_or_update_cart_item.assert_called_once()
    assert mock_repo.add_or_update_cart_item.call_args[1]["cart_id"] == auth_cart_id
    
    # Should deactivate guest cart
    mock_repo.deactivate_cart.assert_called_once_with(guest_cart_id, "converted")


@pytest.mark.asyncio
async def test_merge_guest_cart_wrong_storefront(service, mock_repo):
    storefront_id = uuid.uuid4()
    wrong_storefront_id = uuid.uuid4()
    
    mock_repo.get_active_cart.return_value = {
        "id": uuid.uuid4(), 
        "storefront_id": wrong_storefront_id
    }
    
    with pytest.raises(HTTPException) as exc:
        await service.merge_guest_cart(storefront_id, "USD", uuid.uuid4(), "guest123")
        
    assert exc.value.status_code == 400
    assert "different storefront" in exc.value.detail
