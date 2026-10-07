import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, ConfigDict


class CartItemBase(BaseModel):
    storefront_listing_id: uuid.UUID
    quantity: Annotated[int, Field(ge=1)]

class CartItemCreate(CartItemBase):
    pass

class CartItemUpdate(BaseModel):
    quantity: Annotated[int, Field(ge=1)]

class CartItemResponse(CartItemBase):
    id: uuid.UUID
    cart_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CartBase(BaseModel):
    currency: str

class CartCreate(CartBase):
    storefront_id: uuid.UUID
    buyer_id: uuid.UUID | None = None
    anonymous_key: str | None = None

class CartResponse(CartBase):
    id: uuid.UUID
    storefront_id: uuid.UUID
    buyer_id: uuid.UUID | None
    anonymous_key: str | None
    status: str
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime
    items: list[CartItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

class CartMergeRequest(BaseModel):
    anonymous_key: str
