from uuid import UUID
from typing import Optional
from fastapi import HTTPException
from .schemas import WishlistResponse, WishlistItemResponse
from .repository import WishlistRepository

class WishlistService:
    def __init__(self, repository: WishlistRepository):
        self.repository = repository

    async def get_wishlist(self, storefront_id: UUID, buyer_id: Optional[UUID] = None, anonymous_key: Optional[str] = None) -> WishlistResponse:
        if not buyer_id and not anonymous_key:
            raise HTTPException(status_code=400, detail="Must provide buyer_id or anonymous_key")
        if buyer_id and anonymous_key:
            raise HTTPException(status_code=400, detail="Cannot provide both buyer_id and anonymous_key")
            
        wl_row = await self.repository.get_or_create_wishlist(storefront_id, buyer_id, anonymous_key)
        items = await self.repository.get_items(wl_row["id"])
        
        response = WishlistResponse(**wl_row)
        response.items = [WishlistItemResponse(**item) for item in items]
        return response

    async def add_item(self, storefront_id: UUID, storefront_listing_id: UUID, buyer_id: Optional[UUID] = None, anonymous_key: Optional[str] = None) -> WishlistResponse:
        wl_row = await self.repository.get_or_create_wishlist(storefront_id, buyer_id, anonymous_key)
        await self.repository.add_item(wl_row["id"], storefront_listing_id)
        return await self.get_wishlist(storefront_id, buyer_id, anonymous_key)

    async def remove_item(self, storefront_id: UUID, item_id: UUID, buyer_id: Optional[UUID] = None, anonymous_key: Optional[str] = None) -> WishlistResponse:
        wl_row = await self.repository.get_or_create_wishlist(storefront_id, buyer_id, anonymous_key)
        await self.repository.remove_item(wl_row["id"], item_id)
        return await self.get_wishlist(storefront_id, buyer_id, anonymous_key)
