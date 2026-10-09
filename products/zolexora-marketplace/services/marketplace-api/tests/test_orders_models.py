"""
Unit tests for canonical order models defined in services/marketplace-api/models/orders.py.
"""

from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from models import (
    Money,
    OrderStatus,
    FulfillmentStatus,
    PaymentStatus,
    CancellationStatus,
    ReturnStatus,
    ShippingAddress,
    OrderLineSnapshot,
    CreateOrderFromQuoteRequest,
    CreateOrderFromQuoteResponse,
    ShipmentResponse,
    ReturnResponse,
    BuyerOrderSummaryResponse,
    BuyerOrderResponse,
    SellerOrderSummaryResponse,
    SellerOrderResponse,
    AdminOrderResponse,
)
from storefronts.models import StorefrontKey


def test_order_enums():
    assert OrderStatus.placed == "placed"
    assert FulfillmentStatus.shipped == "shipped"
    assert PaymentStatus.paid == "paid"
    assert CancellationStatus.requested == "requested"
    assert ReturnStatus.refund_issued == "refund_issued"


def test_shipping_address():
    addr = ShippingAddress(
        full_name="Jane Doe",
        phone="+919876543210",
        address_line1="123 Main St",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
    )
    assert addr.country == "IN"
    assert addr.full_name == "Jane Doe"


def test_order_line_snapshot():

    line = OrderLineSnapshot(
        listing_id="list-123",
        master_product_id="prod-456",
        seller_id="seller-789",
        seller_name="Artisan Crafts",
        title="Handmade Silk Scarf",
        unit_price=Money(amount_minor=150000, currency="INR"),
        quantity=2,
        subtotal=Money(amount_minor=300000, currency="INR"),
    )
    assert line.quantity == 2
    assert line.subtotal.amount_minor == 300000
    assert line.fulfillment_status == FulfillmentStatus.unfulfilled


def test_order_creation_models():
    now = datetime.now(timezone.utc)
    req = CreateOrderFromQuoteRequest(
        quote_id="quote-token-xyz",
        shipping_address=ShippingAddress(
            full_name="Jane Doe",
            phone="+919876543210",
            address_line1="123 Main St",
            city="Bengaluru",
            state="Karnataka",
            postal_code="560001",
        ),
        payment_method_type="card",
        idempotency_key="idemp-001",
    )
    assert req.quote_id == "quote-token-xyz"

    resp = CreateOrderFromQuoteResponse(
        order_id="ord-001",
        order_number="ORD-2026-0001",
        storefront_id=StorefrontKey.ZOLEXORA_SHOP,
        buyer_id="buyer-100",
        status=OrderStatus.placed,
        payment_status=PaymentStatus.pending,
        grand_total=Money(amount_minor=300000, currency="INR"),
        created_at=now,
    )
    assert resp.storefront_id == StorefrontKey.ZOLEXORA_SHOP
    assert resp.status == OrderStatus.placed


def test_fulfillment_and_shipment_models():
    now = datetime.now(timezone.utc)
    shipment = ShipmentResponse(
        shipment_id="ship-1",
        order_id="ord-001",
        storefront_id=StorefrontKey.MAHILA_MADEL,
        seller_id="seller-789",
        seller_name="Mahila Collective",
        carrier_name="BlueDart",
        tracking_number="BD123456789",
        status=FulfillmentStatus.shipped,
        line_item_ids=["line-1", "line-2"],
        shipped_at=now,
        created_at=now,
        updated_at=now,
    )
    assert shipment.status == FulfillmentStatus.shipped
    assert len(shipment.line_item_ids) == 2


def test_buyer_seller_admin_views():
    now = datetime.now(timezone.utc)
    addr = ShippingAddress(
        full_name="Jane Doe",
        phone="+919876543210",
        address_line1="123 Main St",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
    )
    line = OrderLineSnapshot(
        listing_id="list-123",
        master_product_id="prod-456",
        seller_id="seller-789",
        seller_name="Artisan Crafts",
        title="Handmade Silk Scarf",
        unit_price=Money(amount_minor=150000, currency="INR"),
        quantity=2,
        subtotal=Money(amount_minor=300000, currency="INR"),
    )

    buyer_resp = BuyerOrderResponse(
        order_id="ord-001",
        order_number="ORD-2026-0001",
        storefront_id=StorefrontKey.ZOLEXORA_SHOP,
        buyer_id="buyer-100",
        status=OrderStatus.placed,
        payment_status=PaymentStatus.paid,
        fulfillment_status=FulfillmentStatus.processing,
        currency="INR",
        lines=[line],
        shipping_address=addr,
        item_subtotal=Money(amount_minor=300000, currency="INR"),
        shipping_total=Money(amount_minor=5000, currency="INR"),
        tax_total=Money(amount_minor=14100, currency="INR"),
        discount_total=Money(amount_minor=0, currency="INR"),
        grand_total=Money(amount_minor=323000, currency="INR"),
        created_at=now,
        updated_at=now,
    )
    assert buyer_resp.grand_total.amount_minor == 323000

    seller_resp = SellerOrderResponse(
        order_id="ord-001",
        order_number="ORD-2026-0001",
        storefront_id=StorefrontKey.ZOLEXORA_SHOP,
        seller_id="seller-789",
        buyer_id="buyer-100",
        status=OrderStatus.placed,
        payment_status=PaymentStatus.paid,
        seller_fulfillment_status=FulfillmentStatus.processing,
        currency="INR",
        lines=[line],
        shipping_address=addr,
        seller_subtotal=Money(amount_minor=300000, currency="INR"),
        created_at=now,
        updated_at=now,
    )
    assert seller_resp.seller_subtotal.amount_minor == 300000

    admin_resp = AdminOrderResponse(
        order_id="ord-001",
        order_number="ORD-2026-0001",
        storefront_id=StorefrontKey.ZOLEXORA_SHOP,
        buyer_id="buyer-100",
        seller_ids=["seller-789"],
        status=OrderStatus.placed,
        payment_status=PaymentStatus.paid,
        fulfillment_status=FulfillmentStatus.processing,
        currency="INR",
        lines=[line],
        shipping_address=addr,
        item_subtotal=Money(amount_minor=300000, currency="INR"),
        shipping_total=Money(amount_minor=5000, currency="INR"),
        tax_total=Money(amount_minor=14100, currency="INR"),
        discount_total=Money(amount_minor=0, currency="INR"),
        grand_total=Money(amount_minor=323000, currency="INR"),
        created_at=now,
        updated_at=now,
    )
    assert admin_resp.seller_ids == ["seller-789"]


def test_return_response_quantity_validation():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        ReturnResponse(
            return_id="ret-1",
            order_id="ord-1",
            storefront_id=StorefrontKey.ZOLEXORA_SHOP,
            buyer_id="buyer-1",
            seller_id="seller-1",
            line_item_id="line-1",
            quantity=0,
            status=ReturnStatus.requested,
            reason="Defective item",
            created_at=now,
            updated_at=now,
        )


def test_buyer_order_summary_item_count_validation():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        BuyerOrderSummaryResponse(
            order_id="ord-1",
            order_number="ORD-001",
            storefront_id=StorefrontKey.ZOLEXORA_SHOP,
            status=OrderStatus.placed,
            payment_status=PaymentStatus.paid,
            fulfillment_status=FulfillmentStatus.processing,
            currency="INR",
            item_count=-1,
            grand_total=Money(amount_minor=1000, currency="INR"),
            created_at=now,
        )


def test_seller_order_summary_item_count_validation():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        SellerOrderSummaryResponse(
            order_id="ord-1",
            order_number="ORD-001",
            storefront_id=StorefrontKey.ZOLEXORA_SHOP,
            seller_id="seller-1",
            status=OrderStatus.placed,
            seller_fulfillment_status=FulfillmentStatus.processing,
            currency="INR",
            seller_item_count=-5,
            seller_subtotal=Money(amount_minor=1000, currency="INR"),
            created_at=now,
        )


def test_order_line_snapshot_arithmetic_and_currency_validation():
    with pytest.raises(ValidationError, match="Line subtotal amount"):
        OrderLineSnapshot(
            listing_id="list-123",
            master_product_id="prod-456",
            seller_id="seller-789",
            seller_name="Artisan Crafts",
            title="Handmade Silk Scarf",
            unit_price=Money(amount_minor=1000, currency="INR"),
            quantity=5,
            subtotal=Money(amount_minor=100, currency="INR"),
        )

    with pytest.raises(ValidationError, match="Line subtotal currency"):
        OrderLineSnapshot(
            listing_id="list-123",
            master_product_id="prod-456",
            seller_id="seller-789",
            seller_name="Artisan Crafts",
            title="Handmade Silk Scarf",
            unit_price=Money(amount_minor=1000, currency="INR"),
            quantity=5,
            subtotal=Money(amount_minor=5000, currency="USD"),
        )


def test_order_response_arithmetic_and_currency_validation():
    now = datetime.now(timezone.utc)
    addr = ShippingAddress(
        full_name="Jane Doe",
        phone="+919876543210",
        address_line1="123 Main St",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
    )
    line = OrderLineSnapshot(
        listing_id="list-123",
        master_product_id="prod-456",
        seller_id="seller-789",
        seller_name="Artisan Crafts",
        title="Handmade Silk Scarf",
        unit_price=Money(amount_minor=150000, currency="INR"),
        quantity=2,
        subtotal=Money(amount_minor=300000, currency="INR"),
    )

    # Invalid grand total arithmetic
    with pytest.raises(ValidationError, match="grand_total amount"):
        BuyerOrderResponse(
            order_id="ord-001",
            order_number="ORD-2026-0001",
            storefront_id=StorefrontKey.ZOLEXORA_SHOP,
            buyer_id="buyer-100",
            status=OrderStatus.placed,
            payment_status=PaymentStatus.paid,
            fulfillment_status=FulfillmentStatus.processing,
            currency="INR",
            lines=[line],
            shipping_address=addr,
            item_subtotal=Money(amount_minor=300000, currency="INR"),
            shipping_total=Money(amount_minor=5000, currency="INR"),
            tax_total=Money(amount_minor=14100, currency="INR"),
            discount_total=Money(amount_minor=0, currency="INR"),
            grand_total=Money(amount_minor=999999, currency="INR"),
            created_at=now,
            updated_at=now,
        )

    # Multi-currency mismatch in grand_total
    with pytest.raises(ValidationError, match="currency"):
        BuyerOrderResponse(
            order_id="ord-001",
            order_number="ORD-2026-0001",
            storefront_id=StorefrontKey.ZOLEXORA_SHOP,
            buyer_id="buyer-100",
            status=OrderStatus.placed,
            payment_status=PaymentStatus.paid,
            fulfillment_status=FulfillmentStatus.processing,
            currency="INR",
            lines=[line],
            shipping_address=addr,
            item_subtotal=Money(amount_minor=300000, currency="INR"),
            shipping_total=Money(amount_minor=5000, currency="INR"),
            tax_total=Money(amount_minor=14100, currency="INR"),
            discount_total=Money(amount_minor=0, currency="INR"),
            grand_total=Money(amount_minor=323000, currency="USD"),
            created_at=now,
            updated_at=now,
        )

    # Item subtotal mismatch with line items sum
    with pytest.raises(ValidationError, match="item_subtotal amount"):
        AdminOrderResponse(
            order_id="ord-001",
            order_number="ORD-2026-0001",
            storefront_id=StorefrontKey.ZOLEXORA_SHOP,
            buyer_id="buyer-100",
            seller_ids=["seller-789"],
            status=OrderStatus.placed,
            payment_status=PaymentStatus.paid,
            fulfillment_status=FulfillmentStatus.processing,
            currency="INR",
            lines=[line],
            shipping_address=addr,
            item_subtotal=Money(amount_minor=100000, currency="INR"), # should be 300000
            shipping_total=Money(amount_minor=5000, currency="INR"),
            tax_total=Money(amount_minor=14100, currency="INR"),
            discount_total=Money(amount_minor=0, currency="INR"),
            grand_total=Money(amount_minor=123000, currency="INR"),
            created_at=now,
            updated_at=now,
        )

