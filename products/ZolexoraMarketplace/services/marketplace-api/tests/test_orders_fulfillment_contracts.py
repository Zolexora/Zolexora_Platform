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

buyer_1 = {"id": "buyer-1", "role": "viewer", "full_name": "Alice Buyer"}
buyer_2 = {"id": "buyer-2", "role": "viewer", "full_name": "Bob Buyer"}
seller_1 = {"id": "sel-1", "role": "seller", "name": "Seller One"}
seller_2 = {"id": "sel-2", "role": "seller", "name": "Seller Two"}
admin_user = {"id": "admin-1", "role": "admin", "full_name": "Admin User"}


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
        self.storefront_listings = self.Collection()
        self.master_products = self.Collection()
        self.inventory_balances = self.Collection()
        self.orders = self.Collection()
        self.shipments = self.Collection()


@pytest.fixture(autouse=True)
def set_fake_quote_secret(monkeypatch):
    monkeypatch.setattr(settings, "CHECKOUT_QUOTE_SIGNING_SECRET", SecretStr("fake-secret-for-testing-quotes-1234"))


async def seed_products(db: EnhancedFakeDB):
    await db.storefront_listings.insert_one({
        "id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "seller_name": "Seller One",
        "storefront_id": "zolexora-shop", "price": {"amount_minor": 1000, "currency": "INR"}, "status": "active"
    })
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "Product 1", "seller_name": "Seller One", "images": ["http://img1.com"]})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 100, "reserved_quantity": 0})

    await db.storefront_listings.insert_one({
        "id": "prod-2", "product_id": "mp-2", "seller_id": "sel-2", "seller_name": "Seller Two",
        "storefront_id": "zolexora-shop", "price": {"amount_minor": 2000, "currency": "INR"}, "status": "active"
    })
    await db.master_products.insert_one({"id": "mp-2", "seller_id": "sel-2", "title": "Product 2", "seller_name": "Seller Two", "images": ["http://img2.com"]})
    await db.inventory_balances.insert_one({"product_id": "mp-2", "seller_id": "sel-2", "available_quantity": 100, "reserved_quantity": 0})


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
async def test_order_creation_from_quote():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=2), context=ctx_zol, user=buyer_1, db=db)

    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)

    req = CreateOrderFromQuoteRequest(
        quote_id=quote.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="card",
        idempotency_key="idem-001"
    )
    resp = await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db)

    assert resp.order_id is not None
    assert resp.order_number.startswith("ORD-")
    assert resp.storefront_id == "zolexora-shop"
    assert resp.buyer_id == "buyer-1"
    assert resp.status == OrderStatus.placed
    assert resp.payment_status == PaymentStatus.pending
    assert resp.grand_total.amount_minor == 2000

    # Verify order document persisted in db
    order_doc = await db.orders.find_one({"id": resp.order_id})
    assert order_doc is not None
    assert order_doc["seller_id"] == "sel-1"
    assert len(order_doc["lines"]) == 1
    assert order_doc["lines"][0]["unit_price"]["amount_minor"] == 1000
    assert order_doc["lines"][0]["quantity"] == 2

    # Verify cart cleared
    cart_count = await db.cart.count_documents({"user_id": "buyer-1", "storefront_id": "zolexora-shop"})
    assert cart_count == 0


@pytest.mark.asyncio
async def test_order_creation_idempotency():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)

    req = CreateOrderFromQuoteRequest(
        quote_id=quote.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="card",
        idempotency_key="idem-repeat"
    )
    resp1 = await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db)

    # Call second time with same idempotency key
    resp2 = await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db)

    assert resp1.order_id == resp2.order_id
    assert resp1.order_number == resp2.order_number
    assert await db.orders.count_documents({"buyer_id": "buyer-1"}) == 1


@pytest.mark.asyncio
async def test_order_creation_multi_seller_splitting():
    db = EnhancedFakeDB()
    await seed_products(db)
    # Add product from Seller 1 and Seller 2
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    await add_to_cart(CartItemCreate(product_id="prod-2", quantity=1), context=ctx_zol, user=buyer_1, db=db)

    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)
    assert quote.grand_total.amount_minor == 3000

    req = CreateOrderFromQuoteRequest(
        quote_id=quote.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="upi",
        idempotency_key="idem-multi"
    )
    await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db)

    # Check database: 2 separate order documents split by seller
    all_orders = await db.orders.find({"storefront_id": "zolexora-shop", "buyer_id": "buyer-1"}).to_list(10)
    assert len(all_orders) == 2

    # Verify shared checkout_id
    c_ids = set(o["checkout_id"] for o in all_orders)
    assert len(c_ids) == 1

    # Verify per-seller scoping
    sellers_in_orders = set(o["seller_id"] for o in all_orders)
    assert sellers_in_orders == {"sel-1", "sel-2"}

    o1 = next(o for o in all_orders if o["seller_id"] == "sel-1")
    o2 = next(o for o in all_orders if o["seller_id"] == "sel-2")

    assert len(o1["lines"]) == 1
    assert o1["lines"][0]["seller_id"] == "sel-1"
    assert o1["grand_total"]["amount_minor"] == 1000

    assert len(o2["lines"]) == 1
    assert o2["lines"][0]["seller_id"] == "sel-2"
    assert o2["grand_total"]["amount_minor"] == 2000


@pytest.mark.asyncio
async def test_quote_verification_failures():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)

    # 1. Wrong buyer token
    with pytest.raises(HTTPException) as exc1:
        verify_quote_token(quote.quote_id, buyer_id="buyer-2", storefront_id="zolexora-shop")
    assert exc1.value.status_code == 403

    # 2. Wrong storefront token
    with pytest.raises(HTTPException) as exc2:
        verify_quote_token(quote.quote_id, buyer_id="buyer-1", storefront_id="mahila-madel")
    assert exc2.value.status_code == 403

    # 3. Invalid signature
    bad_token = quote.quote_id.split(".")[0] + ".invalidsig"
    with pytest.raises(HTTPException) as exc3:
        verify_quote_token(bad_token, buyer_id="buyer-1", storefront_id="zolexora-shop")
    assert exc3.value.status_code == 400


@pytest.mark.asyncio
async def test_buyer_order_summary_and_detail():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=3), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)

    req = CreateOrderFromQuoteRequest(
        quote_id=quote.quote_id,
        shipping_address=shipping_addr,
        payment_method_type="card"
    )
    created = await create_order_from_quote(req, context=ctx_zol, user=buyer_1, db=db)

    # Buyer list
    summaries = await list_buyer_orders(context=ctx_zol, user=buyer_1, db=db)
    assert len(summaries) == 1
    assert summaries[0].order_id == created.order_id
    assert summaries[0].item_count == 3
    assert summaries[0].grand_total.amount_minor == 3000

    # Buyer detail
    detail = await get_buyer_order_detail(created.order_id, context=ctx_zol, user=buyer_1, db=db)
    assert detail.order_id == created.order_id
    assert detail.item_subtotal.amount_minor == 3000
    assert detail.grand_total.amount_minor == 3000
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
async def test_buyer_cancellation_request():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    )

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
async def test_buyer_return_request():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=2), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    )

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
async def test_seller_order_summary_and_detail():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    await add_to_cart(CartItemCreate(product_id="prod-2", quantity=2), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)
    await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    )

    # Seller 1 list
    seller1_summaries = await list_seller_orders(context=ctx_zol, user=seller_1, db=db)
    assert len(seller1_summaries) == 1
    assert seller1_summaries[0].seller_id == "sel-1"
    assert seller1_summaries[0].seller_subtotal.amount_minor == 1000

    # Seller 2 list
    seller2_summaries = await list_seller_orders(context=ctx_zol, user=seller_2, db=db)
    assert len(seller2_summaries) == 1
    assert seller2_summaries[0].seller_id == "sel-2"
    assert seller2_summaries[0].seller_subtotal.amount_minor == 4000

    # Seller 1 detail for Seller 2's order -> HTTP 404
    sel2_order_id = seller2_summaries[0].order_id
    with pytest.raises(HTTPException) as exc_cross_seller:
        await get_seller_order_detail(sel2_order_id, context=ctx_zol, user=seller_1, db=db)
    assert exc_cross_seller.value.status_code == 404


@pytest.mark.asyncio
async def test_fulfillment_state_machine_transitions():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    )

    order_doc = await db.orders.find_one({"id": created.order_id})
    shipment_id = order_doc["shipments"][0]["shipment_id"]

    # 1. unfulfilled -> allocated
    t1 = await transition_seller_shipment(
        created.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.allocated),
        context=ctx_zol, user=seller_1, db=db
    )
    assert t1.status == FulfillmentStatus.allocated

    # 2. allocated -> processing
    t2 = await transition_seller_shipment(
        created.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.processing),
        context=ctx_zol, user=seller_1, db=db
    )
    assert t2.status == FulfillmentStatus.processing

    # 3. processing -> shipped
    t3 = await transition_seller_shipment(
        created.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.shipped, carrier_name="ExpressCourier", tracking_number="EXP123"),
        context=ctx_zol, user=seller_1, db=db
    )
    assert t3.status == FulfillmentStatus.shipped
    assert t3.carrier_name == "ExpressCourier"

    # 4. shipped -> delivered
    t4 = await transition_seller_shipment(
        created.order_id, shipment_id,
        FulfillmentTransitionRequest(target_status=FulfillmentStatus.delivered),
        context=ctx_zol, user=seller_1, db=db
    )
    assert t4.status == FulfillmentStatus.delivered

    # 5. Invalid transition: delivered -> processing raises HTTP 400
    with pytest.raises(HTTPException) as exc_invalid:
        await transition_seller_shipment(
            created.order_id, shipment_id,
            FulfillmentTransitionRequest(target_status=FulfillmentStatus.processing),
            context=ctx_zol, user=seller_1, db=db
        )
    assert exc_invalid.value.status_code == 400
    assert "Invalid fulfillment state transition" in str(exc_invalid.value.detail)


@pytest.mark.asyncio
async def test_seller_cancellation_action():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    )

    # Buyer requests cancellation
    await request_buyer_cancellation(created.order_id, CancellationRequest(reason="Wrong item"), context=ctx_zol, user=buyer_1, db=db)

    # Seller approves cancellation
    action_req = SellerCancellationActionRequest(action="approve", comment="Approved cancellation request")
    action_resp = await action_seller_cancellation(created.order_id, action_req, context=ctx_zol, user=seller_1, db=db)

    assert action_resp.status == CancellationStatus.approved
    assert action_resp.seller_comment == "Approved cancellation request"

    order_doc = await db.orders.find_one({"id": created.order_id})
    assert order_doc["status"] == OrderStatus.cancelled.value


@pytest.mark.asyncio
async def test_seller_return_action():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="card"),
        context=ctx_zol, user=buyer_1, db=db
    )

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
async def test_admin_order_views():
    db = EnhancedFakeDB()
    await seed_products(db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, db=db)
    created = await create_order_from_quote(
        CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=shipping_addr, payment_method_type="upi"),
        context=ctx_zol, user=buyer_1, db=db
    )

    # Set UPI awaiting verification state
    await db.orders.update_one({"id": created.order_id}, {"$set": {"payment_status": "awaiting_verification"}})

    # Admin summary list
    admin_summaries = await list_admin_orders(context=ctx_zol, user=admin_user, db=db)
    assert len(admin_summaries) == 1
    assert admin_summaries[0].order_id == created.order_id

    # Admin detail
    admin_detail = await get_admin_order_detail(created.order_id, context=ctx_zol, user=admin_user, db=db)
    assert admin_detail.order_id == created.order_id
