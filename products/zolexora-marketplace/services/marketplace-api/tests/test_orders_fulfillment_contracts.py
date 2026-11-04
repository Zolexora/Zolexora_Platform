"""
Comprehensive Unit & Integration Test Suite for MR-01E:
Orders, Fulfillment, Cancellation, and Returns Contracts.
"""

import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from core.config import settings
from models.orders import (
    OrderStatus, FulfillmentStatus, PaymentStatus, CancellationStatus, ReturnStatus,
    CreateOrderFromQuoteRequest, FulfillmentTransitionRequest,
    CancellationRequest, SellerCancellationActionRequest,
    ReturnRequest, SellerReturnActionRequest,
)
from routers.cart import checkout_quote, add_to_cart, CartItemCreate, verify_quote_token
from routers.orders import (
    create_order_from_quote, list_buyer_orders, get_buyer_order_detail,
    request_buyer_cancellation, request_buyer_return,
    list_seller_orders, get_seller_order_detail,
    transition_seller_shipment, action_seller_cancellation, action_seller_return,
)
from routers.admin_orders import list_admin_orders, get_admin_order_detail
from storefronts.models import StorefrontContext, StorefrontDefinition, StorefrontContextSource, StorefrontKey
from tests.commerce_seed import BUYER_1, BUYER_2, SEL_1, SEL_2, PROD_1, PROD_2, seed_listing
from commerce import cart as cart_store


def create_context(key_str: str) -> StorefrontContext:
    key = StorefrontKey(key_str)
    return StorefrontContext(
        storefront=StorefrontDefinition(
            id=f"store_{key_str}",
            key=key,
            display_name=key_str,
            canonical_host=f"{key_str}.example.com",
            hosts=frozenset([f"{key_str}.example.com"]),
            origins=frozenset([f"https://{key_str}.example.com"])
        ),
        source=StorefrontContextSource.HOST
    )

ctx_zol = create_context("zolexora-shop")
ctx_mah = create_context("mahila-madel")

buyer_1 = {"id": BUYER_1, "role": "viewer", "full_name": "Alice Buyer"}
buyer_2 = {"id": BUYER_2, "role": "viewer", "full_name": "Bob Buyer"}
seller_1 = {"id": SEL_1, "seller_org_id": SEL_1, "role": "seller", "name": "Seller One"}
seller_2 = {"id": SEL_2, "seller_org_id": SEL_2, "role": "seller", "name": "Seller Two"}
admin_user = {"id": "admin-1", "is_admin": True, "full_name": "Admin User"}


class EnhancedFakeDB:
    class Collection:
        def __init__(self):
            self.docs = []

        async def insert_one(self, doc):
            self.docs.append(dict(doc))

        async def insert_many(self, docs):
            self.docs.extend([dict(d) for d in docs])

        def find(self, query, proj=None):
            class Cursor:
                def __init__(self, docs, q):
                    self.filtered = []
                    for d in docs:
                        match = True
                        for k, v in q.items():
                            if k == "$or":
                                if not any(all(d.get(sub_k) == sub_v for sub_k, sub_v in cond.items()) for cond in v):
                                    match = False
                                    break
                            elif d.get(k) != v:
                                match = False
                                break
                        if match:
                            self.filtered.append(d)
                def sort(self, key, direction=1):
                    rev = (direction == -1)
                    self.filtered.sort(key=lambda x: x.get(key, ""), reverse=rev)
                    return self
                async def to_list(self, limit):
                    return self.filtered[:limit]
            return Cursor(self.docs, query)

        async def find_one(self, query, proj=None):
            for d in self.docs:
                match = True
                for k, v in query.items():
                    if k == "$or":
                        if not any(all(d.get(sub_k) == sub_v for sub_k, sub_v in cond.items()) for cond in v):
                            match = False
                            break
                    elif d.get(k) != v:
                        match = False
                        break
                if match:
                    return d
            return None

        async def update_one(self, query, update):
            matched = 0
            for doc in self.docs:
                match = True
                for k, v in query.items():
                    if doc.get(k) != v:
                        match = False
                        break
                if match:
                    if "$set" in update:
                        doc.update(update["$set"])
                    matched = 1
                    break
            return type("UpdateResult", (), {"matched_count": matched})()

        async def update_many(self, query, update):
            modified = 0
            for doc in self.docs:
                match = True
                for k, v in query.items():
                    if doc.get(k) != v:
                        match = False
                        break
                if match:
                    if "$set" in update:
                        doc.update(update["$set"])
                    modified += 1
            return type("UpdateResult", (), {"modified_count": modified})()

        async def delete_one(self, query):
            self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in query.items())]

        async def delete_many(self, query):
            self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in query.items())]

        async def count_documents(self, query):
            return len([d for d in self.docs if all(d.get(k) == v for k, v in query.items())])

    def __init__(self):
        self.cart = self.Collection()
        self.orders = self.Collection()
        self.shipments = self.Collection()


@pytest.fixture(autouse=True)
def set_fake_quote_secret(monkeypatch):
    monkeypatch.setattr(settings, "CHECKOUT_QUOTE_SIGNING_SECRET", SecretStr("fake-secret-for-testing-quotes-1234"))


async def seed_products(pg):
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=1000, stock=100, title="Product 1")

    await seed_listing(pg, PROD_2, org=SEL_2, storefront="zolexora-shop", price=2000, stock=100, title="Product 2")


shipping_addr = {
    "full_name": "Alice Buyer",
    "phone": "9876543210",
    "email": "alice@example.com",
    "address_line1": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001",
    "country": "IN"
}


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_order_creation_from_quote(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=2), context=ctx_zol, user=buyer_1, pg=pg)

    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)

    req = CreateOrderFromQuoteRequest(
        quote_id=quote.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="card",
        idempotency_key="idem-001"
    )
    resp = await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db, pg_conn=pg)

    assert resp.order_id is not None
    assert resp.order_number.startswith("ORD-")
    assert resp.storefront_id == "zolexora-shop"
    assert resp.buyer_id == BUYER_1
    assert resp.status == OrderStatus.placed
    assert resp.payment_status == PaymentStatus.pending
    assert resp.grand_total.amount_minor == 2000 + 360 + 4900  # 18% tax, delivery under ₹499

    # Verify order document persisted in db
    order_doc = await db.orders.find_one({"id": resp.order_id})
    assert order_doc is not None
    assert order_doc["seller_id"] == SEL_1
    assert len(order_doc["lines"]) == 1
    assert order_doc["lines"][0]["unit_price"]["amount_minor"] == 1000
    assert order_doc["lines"][0]["quantity"] == 2

    # Verify cart cleared
    cart_count = len(await cart_store.items(pg, BUYER_1, "zolexora-shop"))
    assert cart_count == 0


@pytest.mark.asyncio
async def test_order_creation_idempotency(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)

    req = CreateOrderFromQuoteRequest(
        quote_id=quote.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="card",
        idempotency_key="idem-repeat"
    )
    resp1 = await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db, pg_conn=pg)

    # Call second time with same idempotency key
    resp2 = await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db, pg_conn=pg)

    assert resp1.order_id == resp2.order_id
    assert resp1.order_number == resp2.order_number
    assert await db.orders.count_documents({"buyer_id": BUYER_1}) == 1


@pytest.mark.asyncio
async def test_order_creation_multi_seller_splitting(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    # Add product from Seller 1 and Seller 2
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    await add_to_cart(CartItemCreate(product_id=PROD_2, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)

    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    assert quote.grand_total.amount_minor == 3000 + 540 + 4900  # 18% tax, delivery under ₹499

    req = CreateOrderFromQuoteRequest(
        quote_id=quote.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="upi",
        idempotency_key="idem-multi"
    )
    await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db, pg_conn=pg)

    # Check database: 2 separate order documents split by seller
    all_orders = await db.orders.find({"storefront_id": "zolexora-shop", "buyer_id": BUYER_1}).to_list(10)
    assert len(all_orders) == 2

    # Verify shared checkout_id
    c_ids = set(o["checkout_id"] for o in all_orders)
    assert len(c_ids) == 1

    # Verify per-seller scoping
    sellers_in_orders = set(o["seller_id"] for o in all_orders)
    assert sellers_in_orders == {SEL_1, SEL_2}

    o1 = next(o for o in all_orders if o["seller_id"] == SEL_1)
    o2 = next(o for o in all_orders if o["seller_id"] == SEL_2)

    assert len(o1["lines"]) == 1
    assert o1["lines"][0]["seller_id"] == SEL_1

    assert len(o2["lines"]) == 1
    assert o2["lines"][0]["seller_id"] == SEL_2
    # Delivery and tax are split by subtotal share; the last order takes the rounding remainder,
    # so the orders add up to exactly the quote.
    amount = lambda o, k: o[k]["amount_minor"]  # noqa: E731
    for o, subtotal in ((o1, 1000), (o2, 2000)):
        assert amount(o, "grand_total") == subtotal + amount(o, "shipping_total") + amount(o, "tax_total")
    assert amount(o1, "shipping_total") + amount(o2, "shipping_total") == 4900
    assert amount(o1, "tax_total") + amount(o2, "tax_total") == 540
    assert amount(o1, "grand_total") + amount(o2, "grand_total") == quote.grand_total.amount_minor


@pytest.mark.asyncio
async def test_quote_verification_failures(pg):
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)

    # 1. Wrong buyer token
    with pytest.raises(HTTPException) as exc1:
        verify_quote_token(quote.quote_id, buyer_id=BUYER_2, storefront_id="zolexora-shop")
    assert exc1.value.status_code == 403

    # 2. Wrong storefront token
    with pytest.raises(HTTPException) as exc2:
        verify_quote_token(quote.quote_id, buyer_id=BUYER_1, storefront_id="mahila-madel")
    assert exc2.value.status_code == 403

    # 3. Invalid signature
    bad_token = quote.quote_id.split(".")[0] + ".invalidsig"
    with pytest.raises(HTTPException) as exc3:
        verify_quote_token(bad_token, buyer_id=BUYER_1, storefront_id="zolexora-shop")
    assert exc3.value.status_code == 400


@pytest.mark.asyncio
async def test_buyer_order_summary_and_detail(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=3), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)

    req = CreateOrderFromQuoteRequest(
        quote_id=quote.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="card"
    )
    created = await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db, pg_conn=pg)

    # Buyer list
    summaries = await list_buyer_orders(context=ctx_zol, user=buyer_1, db=db)
    assert len(summaries) == 1
    assert summaries[0].order_id == created.order_id
    assert summaries[0].item_count == 3
    assert summaries[0].grand_total.amount_minor == 3000 + 540 + 4900

    # Buyer detail
    detail = await get_buyer_order_detail(created.order_id, context=ctx_zol, user=buyer_1, db=db)
    assert detail.order_id == created.order_id
    assert detail.item_subtotal.amount_minor == 3000
    assert detail.grand_total.amount_minor == 3000 + 540 + 4900
    assert len(detail.lines) == 1

    # Cross-buyer security isolation test
    with pytest.raises(HTTPException) as exc_b2:
        await get_buyer_order_detail(created.order_id, context=ctx_zol, user=buyer_2, db=db)
    assert exc_b2.value.status_code == 404

    # Cross-storefront security isolation test
    with pytest.raises(HTTPException) as exc_mah:
        await get_buyer_order_detail(created.order_id, context=ctx_mah, user=buyer_1, db=db)
    assert exc_mah.value.status_code == 404


@pytest.mark.asyncio
async def test_buyer_cancellation_request(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    , pg_conn=pg)

    # Submit cancellation request on pre-fulfillment order
    cancel_req = CancellationRequest(reason="Ordered by mistake")
    cancel_resp = await request_buyer_cancellation(created.order_id, cancel_req, context=ctx_zol, user=buyer_1, db=db)

    assert cancel_resp.order_id == created.order_id
    assert cancel_resp.status == CancellationStatus.requested
    assert cancel_resp.reason == "Ordered by mistake"

    # Attempt cancellation on shipped/delivered order
    await db.orders.update_one({"id": created.order_id}, {"$set": {"fulfillment_status": FulfillmentStatus.shipped.value}})
    with pytest.raises(HTTPException) as exc_shipped:
        await request_buyer_cancellation(created.order_id, cancel_req, context=ctx_zol, user=buyer_1, db=db)
    assert exc_shipped.value.status_code == 400


@pytest.mark.asyncio
async def test_buyer_return_request(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=2), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    , pg_conn=pg)

    # Attempt return on unfulfilled order -> fails
    order_doc = await db.orders.find_one({"id": created.order_id})
    line_id = order_doc["lines"][0]["line_id"]
    ret_req = ReturnRequest(line_item_id=line_id, quantity=1, reason="Defective product")

    with pytest.raises(HTTPException) as exc_unfulfilled:
        await request_buyer_return(created.order_id, ret_req, context=ctx_zol, user=buyer_1, db=db)
    assert exc_unfulfilled.value.status_code == 400

    # Update status to delivered
    await db.orders.update_one({"id": created.order_id}, {"$set": {"fulfillment_status": FulfillmentStatus.delivered.value}})

    # Submit return on delivered order -> succeeds
    ret_resp = await request_buyer_return(created.order_id, ret_req, context=ctx_zol, user=buyer_1, db=db)
    assert ret_resp.order_id == created.order_id
    assert ret_resp.status == ReturnStatus.requested
    assert ret_resp.line_item_id == line_id


@pytest.mark.asyncio
async def test_seller_order_summary_and_detail(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    await add_to_cart(CartItemCreate(product_id=PROD_2, quantity=2), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    , pg_conn=pg)

    # Seller 1 list
    seller1_summaries = await list_seller_orders(context=ctx_zol, user=seller_1, db=db)
    assert len(seller1_summaries) == 1
    assert seller1_summaries[0].seller_id == SEL_1
    assert seller1_summaries[0].seller_subtotal.amount_minor == 1000

    # Seller 2 list
    seller2_summaries = await list_seller_orders(context=ctx_zol, user=seller_2, db=db)
    assert len(seller2_summaries) == 1
    assert seller2_summaries[0].seller_id == SEL_2
    assert seller2_summaries[0].seller_subtotal.amount_minor == 4000

    # Seller 1 detail for Seller 2's order -> HTTP 404
    sel2_order_id = seller2_summaries[0].order_id
    with pytest.raises(HTTPException) as exc_cross_seller:
        await get_seller_order_detail(sel2_order_id, context=ctx_zol, user=seller_1, db=db)
    assert exc_cross_seller.value.status_code == 404


@pytest.mark.asyncio
async def test_fulfillment_state_machine_transitions(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    , pg_conn=pg)

    order_doc = await db.orders.find_one({"id": created.order_id})
    shipment_id = order_doc["shipments"][0]["shipment_id"]

    # 1. unfulfilled -> allocated
    t1 = await transition_seller_shipment(
        created.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.allocated),
        context=ctx_zol, user=seller_1, db=db
    , pg=pg)
    assert t1.status == FulfillmentStatus.allocated

    # 2. allocated -> processing
    t2 = await transition_seller_shipment(
        created.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.processing),
        context=ctx_zol, user=seller_1, db=db
    , pg=pg)
    assert t2.status == FulfillmentStatus.processing

    # 3. processing -> shipped
    t3 = await transition_seller_shipment(
        created.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.shipped, carrier_name="ExpressCourier", tracking_number="EXP123"),
        context=ctx_zol, user=seller_1, db=db
    , pg=pg)
    assert t3.status == FulfillmentStatus.shipped
    assert t3.carrier_name == "ExpressCourier"

    # 4. shipped -> delivered
    t4 = await transition_seller_shipment(
        created.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.delivered),
        context=ctx_zol, user=seller_1, db=db
    , pg=pg)
    assert t4.status == FulfillmentStatus.delivered

    # 5. Invalid transition: delivered -> processing raises HTTP 400
    with pytest.raises(HTTPException) as exc_invalid:
        await transition_seller_shipment(
            created.order_id, shipment_id,
            FulfillmentTransitionRequest(target_status=FulfillmentStatus.processing),
            context=ctx_zol, user=seller_1, db=db
        , pg=pg)
    assert exc_invalid.value.status_code == 400
    assert "Invalid fulfillment state transition" in str(exc_invalid.value.detail)


@pytest.mark.asyncio
async def test_seller_cancellation_action(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    , pg_conn=pg)

    # Buyer requests cancellation
    await request_buyer_cancellation(created.order_id, CancellationRequest(reason="Wrong item"), context=ctx_zol, user=buyer_1, db=db)

    # Seller approves cancellation
    action_req = SellerCancellationActionRequest(action="approve", comment="Approved cancellation request")
    action_resp = await action_seller_cancellation(created.order_id, action_req, context=ctx_zol, user=seller_1, db=db, pg=pg)

    assert action_resp.status == CancellationStatus.approved
    assert action_resp.seller_comment == "Approved cancellation request"

    order_doc = await db.orders.find_one({"id": created.order_id})
    assert order_doc["status"] == OrderStatus.cancelled.value


@pytest.mark.asyncio
async def test_seller_return_action(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    , pg_conn=pg)

    # Mark order delivered
    await db.orders.update_one({"id": created.order_id}, {"$set": {"fulfillment_status": FulfillmentStatus.delivered.value}})
    order_doc = await db.orders.find_one({"id": created.order_id})
    line_id = order_doc["lines"][0]["line_id"]

    # Buyer requests return
    await request_buyer_return(created.order_id, ReturnRequest(line_item_id=line_id, quantity=1, reason="Faulty"), context=ctx_zol, user=buyer_1, db=db)

    # Seller approves return
    act1 = await action_seller_return(created.order_id, SellerReturnActionRequest(action="approve", comment="Return accepted"), context=ctx_zol, user=seller_1, db=db)
    assert act1.status == ReturnStatus.approved

    # Seller marks received
    act2 = await action_seller_return(created.order_id, SellerReturnActionRequest(action="mark_received"), context=ctx_zol, user=seller_1, db=db)
    assert act2.status == ReturnStatus.item_received




@pytest.mark.asyncio
async def test_admin_order_views(pg):
    db = EnhancedFakeDB()
    await seed_products(pg)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="upi"),
        context=ctx_zol, user=buyer_1, db=db
    , pg_conn=pg)

    # Set UPI awaiting verification state
    await db.orders.update_one({"id": created.order_id}, {"$set": {"payment_status": "awaiting_verification"}})

    # Admin summary list
    admin_summaries = await list_admin_orders(context=ctx_zol, user=admin_user, db=db)
    assert len(admin_summaries) == 1
    assert admin_summaries[0].order_id == created.order_id

    # Admin detail
    admin_detail = await get_admin_order_detail(created.order_id, context=ctx_zol, user=admin_user, db=db)
    assert admin_detail.order_id == created.order_id
