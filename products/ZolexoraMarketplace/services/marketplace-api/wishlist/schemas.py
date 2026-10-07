from typing import Optional, List
from uuid import UUID
from pydantic import Field
from models.base import APIModel
from models.primitives import UTCDateTime

class WishlistItemBase(APIModel):
    storefront_listing_id: UUID

class WishlistItemCreate(WishlistItemBase):
    pass

class WishlistItemResponse(WishlistItemBase):
    id: UUID
    wishlist_id: UUID
    added_at: UTCDateTime
    created_at: UTCDateTime
    updated_at: UTCDateTime

class WishlistBase(APIModel):
    name: str = Field(default="My Wishlist", max_length=200)

class WishlistCreate(WishlistBase):
    pass

class WishlistResponse(WishlistBase):
    id: UUID
    storefront_id: UUID
    buyer_id: Optional[UUID] = None
    anonymous_key: Optional[str] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
    items: Optional[List[WishlistItemResponse]] = None
