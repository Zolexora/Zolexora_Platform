from enum import StrEnum
from typing import Annotated

from pydantic import ConfigDict, Field, StrictInt, StringConstraints, model_validator

from models.base import APIModel
from models.primitives import MAX_SAFE_INTEGER, EntityId, Money, UTCDateTime
from storefronts.models import StorefrontKey


MAX_INVENTORY_QUANTITY = MAX_SAFE_INTEGER
InventoryQuantity = Annotated[
    StrictInt,
    Field(ge=0, le=MAX_INVENTORY_QUANTITY, description="Inventory quantity"),
]
ListingTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ListingDescription = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5_000)]
ImageReference = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2_048)]


class ListingStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class SellerListingLifecycleAction(StrEnum):
    PAUSE = "pause"
    RESUME = "resume"
    ARCHIVE = "archive"


class ListingModerationAction(StrEnum):
    APPROVE = "approve"
    REJECT = "reject"


class SellerListingCreate(APIModel):
    model_config = ConfigDict(extra="forbid")

    product_id: EntityId
    price: Money
    compare_at_price: Money | None = None
    title_override: ListingTitle | None = None
    description_override: ListingDescription | None = None
    images_override: list[ImageReference] | None = Field(default=None, max_length=10)

    @model_validator(mode="after")
    def validate_prices(self):
        if self.compare_at_price:
            if self.compare_at_price.currency != self.price.currency:
                raise ValueError("Listing prices must use one currency")
            if self.compare_at_price.amount_minor < self.price.amount_minor:
                raise ValueError("Compare-at price cannot be less than listing price")
        return self


class SellerListingUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    price: Money | None = None
    compare_at_price: Money | None = None
    title_override: ListingTitle | None = None
    description_override: ListingDescription | None = None
    images_override: list[ImageReference] | None = Field(default=None, max_length=10)

    @model_validator(mode="after")
    def require_update(self):
        if not self.model_fields_set:
            raise ValueError("At least one seller-editable field is required")
        return self


class SellerInventoryUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    quantity: InventoryQuantity


class SellerListingLifecycleRequest(APIModel):
    model_config = ConfigDict(extra="forbid")

    action: SellerListingLifecycleAction


class AdminListingModerationRequest(APIModel):
    model_config = ConfigDict(extra="forbid")

    action: ListingModerationAction
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)] | None = None

    @model_validator(mode="after")
    def require_rejection_reason(self):
        if self.action == ListingModerationAction.REJECT and not self.reason:
            raise ValueError("A reason is required when rejecting a listing")
        return self


class SellerListingSummary(APIModel):
    id: EntityId
    storefront_id: StorefrontKey
    product_id: EntityId
    seller_id: EntityId
    title: str
    price: Money
    status: ListingStatus
    available_quantity: InventoryQuantity
    created_at: UTCDateTime
    updated_at: UTCDateTime


class AdminListingSummary(SellerListingSummary):
    seller_name: str


class SellerListingResponse(SellerListingSummary):
    description: str
    compare_at_price: Money | None = None
    title_override: str | None = None
    description_override: str | None = None
    images_override: list[str] | None = None
    moderation_reason: str | None = None


class AdminListingResponse(SellerListingResponse):
    seller_name: str


class SellerListingPage(APIModel):
    items: list[SellerListingSummary]
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)


class AdminListingPage(APIModel):
    items: list[AdminListingSummary]
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)


class SellerInventoryResponse(APIModel):
    storefront_id: StorefrontKey
    listing_id: EntityId
    product_id: EntityId
    on_hand_quantity: InventoryQuantity
    reserved_quantity: InventoryQuantity
    available_quantity: InventoryQuantity
    updated_at: UTCDateTime


class AdminInventoryResponse(SellerInventoryResponse):
    seller_id: EntityId
