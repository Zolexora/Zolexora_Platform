"""
Order contract models for Zolexora Marketplace.
Standardized for MR-01E / ADR 0013.
"""

from enum import Enum
from typing import Optional, List, Literal
import uuid

from pydantic import Field, StrictInt, model_validator

from .base import APIModel
from .primitives import EntityId, Money, UTCDateTime
from storefronts.models import StorefrontKey


# ── Status Enums ──

class OrderStatus(str, Enum):
    draft = "draft"
    placed = "placed"
    payment_pending = "payment_pending"
    paid = "paid"
    processing = "processing"
    partially_fulfilled = "partially_fulfilled"
    fulfilled = "fulfilled"
    completed = "completed"
    cancelled = "cancelled"
    partially_cancelled = "partially_cancelled"
    returned = "returned"
    partially_returned = "partially_returned"


class FulfillmentStatus(str, Enum):
    unfulfilled = "unfulfilled"
    allocated = "allocated"
    processing = "processing"
    shipped = "shipped"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    failed_delivery = "failed_delivery"
    returned_to_origin = "returned_to_origin"
    cancelled = "cancelled"


class PaymentStatus(str, Enum):
    pending = "pending"
    awaiting_verification = "awaiting_verification"
    authorized = "authorized"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"
    partially_refunded = "partially_refunded"
    voided = "voided"


class CancellationStatus(str, Enum):
    none = "none"
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    completed = "completed"


class ReturnStatus(str, Enum):
    none = "none"
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    item_shipped = "item_shipped"
    item_received = "item_received"
    inspected = "inspected"
    refund_issued = "refund_issued"
    completed = "completed"


# ── Address Snapshot & Line Item Snapshot ──

class ShippingAddress(APIModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=7, max_length=20)
    email: Optional[str] = None
    address_line1: str = Field(..., min_length=1, max_length=255)
    address_line2: Optional[str] = None
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    postal_code: str = Field(..., min_length=3, max_length=20)
    country: str = Field(default="IN", min_length=2, max_length=2)


class OrderLineSnapshot(APIModel):
    line_id: EntityId = Field(default_factory=lambda: str(uuid.uuid4()))
    listing_id: EntityId
    master_product_id: EntityId
    seller_id: EntityId
    seller_name: str
    title: str
    image_url: Optional[str] = None
    unit_price: Money
    quantity: StrictInt = Field(..., gt=0)
    subtotal: Money
    tax_total: Optional[Money] = None
    discount_total: Optional[Money] = None
    fulfillment_status: FulfillmentStatus = FulfillmentStatus.unfulfilled
    cancellation_status: CancellationStatus = CancellationStatus.none
    return_status: ReturnStatus = ReturnStatus.none

    @model_validator(mode="before")
    @classmethod
    def inject_legacy_fields(cls, data: any) -> any:
        if isinstance(data, dict):
            if "listing_id" not in data and "product_id" in data:
                data["listing_id"] = data["product_id"]
            if "master_product_id" not in data and "product_id" in data:
                data["master_product_id"] = data["product_id"]
            if "title" not in data:
                data["title"] = data.get("product_title", "Unknown Product")
        return data

    @model_validator(mode="after")
    def validate_line_snapshot_integrity(self) -> "OrderLineSnapshot":
        if self.subtotal.currency != self.unit_price.currency:
            raise ValueError(
                f"Line subtotal currency ({self.subtotal.currency}) must match unit_price currency ({self.unit_price.currency})"
            )
        expected_subtotal = self.unit_price.amount_minor * self.quantity
        if self.subtotal.amount_minor != expected_subtotal:
            raise ValueError(
                f"Line subtotal amount ({self.subtotal.amount_minor}) does not match unit_price * quantity ({expected_subtotal})"
            )
        if self.tax_total is not None and self.tax_total.currency != self.unit_price.currency:
            raise ValueError(
                f"Line tax_total currency ({self.tax_total.currency}) must match unit_price currency ({self.unit_price.currency})"
            )
        if self.discount_total is not None and self.discount_total.currency != self.unit_price.currency:
            raise ValueError(
                f"Line discount_total currency ({self.discount_total.currency}) must match unit_price currency ({self.unit_price.currency})"
            )
        return self


# ── Order Creation Schemas ──

class CreateOrderFromQuoteRequest(APIModel):
    quote_id: str = Field(..., description="Signed checkout quote token issued by POST /api/cart/checkout/quote")
    shipping_address: ShippingAddress
    payment_method_type: str = Field(..., description="Payment method choice (card, upi, net_banking, cash_on_delivery)")
    idempotency_key: Optional[str] = Field(None, max_length=128, description="Client-provided idempotency key")


class CreateOrderFromQuoteResponse(APIModel):
    order_id: EntityId
    order_number: str
    storefront_id: StorefrontKey
    buyer_id: EntityId
    status: OrderStatus
    payment_status: PaymentStatus
    grand_total: Money
    created_at: UTCDateTime
    expires_at: Optional[UTCDateTime] = None


# ── Fulfillment & Shipment Schemas ──

class ShipmentEventResponse(APIModel):
    event_id: EntityId = Field(default_factory=lambda: str(uuid.uuid4()))
    status: FulfillmentStatus
    location: Optional[str] = None
    description: str
    timestamp: UTCDateTime


class ShipmentResponse(APIModel):
    shipment_id: EntityId
    order_id: EntityId
    storefront_id: StorefrontKey
    seller_id: EntityId
    seller_name: str
    carrier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    status: FulfillmentStatus
    line_item_ids: List[EntityId]
    shipped_at: Optional[UTCDateTime] = None
    delivered_at: Optional[UTCDateTime] = None
    events: List[ShipmentEventResponse] = Field(default_factory=list)
    created_at: UTCDateTime
    updated_at: UTCDateTime


class FulfillmentTransitionRequest(APIModel):
    target_status: FulfillmentStatus
    carrier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    notes: Optional[str] = None


# ── Cancellation & Return Schemas ──

class CancellationRequest(APIModel):
    reason: str = Field(..., min_length=3, max_length=500)
    line_item_ids: Optional[List[EntityId]] = Field(None, description="Specific line items to cancel. None or empty requests full order cancellation.")


class CancellationResponse(APIModel):
    cancellation_id: EntityId
    order_id: EntityId
    storefront_id: StorefrontKey
    requested_by: EntityId
    requester_role: Literal["buyer", "seller", "admin"]
    status: CancellationStatus
    reason: str
    line_item_ids: List[EntityId]
    seller_comment: Optional[str] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime


class SellerCancellationActionRequest(APIModel):
    action: Literal["approve", "reject"]
    comment: Optional[str] = Field(None, max_length=500)


class ReturnRequest(APIModel):
    line_item_id: EntityId
    quantity: StrictInt = Field(..., gt=0)
    reason: str = Field(..., min_length=3, max_length=500)
    images: List[str] = Field(default_factory=list, description="Proof images for return request")


class ReturnResponse(APIModel):
    return_id: EntityId
    order_id: EntityId
    storefront_id: StorefrontKey
    buyer_id: EntityId
    seller_id: EntityId
    line_item_id: EntityId
    quantity: StrictInt = Field(..., gt=0)
    status: ReturnStatus
    reason: str
    proof_images: List[str] = Field(default_factory=list)
    seller_comment: Optional[str] = None
    refund_amount: Optional[Money] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime


class SellerReturnActionRequest(APIModel):
    action: Literal["approve", "reject", "mark_received"]
    comment: Optional[str] = Field(None, max_length=500)


# ── Role-Based Order Views (Buyer, Seller, Admin) ──

class BuyerOrderSummaryResponse(APIModel):
    order_id: EntityId
    order_number: str
    storefront_id: StorefrontKey
    status: OrderStatus
    payment_status: PaymentStatus
    fulfillment_status: FulfillmentStatus
    currency: str
    item_count: StrictInt = Field(..., ge=0)
    grand_total: Money
    created_at: UTCDateTime

    @model_validator(mode="after")
    def validate_currency(self) -> "BuyerOrderSummaryResponse":
        if self.grand_total.currency != self.currency:
            raise ValueError(
                f"grand_total currency ({self.grand_total.currency}) must match order currency ({self.currency})"
            )
        return self


class BuyerOrderResponse(APIModel):
    order_id: EntityId
    order_number: str
    storefront_id: StorefrontKey
    buyer_id: EntityId
    status: OrderStatus
    payment_status: PaymentStatus
    fulfillment_status: FulfillmentStatus
    currency: str
    lines: List[OrderLineSnapshot]
    shipping_address: ShippingAddress
    item_subtotal: Money
    shipping_total: Money
    tax_total: Money
    discount_total: Money
    grand_total: Money
    shipments: List[ShipmentResponse] = Field(default_factory=list)
    cancellations: List[CancellationResponse] = Field(default_factory=list)
    returns: List[ReturnResponse] = Field(default_factory=list)
    created_at: UTCDateTime
    updated_at: UTCDateTime

    @model_validator(mode="after")
    def validate_financial_integrity(self) -> "BuyerOrderResponse":
        money_fields = {
            "item_subtotal": self.item_subtotal,
            "shipping_total": self.shipping_total,
            "tax_total": self.tax_total,
            "discount_total": self.discount_total,
            "grand_total": self.grand_total,
        }
        for field_name, money_val in money_fields.items():
            if money_val.currency != self.currency:
                raise ValueError(
                    f"{field_name} currency ({money_val.currency}) must match order currency ({self.currency})"
                )

        for idx, line in enumerate(self.lines):
            if line.unit_price.currency != self.currency or line.subtotal.currency != self.currency:
                raise ValueError(
                    f"Line {idx} currency does not match order currency ({self.currency})"
                )

        if self.lines:
            computed_subtotal = sum(line.subtotal.amount_minor for line in self.lines)
            if self.item_subtotal.amount_minor != computed_subtotal:
                raise ValueError(
                    f"item_subtotal amount ({self.item_subtotal.amount_minor}) does not match sum of line subtotals ({computed_subtotal})"
                )

        expected_grand_total = (
            self.item_subtotal.amount_minor
            + self.shipping_total.amount_minor
            + self.tax_total.amount_minor
            - self.discount_total.amount_minor
        )
        if self.grand_total.amount_minor != expected_grand_total:
            raise ValueError(
                f"grand_total amount ({self.grand_total.amount_minor}) does not match item_subtotal + shipping_total + tax_total - discount_total ({expected_grand_total})"
            )

        return self


class SellerOrderSummaryResponse(APIModel):
    order_id: EntityId
    order_number: str
    storefront_id: StorefrontKey
    buyer_name: Optional[str] = None
    seller_id: EntityId
    status: OrderStatus
    seller_fulfillment_status: FulfillmentStatus
    currency: str
    seller_item_count: StrictInt = Field(..., ge=0)
    seller_subtotal: Money
    created_at: UTCDateTime

    @model_validator(mode="after")
    def validate_currency(self) -> "SellerOrderSummaryResponse":
        if self.seller_subtotal.currency != self.currency:
            raise ValueError(
                f"seller_subtotal currency ({self.seller_subtotal.currency}) must match order currency ({self.currency})"
            )
        return self


class SellerOrderResponse(APIModel):
    order_id: EntityId
    order_number: str
    storefront_id: StorefrontKey
    seller_id: EntityId
    buyer_id: EntityId
    buyer_name: Optional[str] = None
    status: OrderStatus
    payment_status: PaymentStatus
    seller_fulfillment_status: FulfillmentStatus
    currency: str
    lines: List[OrderLineSnapshot]
    shipping_address: ShippingAddress
    seller_subtotal: Money
    seller_tax_total: Optional[Money] = None
    seller_shipments: List[ShipmentResponse] = Field(default_factory=list)
    seller_cancellations: List[CancellationResponse] = Field(default_factory=list)
    seller_returns: List[ReturnResponse] = Field(default_factory=list)
    created_at: UTCDateTime
    updated_at: UTCDateTime

    @model_validator(mode="after")
    def validate_seller_financial_integrity(self) -> "SellerOrderResponse":
        if self.seller_subtotal.currency != self.currency:
            raise ValueError(
                f"seller_subtotal currency ({self.seller_subtotal.currency}) must match order currency ({self.currency})"
            )
        if self.seller_tax_total is not None and self.seller_tax_total.currency != self.currency:
            raise ValueError(
                f"seller_tax_total currency ({self.seller_tax_total.currency}) must match order currency ({self.currency})"
            )

        for idx, line in enumerate(self.lines):
            if line.unit_price.currency != self.currency or line.subtotal.currency != self.currency:
                raise ValueError(
                    f"Line {idx} currency does not match order currency ({self.currency})"
                )

        if self.lines:
            computed_seller_subtotal = sum(line.subtotal.amount_minor for line in self.lines)
            if self.seller_subtotal.amount_minor != computed_seller_subtotal:
                raise ValueError(
                    f"seller_subtotal amount ({self.seller_subtotal.amount_minor}) does not match sum of line subtotals ({computed_seller_subtotal})"
                )

        return self


class AdminOrderSummaryResponse(APIModel):
    order_id: EntityId
    order_number: str
    storefront_id: StorefrontKey
    buyer_id: EntityId
    seller_ids: List[EntityId]
    status: OrderStatus
    payment_status: PaymentStatus
    fulfillment_status: FulfillmentStatus
    currency: str
    grand_total: Money
    created_at: UTCDateTime

    @model_validator(mode="after")
    def validate_currency(self) -> "AdminOrderSummaryResponse":
        if self.grand_total.currency != self.currency:
            raise ValueError(
                f"grand_total currency ({self.grand_total.currency}) must match order currency ({self.currency})"
            )
        return self


class AdminOrderResponse(APIModel):
    order_id: EntityId
    order_number: str
    storefront_id: StorefrontKey
    buyer_id: EntityId
    seller_ids: List[EntityId]
    status: OrderStatus
    payment_status: PaymentStatus
    fulfillment_status: FulfillmentStatus
    currency: str
    lines: List[OrderLineSnapshot]
    shipping_address: ShippingAddress
    item_subtotal: Money
    shipping_total: Money
    tax_total: Money
    discount_total: Money
    grand_total: Money
    shipments: List[ShipmentResponse] = Field(default_factory=list)
    cancellations: List[CancellationResponse] = Field(default_factory=list)
    returns: List[ReturnResponse] = Field(default_factory=list)
    admin_notes: Optional[List[str]] = Field(default_factory=list)
    created_at: UTCDateTime
    updated_at: UTCDateTime

    @model_validator(mode="after")
    def validate_admin_financial_integrity(self) -> "AdminOrderResponse":
        money_fields = {
            "item_subtotal": self.item_subtotal,
            "shipping_total": self.shipping_total,
            "tax_total": self.tax_total,
            "discount_total": self.discount_total,
            "grand_total": self.grand_total,
        }
        for field_name, money_val in money_fields.items():
            if money_val.currency != self.currency:
                raise ValueError(
                    f"{field_name} currency ({money_val.currency}) must match order currency ({self.currency})"
                )

        for idx, line in enumerate(self.lines):
            if line.unit_price.currency != self.currency or line.subtotal.currency != self.currency:
                raise ValueError(
                    f"Line {idx} currency does not match order currency ({self.currency})"
                )

        if self.lines:
            computed_subtotal = sum(line.subtotal.amount_minor for line in self.lines)
            if self.item_subtotal.amount_minor != computed_subtotal:
                raise ValueError(
                    f"item_subtotal amount ({self.item_subtotal.amount_minor}) does not match sum of line subtotals ({computed_subtotal})"
                )

        expected_grand_total = (
            self.item_subtotal.amount_minor
            + self.shipping_total.amount_minor
            + self.tax_total.amount_minor
            - self.discount_total.amount_minor
        )
        if self.grand_total.amount_minor != expected_grand_total:
            raise ValueError(
                f"grand_total amount ({self.grand_total.amount_minor}) does not match item_subtotal + shipping_total + tax_total - discount_total ({expected_grand_total})"
            )

        return self
