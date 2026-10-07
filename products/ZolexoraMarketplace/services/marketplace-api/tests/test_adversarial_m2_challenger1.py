"""
Adversarial Test Suite for MR-01E M2 by Challenger 1 (Invariants & Security Isolation Challenger).
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from pydantic import SecretStr

from core.config import settings
from models.orders import (
    FulfillmentStatus, CreateOrderFromQuoteRequest, FulfillmentTransitionRequest,
    CancellationRequest, SellerCancellationActionRequest,
    ReturnRequest, SellerReturnActionRequest,
)
from routers.cart import checkout_quote, add_to_cart, CartItemCreate, _generate_quote_token
from routers.orders import (
    create_order_from_quote, list_buyer_orders, get_buyer_order_detail,
    request_buyer_cancellation, request_buyer_return,
    list_seller_orders, get_seller_order_detail,
    transition_seller_shipment, action_seller_cancellation, action_seller_return,
)
from tests.test_orders_fulfillment_contracts import EnhancedFakeDB, create_context, seed_products, shipping_addr

def _create_custom_quote_token(
    quote_id, buyer_id, storefront_id, lines, currency="INR",
    item_subtotal=1000, shipping_total=0, tax_total=0, discount_total=0, grand_total=1000,
    expires_in_minutes=15
):
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=expires_in_minutes)
    quote_data = {
        "storefront_id": storefront_id,
        "currency": currency,
        "lines": lines,
        "item_subtotal": item_subtotal,
        "discount_total": discount_total,
        "shipping_total": shipping_total,
        "tax_total": tax_total,
        "grand_total": grand_total,
        "issued_at": issued_at.isoformat(),
        "expires_at": expires_at.isoformat()
    }
    return _generate_quote_token(buyer_id, quote_data)


ctx_zol = create_context("zolexora-shop")
ctx_mah = create_context("mahila-madel")

buyer_a = {"id": "buyer-a", "role": "viewer", "full_name": "Buyer A"}
buyer_b = {"id": "buyer-b", "role": "viewer", "full_name": "Buyer B"}
seller_x = {"id": "sel-1", "role": "seller", "name": "Seller X"}
seller_y = {"id": "sel-2", "role": "seller", "name": "Seller Y"}
admin_user = {"id": "admin-1", "role": "admin", "full_name": "Admin User"}


@pytest.fixture(autouse=True)
def set_fake_quote_secret(monkeypatch):
    monkeypatch.setattr(settings, "CHECKOUT_QUOTE_SIGNING_SECRET", SecretStr("fake-secret-for-testing-quotes-1234"))


# ─────────────────────────────────────────────────────────────────────────────
# 1. BUYER & STOREFRONT ISOLATION
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_buyer_and_storefront_isolation():
    db = EnhancedFakeDB()
    await seed_products(db)

    # Buyer A creates order in Zolexora Shop
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_a, db=db)
    quote_a = await checkout_quote(context=ctx_zol, user=buyer_a, db=db)
    req_a = CreateOrderFromQuoteRequest(
        quote_id=quote_a.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="card",
        idempotency_key="buyer-iso-1"
    )
    resp_a = await create_order_from_quote(req_a, context=ctx_zol, user=buyer_a, db=db)

    # Attempt 1: Buyer B tries to access Buyer A's order detail under Zolexora Shop
    with pytest.raises(HTTPException) as exc_buyer_b:
        await get_buyer_order_detail(resp_a.order_id, context=ctx_zol, user=buyer_b, db=db)
    assert exc_buyer_b.value.status_code == 404

    # Attempt 2: Buyer A tries to access order using wrong StorefrontContext (Mahila Madel)
    with pytest.raises(HTTPException) as exc_wrong_sf:
        await get_buyer_order_detail(resp_a.order_id, context=ctx_mah, user=buyer_a, db=db)
    assert exc_wrong_sf.value.status_code == 404

    # Attempt 3: Buyer B lists buyer orders under Zolexora Shop (should return empty)
    buyer_b_orders = await list_buyer_orders(context=ctx_zol, user=buyer_b, db=db)
    assert len(buyer_b_orders) == 0

    # Attempt 4: Buyer B tries to request cancellation on Buyer A's order
    with pytest.raises(HTTPException) as exc_cancel_b:
        await request_buyer_cancellation(resp_a.order_id, CancellationRequest(reason="Hacked"), context=ctx_zol, user=buyer_b, db=db)
    assert exc_cancel_b.value.status_code == 404

    # Attempt 5: Buyer B tries to request return on Buyer A's order
    # (Set fulfillment to delivered first so it reaches security check)
    await db.orders.update_one({"id": resp_a.order_id}, {"$set": {"fulfillment_status": "delivered"}})
    order_doc = await db.orders.find_one({"id": resp_a.order_id})
    line_id = order_doc["lines"][0]["line_id"]

    with pytest.raises(HTTPException) as exc_return_b:
        await request_buyer_return(resp_a.order_id, ReturnRequest(line_item_id=line_id, quantity=1, reason="Hacked"), context=ctx_zol, user=buyer_b, db=db)
    assert exc_return_b.value.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 2. SELLER & STOREFRONT ISOLATION
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_seller_and_storefront_isolation():
    db = EnhancedFakeDB()
    await seed_products(db)

    # Buyer A creates order containing item from Seller X (prod-1) in Zolexora Shop
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_a, db=db)
    quote_a = await checkout_quote(context=ctx_zol, user=buyer_a, db=db)
    resp_a = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote_a.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_a, db=db
    )

    # Attempt 1: Seller Y tries to view Seller X's order detail
    with pytest.raises(HTTPException) as exc_seller_y_detail:
        await get_seller_order_detail(resp_a.order_id, context=ctx_zol, user=seller_y, db=db)
    assert exc_seller_y_detail.value.status_code == 404

    # Attempt 2: Seller X tries to view order under wrong StorefrontContext (Mahila Madel)
    with pytest.raises(HTTPException) as exc_seller_x_wrong_sf:
        await get_seller_order_detail(resp_a.order_id, context=ctx_mah, user=seller_x, db=db)
    assert exc_seller_x_wrong_sf.value.status_code == 404

    # Attempt 3: Seller Y lists seller orders under Zolexora Shop (should return empty)
    seller_y_orders = await list_seller_orders(context=ctx_zol, user=seller_y, db=db)
    assert len(seller_y_orders) == 0

    # Attempt 4: Seller Y tries to transition fulfillment of Seller X's shipment
    order_doc = await db.orders.find_one({"id": resp_a.order_id})
    shipment_id = order_doc["shipments"][0]["shipment_id"]

    with pytest.raises(HTTPException) as exc_seller_y_trans:
        await transition_seller_shipment(
            resp_a.order_id, shipment_id,
            FulfillmentTransitionRequest(target_status=FulfillmentStatus.processing),
            context=ctx_zol, user=seller_y, db=db
        )
    assert exc_seller_y_trans.value.status_code == 404

    # Attempt 5: Seller Y tries to action cancellation on Seller X's order
    with pytest.raises(HTTPException) as exc_seller_y_cancel_action:
        await action_seller_cancellation(
            resp_a.order_id,
            SellerCancellationActionRequest(action="approve"),
            context=ctx_zol, user=seller_y, db=db
        )
    assert exc_seller_y_cancel_action.value.status_code == 404

    # Attempt 6: Seller Y tries to action return on Seller X's order
    with pytest.raises(HTTPException) as exc_seller_y_return_action:
        await action_seller_return(
            resp_a.order_id,
            SellerReturnActionRequest(action="approve"),
            context=ctx_zol, user=seller_y, db=db
        )
    assert exc_seller_y_return_action.value.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 3. QUOTE TOKEN FORGERY, EXPIRATION, BUYER & STOREFRONT MISMATCH
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_quote_token_security_and_forgery():
    db = EnhancedFakeDB()
    await seed_products(db)
    lines_data = [{"product_id": "prod-1", "quantity": 1, "unit_price": 1000}]

    # 1. Forged Signature Token (tampered signature string)
    valid_token = _create_custom_quote_token("q-1", "buyer-a", "zolexora-shop", lines_data)
    forged_token = valid_token[:-5] + "XXXXX"

    with pytest.raises(HTTPException) as exc_forged:
        await create_order_from_quote(
            CreateOrderFromQuoteRequest(quote_id=forged_token, shipping_address=shipping_addr, payment_method_type="card"),
            context=ctx_zol, user=buyer_a, db=db
        )
    assert exc_forged.value.status_code == 400
    assert "signature" in exc_forged.value.detail.lower()

    # 2. Expired Token
    expired_token = _create_custom_quote_token("q-exp", "buyer-a", "zolexora-shop", lines_data, expires_in_minutes=-5)
    with pytest.raises(HTTPException) as exc_expired:
        await create_order_from_quote(
            CreateOrderFromQuoteRequest(quote_id=expired_token, shipping_address=shipping_addr, payment_method_type="card"),
            context=ctx_zol, user=buyer_a, db=db
        )
    assert exc_expired.value.status_code == 400
    assert "expired" in exc_expired.value.detail.lower()

    # 3. Token issued to Buyer A, used by Buyer B
    token_buyer_a = _create_custom_quote_token("q-ba", "buyer-a", "zolexora-shop", lines_data)
    with pytest.raises(HTTPException) as exc_buyer_mismatch:
        await create_order_from_quote(
            CreateOrderFromQuoteRequest(quote_id=token_buyer_a, shipping_address=shipping_addr, payment_method_type="card"),
            context=ctx_zol, user=buyer_b, db=db
        )
    assert exc_buyer_mismatch.value.status_code == 403
    assert "belong" in exc_buyer_mismatch.value.detail.lower()

    # 4. Token issued for Zolexora Shop, used in Mahila Madel context
    token_zol = _create_custom_quote_token("q-zol", "buyer-a", "zolexora-shop", lines_data)
    with pytest.raises(HTTPException) as exc_sf_mismatch:
        await create_order_from_quote(
            CreateOrderFromQuoteRequest(quote_id=token_zol, shipping_address=shipping_addr, payment_method_type="card"),
            context=ctx_mah, user=buyer_a, db=db
        )
    assert exc_sf_mismatch.value.status_code == 403
    assert "storefront" in exc_sf_mismatch.value.detail.lower()


# ─────────────────────────────────────────────────────────────────────────────
# 4. ILLEGAL FULFILLMENT STATE MACHINE TRANSITIONS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_illegal_fulfillment_state_machine_jumps():
    db = EnhancedFakeDB()
    await seed_products(db)

    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_a, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_a, db=db)
    resp = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_a, db=db
    )

    order_doc = await db.orders.find_one({"id": resp.order_id})
    shipment_id = order_doc["shipments"][0]["shipment_id"]

    # Initial state: unfulfilled
    # 1. Illegal jump: unfulfilled -> delivered (must pass through allocated/processing -> shipped -> delivered)
    with pytest.raises(HTTPException) as exc_jump1:
        await transition_seller_shipment(
            resp.order_id, shipment_id,
            FulfillmentTransitionRequest(target_status=FulfillmentStatus.delivered),
            context=ctx_zol, user=seller_x, db=db
        )
    assert exc_jump1.value.status_code == 400
    assert "Invalid fulfillment state transition" in exc_jump1.value.detail

    # 2. Valid transition: unfulfilled -> processing
    await transition_seller_shipment(
        resp.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.processing),
        context=ctx_zol, user=seller_x, db=db
    )

    # State: processing
    # 3. Illegal jump: processing -> unfulfilled
    with pytest.raises(HTTPException) as exc_jump2:
        await transition_seller_shipment(
            resp.order_id, shipment_id,
            FulfillmentTransitionRequest(target_status=FulfillmentStatus.unfulfilled),
            context=ctx_zol, user=seller_x, db=db
        )
    assert exc_jump2.value.status_code == 400

    # 4. Valid transition: processing -> shipped
    await transition_seller_shipment(
        resp.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.shipped),
        context=ctx_zol, user=seller_x, db=db
    )

    # State: shipped
    # 5. Illegal jump: shipped -> unfulfilled
    with pytest.raises(HTTPException) as exc_jump3:
        await transition_seller_shipment(
            resp.order_id, shipment_id,
            FulfillmentTransitionRequest(target_status=FulfillmentStatus.unfulfilled),
            context=ctx_zol, user=seller_x, db=db
        )
    assert exc_jump3.value.status_code == 400

    # 6. Valid transition: shipped -> delivered
    await transition_seller_shipment(
        resp.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.delivered),
        context=ctx_zol, user=seller_x, db=db
    )

    # State: delivered
    # 7. Illegal jump: delivered -> processing (terminal state)
    with pytest.raises(HTTPException) as exc_jump4:
        await transition_seller_shipment(
            resp.order_id, shipment_id,
            FulfillmentTransitionRequest(target_status=FulfillmentStatus.processing),
            context=ctx_zol, user=seller_x, db=db
        )
    assert exc_jump4.value.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# 5. CANCELLATION & RETURN WORKFLOW INVARIANTS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cancellation_and_return_invariants():
    db = EnhancedFakeDB()
    await seed_products(db)

    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=2), context=ctx_zol, user=buyer_a, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_a, db=db)
    resp = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_a, db=db
    )

    order_doc = await db.orders.find_one({"id": resp.order_id})
    line_id = order_doc["lines"][0]["line_id"]
    shipment_id = order_doc["shipments"][0]["shipment_id"]

    # 1. Return request on UNFULFILLED order -> HTTP 400
    with pytest.raises(HTTPException) as exc_ret_unfulfilled:
        await request_buyer_return(
            resp.order_id,
            ReturnRequest(line_item_id=line_id, quantity=1, reason="Defective"),
            context=ctx_zol, user=buyer_a, db=db
        )
    assert exc_ret_unfulfilled.value.status_code == 400
    assert "delivered orders" in exc_ret_unfulfilled.value.detail.lower()

    # Transition to shipped
    await transition_seller_shipment(
        resp.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.processing),
        context=ctx_zol, user=seller_x, db=db
    )
    await transition_seller_shipment(
        resp.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.shipped),
        context=ctx_zol, user=seller_x, db=db
    )

    # 2. Return request on SHIPPED order -> HTTP 400
    with pytest.raises(HTTPException) as exc_ret_shipped:
        await request_buyer_return(
            resp.order_id,
            ReturnRequest(line_item_id=line_id, quantity=1, reason="Defective"),
            context=ctx_zol, user=buyer_a, db=db
        )
    assert exc_ret_shipped.value.status_code == 400

    # 3. Cancellation request on SHIPPED order -> HTTP 400
    with pytest.raises(HTTPException) as exc_cancel_shipped:
        await request_buyer_cancellation(
            resp.order_id,
            CancellationRequest(reason="No longer needed"),
            context=ctx_zol, user=buyer_a, db=db
        )
    assert exc_cancel_shipped.value.status_code == 400
    assert "shipped or delivered" in exc_cancel_shipped.value.detail.lower()

    # Transition to delivered
    await transition_seller_shipment(
        resp.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.delivered),
        context=ctx_zol, user=seller_x, db=db
    )

    # 4. Cancellation request on DELIVERED order -> HTTP 400
    with pytest.raises(HTTPException) as exc_cancel_delivered:
        await request_buyer_cancellation(
            resp.order_id,
            CancellationRequest(reason="No longer needed"),
            context=ctx_zol, user=buyer_a, db=db
        )
    assert exc_cancel_delivered.value.status_code == 400

    # 5. Return request with QUANTITY OVERFLOW (> purchased quantity 2) -> HTTP 400
    with pytest.raises(HTTPException) as exc_ret_overflow:
        await request_buyer_return(
            resp.order_id,
            ReturnRequest(line_item_id=line_id, quantity=10, reason="Defective"),
            context=ctx_zol, user=buyer_a, db=db
        )
    assert exc_ret_overflow.value.status_code == 400
    assert "exceeds line quantity" in exc_ret_overflow.value.detail.lower()

    # 6. Return request with INVALID line_item_id -> HTTP 400
    with pytest.raises(HTTPException) as exc_ret_bad_line:
        await request_buyer_return(
            resp.order_id,
            ReturnRequest(line_item_id="non-existent-line-id", quantity=1, reason="Defective"),
            context=ctx_zol, user=buyer_a, db=db
        )
    assert exc_ret_bad_line.value.status_code == 400
    assert "not found in order" in exc_ret_bad_line.value.detail.lower()
