"""
Canonical Order, Fulfillment, Cancellation, and Returns API router for Zolexora Marketplace.
Standardized for MR-01E / ADR 0013.
"""

import asyncio
import uuid
from typing import List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.deps import db_dep, current_user, seller_only
from shared.database.postgres import pg_conn_dep
from integrations.zolexora_erp.outbox import sync_to_erp_outbox
from storefronts.dependencies import require_storefront_context, optional_storefront_context
from storefronts.models import StorefrontContext
from models.primitives import Money
from models.orders import (
    OrderStatus, FulfillmentStatus, PaymentStatus, CancellationStatus, ReturnStatus,
    ShippingAddress, OrderLineSnapshot,
    CreateOrderFromQuoteRequest, CreateOrderFromQuoteResponse,
    BuyerOrderSummaryResponse, BuyerOrderResponse,
    SellerOrderSummaryResponse, SellerOrderResponse,
    ShipmentResponse, ShipmentEventResponse, FulfillmentTransitionRequest,
    CancellationRequest, CancellationResponse, SellerCancellationActionRequest,
    ReturnRequest, ReturnResponse, SellerReturnActionRequest,
)
from routers.cart import verify_quote_token, _get_active_product

orders_router = APIRouter(prefix="/orders", tags=["orders"])

ALLOWED_FULFILLMENT_TRANSITIONS = {
    FulfillmentStatus.unfulfilled: {FulfillmentStatus.allocated, FulfillmentStatus.processing, FulfillmentStatus.cancelled},
    FulfillmentStatus.allocated: {FulfillmentStatus.processing, FulfillmentStatus.cancelled},
    FulfillmentStatus.processing: {FulfillmentStatus.shipped, FulfillmentStatus.cancelled},
    FulfillmentStatus.shipped: {FulfillmentStatus.out_for_delivery, FulfillmentStatus.delivered, FulfillmentStatus.failed_delivery},
    FulfillmentStatus.out_for_delivery: {FulfillmentStatus.delivered, FulfillmentStatus.failed_delivery},
    FulfillmentStatus.failed_delivery: {FulfillmentStatus.returned_to_origin, FulfillmentStatus.shipped},
}


_ORDER_IDEMPOTENCY_LOCKS: dict[str, asyncio.Lock] = {}

def _get_idempotency_lock(key: str) -> asyncio.Lock:
    if key not in _ORDER_IDEMPOTENCY_LOCKS:
        _ORDER_IDEMPOTENCY_LOCKS[key] = asyncio.Lock()
    return _ORDER_IDEMPOTENCY_LOCKS[key]


# ── 1. Order Creation Endpoint ────────────────────────────────────────────────

@orders_router.post("", response_model=CreateOrderFromQuoteResponse, status_code=201)
async def create_order_from_quote(
    req: CreateOrderFromQuoteRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep),
    pg_conn=Depends(pg_conn_dep)
):
    if req.idempotency_key:
        lock = _get_idempotency_lock(f"{user['id']}:{req.idempotency_key}")
        async with lock:
            return await _create_order_from_quote_impl(req, context, user, db, pg_conn)
    return await _create_order_from_quote_impl(req, context, user, db, pg_conn)


async def _create_order_from_quote_impl(
    req: CreateOrderFromQuoteRequest,
    context: StorefrontContext,
    user: dict,
    db: AsyncIOMotorDatabase,
    pg_conn
):
    # 1. Verify Quote Token
    quote_data = verify_quote_token(req.quote_id, buyer_id=user["id"], storefront_id=context.key)

    # 2. Check Idempotency Key
    if req.idempotency_key:
        existing_orders = await db.orders.find({
            "storefront_id": context.key,
            "buyer_id": user["id"],
            "idempotency_key": req.idempotency_key
        }, {"_id": 0}).to_list(100)
        if existing_orders:
            first = existing_orders[0]
            grand_total_minor = quote_data.get("grand_total", sum(o["grand_total"]["amount_minor"] for o in existing_orders))
            return CreateOrderFromQuoteResponse(
                order_id=first["id"],
                order_number=first["order_number"],
                storefront_id=first["storefront_id"],
                buyer_id=first["buyer_id"],
                status=OrderStatus(first["status"]),
                payment_status=PaymentStatus(first["payment_status"]),
                grand_total=Money(amount_minor=grand_total_minor, currency=first["currency"]),
                created_at=first["created_at"],
                expires_at=quote_data.get("expires_at")
            )

    # 3. Resolve Line Item Snapshots
    quote_lines = quote_data.get("lines", [])
    if not quote_lines:
        raise HTTPException(400, "Quote has no line items")

    currency = quote_data.get("currency", "INR")
    snapshots_by_seller = {}

    for line_item in quote_lines:
        pid = line_item["product_id"]
        qty = line_item["quantity"]
        unit_price_minor = line_item["unit_price"]

        p_obj = await _get_active_product(db, pid, context.key)
        if p_obj:
            master_pid = getattr(p_obj, "master_product_id", pid) or pid
            seller_id = p_obj.seller_id or "seller_default"
            seller_name = p_obj.seller_name or "Seller"
            title = p_obj.title or "Product"
            image_url = p_obj.images[0] if p_obj.images else None
        else:
            listing_doc = await db.storefront_listings.find_one({"id": pid}, {"_id": 0}) or {}
            master_pid = listing_doc.get("product_id") or pid
            seller_id = listing_doc.get("seller_id") or "seller_default"
            seller_name = listing_doc.get("seller_name") or "Seller"
            title = listing_doc.get("title") or "Product"
            images = listing_doc.get("images") or []
            image_url = images[0] if images else None

        line_subtotal_minor = unit_price_minor * qty
        snapshot = OrderLineSnapshot(
            line_id=str(uuid.uuid4()),
            listing_id=pid,
            master_product_id=master_pid,
            seller_id=seller_id,
            seller_name=seller_name,
            title=title,
            image_url=image_url,
            unit_price=Money(amount_minor=unit_price_minor, currency=currency),
            quantity=qty,
            subtotal=Money(amount_minor=line_subtotal_minor, currency=currency),
            fulfillment_status=FulfillmentStatus.unfulfilled,
            cancellation_status=CancellationStatus.none,
            return_status=ReturnStatus.none,
        )

        if seller_id not in snapshots_by_seller:
            snapshots_by_seller[seller_id] = {
                "seller_name": seller_name,
                "lines": []
            }
        snapshots_by_seller[seller_id]["lines"].append(snapshot)

    # 4. Multi-Seller Splitting under Shared Checkout ID
    checkout_id = str(uuid.uuid4())
    created_at_str = datetime.now(timezone.utc).isoformat()
    all_seller_ids = list(snapshots_by_seller.keys())
    num_sellers = len(all_seller_ids)

    quote_item_subtotal = quote_data.get("item_subtotal", 0)
    quote_shipping = quote_data.get("shipping_total", 0)
    quote_tax = quote_data.get("tax_total", 0)
    quote_discount = quote_data.get("discount_total", 0)

    created_orders = []
    buyer_name = user.get("full_name") or user.get("name") or user.get("email") or "Buyer"

    for seller_id, seller_data in snapshots_by_seller.items():
        order_id = str(uuid.uuid4())
        order_number = f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        s_lines = seller_data["lines"]
        s_subtotal_minor = sum(line.subtotal.amount_minor for line in s_lines)

        if num_sellers == 1:
            s_shipping = quote_shipping
            s_tax = quote_tax
            s_discount = quote_discount
        else:
            ratio = s_subtotal_minor / quote_item_subtotal if quote_item_subtotal > 0 else (1.0 / num_sellers)
            s_shipping = int(quote_shipping * ratio)
            s_tax = int(quote_tax * ratio)
            s_discount = int(quote_discount * ratio)

        s_grand_total = s_subtotal_minor + s_shipping + s_tax - s_discount

        shipment_id = str(uuid.uuid4())
        shipment = ShipmentResponse(
            shipment_id=shipment_id,
            order_id=order_id,
            storefront_id=context.key,
            seller_id=seller_id,
            seller_name=seller_data["seller_name"],
            status=FulfillmentStatus.unfulfilled,
            line_item_ids=[line.line_id for line in s_lines],
            events=[
                ShipmentEventResponse(
                    status=FulfillmentStatus.unfulfilled,
                    description="Order placed and shipment created",
                    timestamp=created_at_str
                )
            ],
            created_at=created_at_str,
            updated_at=created_at_str,
        )

        order_doc = {
            "id": order_id,
            "order_id": order_id,
            "order_number": order_number,
            "checkout_id": checkout_id,
            "storefront_id": context.key,
            "buyer_id": user["id"],
            "buyer_name": buyer_name,
            "seller_id": seller_id,
            "seller_name": seller_data["seller_name"],
            "seller_ids": all_seller_ids,
            "status": OrderStatus.placed.value,
            "payment_status": PaymentStatus.pending.value,
            "fulfillment_status": FulfillmentStatus.unfulfilled.value,
            "currency": currency,
            "lines": [line.model_dump() for line in s_lines],
            "shipping_address": req.shipping_address.model_dump(),
            "payment_method": req.payment_method_type,
            "payment_method_type": req.payment_method_type,
            "item_subtotal": Money(amount_minor=s_subtotal_minor, currency=currency).model_dump(),
            "shipping_total": Money(amount_minor=s_shipping, currency=currency).model_dump(),
            "tax_total": Money(amount_minor=s_tax, currency=currency).model_dump(),
            "discount_total": Money(amount_minor=s_discount, currency=currency).model_dump(),
            "grand_total": Money(amount_minor=s_grand_total, currency=currency).model_dump(),
            "shipments": [shipment.model_dump()],
            "cancellations": [],
            "returns": [],
            "idempotency_key": req.idempotency_key,
            "created_at": created_at_str,
            "updated_at": created_at_str,
        }

        await db.orders.insert_one(order_doc)
        created_orders.append(order_doc)

        # Sync to ERP outbox
        # We wrap this in a try-except to ensure checkout succeeds even if ERP adapter fails
        try:
            await sync_to_erp_outbox(
                conn=pg_conn,
                event_type="order.created",
                aggregate_type="order",
                aggregate_id=order_id,
                payload=order_doc,
                storefront_id=context.key,
                tenant_id=None # Replace with proper tenant if resolved
            )
        except Exception as e:
            # Task 5 constraint: "ensure checkout succeeds even if ERP adapter fails"
            import logging
            logging.error(f"Failed to sync order {order_id} to ERP outbox: {e}")

    # 5. Clear Cart
    await db.cart.delete_many({"user_id": user["id"], "storefront_id": context.key})

    # 6. Response
    first_order = created_orders[0]
    total_grand_minor = quote_data.get("grand_total", sum(o["grand_total"]["amount_minor"] for o in created_orders))

    return CreateOrderFromQuoteResponse(
        order_id=first_order["id"],
        order_number=first_order["order_number"],
        storefront_id=first_order["storefront_id"],
        buyer_id=first_order["buyer_id"],
        status=OrderStatus.placed,
        payment_status=PaymentStatus.pending,
        grand_total=Money(amount_minor=total_grand_minor, currency=currency),
        created_at=first_order["created_at"],
        expires_at=quote_data.get("expires_at")
    )


# ── 2. Buyer Order Router (/api/orders/buyer) ────────────────────────────────

@orders_router.get("/buyer", response_model=List[BuyerOrderSummaryResponse])
async def list_buyer_orders(
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    docs = await db.orders.find(
        {"storefront_id": context.key, "buyer_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    summaries = []
    for doc in docs:
        item_count = sum(line.get("quantity", 1) for line in doc.get("lines", []))
        summaries.append(BuyerOrderSummaryResponse(
            order_id=doc["id"],
            order_number=doc["order_number"],
            storefront_id=doc["storefront_id"],
            status=OrderStatus(doc["status"]),
            payment_status=PaymentStatus(doc["payment_status"]),
            fulfillment_status=FulfillmentStatus(doc.get("fulfillment_status", FulfillmentStatus.unfulfilled)),
            currency=doc["currency"],
            item_count=item_count,
            grand_total=Money(**doc["grand_total"]),
            created_at=doc["created_at"],
        ))
    return summaries


@orders_router.get("/buyer/{order_id}", response_model=BuyerOrderResponse)
async def get_buyer_order_detail(
    order_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key, "buyer_id": user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    return BuyerOrderResponse(
        order_id=doc["id"],
        order_number=doc["order_number"],
        storefront_id=doc["storefront_id"],
        buyer_id=doc["buyer_id"],
        status=OrderStatus(doc["status"]),
        payment_status=PaymentStatus(doc["payment_status"]),
        fulfillment_status=FulfillmentStatus(doc.get("fulfillment_status", FulfillmentStatus.unfulfilled)),
        currency=doc["currency"],
        lines=[OrderLineSnapshot(**line) for line in doc.get("lines", [])],
        shipping_address=ShippingAddress(**doc["shipping_address"]),
        item_subtotal=Money(**doc["item_subtotal"]),
        shipping_total=Money(**doc["shipping_total"]),
        tax_total=Money(**doc["tax_total"]),
        discount_total=Money(**doc["discount_total"]),
        grand_total=Money(**doc["grand_total"]),
        shipments=[ShipmentResponse(**s) for s in doc.get("shipments", [])],
        cancellations=[CancellationResponse(**c) for c in doc.get("cancellations", [])],
        returns=[ReturnResponse(**r) for r in doc.get("returns", [])],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@orders_router.post("/buyer/{order_id}/cancel", response_model=CancellationResponse)
async def request_buyer_cancellation(
    order_id: str,
    req: CancellationRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key, "buyer_id": user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    current_fulfillment = doc.get("fulfillment_status", FulfillmentStatus.unfulfilled.value)
    if current_fulfillment not in (
        FulfillmentStatus.unfulfilled.value,
        FulfillmentStatus.allocated.value,
        FulfillmentStatus.processing.value,
    ):
        raise HTTPException(400, "Cancellation not permitted for orders that are shipped or delivered")

    all_line_ids = [line["line_id"] for line in doc.get("lines", [])]
    target_line_ids = req.line_item_ids if req.line_item_ids else all_line_ids

    for lid in target_line_ids:
        if lid not in all_line_ids:
            raise HTTPException(400, f"Line item {lid} does not exist in order")

    now_str = datetime.now(timezone.utc).isoformat()
    cancellation = CancellationResponse(
        cancellation_id=str(uuid.uuid4()),
        order_id=order_id,
        storefront_id=context.key,
        requested_by=user["id"],
        requester_role="buyer",
        status=CancellationStatus.requested,
        reason=req.reason,
        line_item_ids=target_line_ids,
        created_at=now_str,
        updated_at=now_str,
    )

    updated_lines = []
    for line in doc.get("lines", []):
        if line["line_id"] in target_line_ids:
            line["cancellation_status"] = CancellationStatus.requested.value
        updated_lines.append(line)

    cancellations = doc.get("cancellations", [])
    cancellations.append(cancellation.model_dump())

    await db.orders.update_one(
        {"id": order_id, "storefront_id": context.key, "buyer_id": user["id"]},
        {"$set": {
            "cancellations": cancellations,
            "lines": updated_lines,
            "updated_at": now_str
        }}
    )

    return cancellation


@orders_router.post("/buyer/{order_id}/return", response_model=ReturnResponse)
async def request_buyer_return(
    order_id: str,
    req: ReturnRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key, "buyer_id": user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    current_fulfillment = doc.get("fulfillment_status", FulfillmentStatus.unfulfilled.value)
    if current_fulfillment != FulfillmentStatus.delivered.value:
        raise HTTPException(400, "Return requests are only permitted for delivered orders")

    target_line = next((line for line in doc.get("lines", []) if line["line_id"] == req.line_item_id), None)
    if not target_line:
        raise HTTPException(400, f"Line item {req.line_item_id} not found in order")

    if req.quantity > target_line["quantity"]:
        raise HTTPException(400, f"Return quantity ({req.quantity}) exceeds line quantity ({target_line['quantity']})")

    now_str = datetime.now(timezone.utc).isoformat()
    ret_resp = ReturnResponse(
        return_id=str(uuid.uuid4()),
        order_id=order_id,
        storefront_id=context.key,
        buyer_id=user["id"],
        seller_id=target_line["seller_id"],
        line_item_id=req.line_item_id,
        quantity=req.quantity,
        status=ReturnStatus.requested,
        reason=req.reason,
        proof_images=req.images,
        created_at=now_str,
        updated_at=now_str,
    )

    updated_lines = []
    for line in doc.get("lines", []):
        if line["line_id"] == req.line_item_id:
            line["return_status"] = ReturnStatus.requested.value
        updated_lines.append(line)

    returns_list = doc.get("returns", [])
    returns_list.append(ret_resp.model_dump())

    await db.orders.update_one(
        {"id": order_id, "storefront_id": context.key, "buyer_id": user["id"]},
        {"$set": {
            "returns": returns_list,
            "lines": updated_lines,
            "updated_at": now_str
        }}
    )

    return ret_resp


# ── 3. Seller Order Router (/api/orders/seller) ───────────────────────────────

@orders_router.get("/seller", response_model=List[SellerOrderSummaryResponse])
async def list_seller_orders(
    context: StorefrontContext | None = Depends(optional_storefront_context),
    user=Depends(seller_only),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    query = {"seller_id": user["id"]}
    if context is not None:
        query["storefront_id"] = context.key
        
    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)

    summaries = []
    for doc in docs:
        seller_lines = [line for line in doc.get("lines", []) if line.get("seller_id") == user["id"]]
        seller_item_count = sum(line.get("quantity", 1) for line in seller_lines)
        seller_subtotal_minor = sum(line["subtotal"]["amount_minor"] for line in seller_lines) if seller_lines else doc["item_subtotal"]["amount_minor"]

        summaries.append(SellerOrderSummaryResponse(
            order_id=doc["id"],
            order_number=doc["order_number"],
            storefront_id=doc["storefront_id"],
            buyer_name=doc.get("shipping_address", {}).get("full_name") or "Unknown Buyer",
            seller_id=user["id"],
            status=OrderStatus(doc["status"]),
            seller_fulfillment_status=FulfillmentStatus(doc.get("fulfillment_status", FulfillmentStatus.unfulfilled)),
            currency=doc["currency"],
            seller_item_count=seller_item_count,
            seller_subtotal=Money(amount_minor=seller_subtotal_minor, currency=doc["currency"]),
            created_at=doc["created_at"],
        ))
    return summaries


@orders_router.get("/seller/{order_id}", response_model=SellerOrderResponse)
async def get_seller_order_detail(
    order_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_only),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key, "seller_id": user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    seller_lines = [line for line in doc.get("lines", []) if line.get("seller_id") == user["id"]]
    seller_shipments = [s for s in doc.get("shipments", []) if s.get("seller_id") == user["id"]]
    seller_line_ids = [line["line_id"] for line in seller_lines]
    seller_cancellations = [c for c in doc.get("cancellations", []) if any(lid in seller_line_ids for lid in c.get("line_item_ids", []))]
    seller_returns = [r for r in doc.get("returns", []) if r.get("seller_id") == user["id"]]

    seller_subtotal_minor = sum(line["subtotal"]["amount_minor"] for line in seller_lines)

    return SellerOrderResponse(
        order_id=doc["id"],
        order_number=doc["order_number"],
        storefront_id=doc["storefront_id"],
        seller_id=user["id"],
        buyer_id=doc["buyer_id"],
        buyer_name=doc.get("buyer_name", "Buyer"),
        status=OrderStatus(doc["status"]),
        payment_status=PaymentStatus(doc["payment_status"]),
        seller_fulfillment_status=FulfillmentStatus(doc.get("fulfillment_status", FulfillmentStatus.unfulfilled)),
        currency=doc["currency"],
        lines=[OrderLineSnapshot(**line) for line in seller_lines],
        shipping_address=ShippingAddress(**doc["shipping_address"]),
        seller_subtotal=Money(amount_minor=seller_subtotal_minor, currency=doc["currency"]),
        seller_shipments=[ShipmentResponse(**s) for s in seller_shipments],
        seller_cancellations=[CancellationResponse(**c) for c in seller_cancellations],
        seller_returns=[ReturnResponse(**r) for r in seller_returns],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@orders_router.post("/seller/{order_id}/shipments/{shipment_id}/transition", response_model=ShipmentResponse)
async def transition_seller_shipment(
    order_id: str,
    shipment_id: str,
    req: FulfillmentTransitionRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_only),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key, "seller_id": user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    shipments = doc.get("shipments", [])
    shipment_idx = next((i for i, s in enumerate(shipments) if s["shipment_id"] == shipment_id and s.get("seller_id") == user["id"]), None)
    if shipment_idx is None:
        raise HTTPException(404, "Shipment not found or access denied")

    shipment = shipments[shipment_idx]
    current_status = FulfillmentStatus(shipment["status"])

    if req.target_status != current_status:
        allowed = ALLOWED_FULFILLMENT_TRANSITIONS.get(current_status, set())
        if req.target_status not in allowed:
            raise HTTPException(400, f"Invalid fulfillment state transition from {current_status.value} to {req.target_status.value}")

    now_str = datetime.now(timezone.utc).isoformat()
    shipment["status"] = req.target_status.value
    if req.carrier_name:
        shipment["carrier_name"] = req.carrier_name
    if req.tracking_number:
        shipment["tracking_number"] = req.tracking_number
    if req.tracking_url:
        shipment["tracking_url"] = req.tracking_url

    if req.target_status == FulfillmentStatus.shipped:
        shipment["shipped_at"] = now_str
    elif req.target_status == FulfillmentStatus.delivered:
        shipment["delivered_at"] = now_str

    events = shipment.get("events", [])
    events.append({
        "event_id": str(uuid.uuid4()),
        "status": req.target_status.value,
        "location": None,
        "description": req.notes or f"Transitioned to {req.target_status.value}",
        "timestamp": now_str,
    })
    shipment["events"] = events
    shipment["updated_at"] = now_str
    shipments[shipment_idx] = shipment

    new_order_status = doc["status"]
    if req.target_status == FulfillmentStatus.shipped:
        new_order_status = OrderStatus.fulfilled.value
    elif req.target_status == FulfillmentStatus.delivered:
        new_order_status = OrderStatus.completed.value
    elif req.target_status == FulfillmentStatus.cancelled:
        new_order_status = OrderStatus.cancelled.value

    updated_lines = []
    for line in doc.get("lines", []):
        if line["line_id"] in shipment["line_item_ids"]:
            line["fulfillment_status"] = req.target_status.value
        updated_lines.append(line)

    await db.orders.update_one(
        {"id": order_id, "storefront_id": context.key, "seller_id": user["id"]},
        {"$set": {
            "shipments": shipments,
            "fulfillment_status": req.target_status.value,
            "status": new_order_status,
            "lines": updated_lines,
            "updated_at": now_str
        }}
    )

    return ShipmentResponse(**shipment)


@orders_router.post("/seller/{order_id}/cancellations/action", response_model=CancellationResponse)
async def action_seller_cancellation(
    order_id: str,
    req: SellerCancellationActionRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_only),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key, "seller_id": user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    cancellations = doc.get("cancellations", [])
    target_idx = next((i for i, c in enumerate(cancellations) if c["status"] == CancellationStatus.requested.value), None)
    if target_idx is None:
        raise HTTPException(400, "No pending cancellation request found")

    cancellation = cancellations[target_idx]
    now_str = datetime.now(timezone.utc).isoformat()

    if req.action == "approve":
        cancellation["status"] = CancellationStatus.approved.value
        cancellation["seller_comment"] = req.comment
        cancellation["updated_at"] = now_str

        updated_lines = []
        for line in doc.get("lines", []):
            if line["line_id"] in cancellation.get("line_item_ids", []):
                line["cancellation_status"] = CancellationStatus.approved.value
                line["fulfillment_status"] = FulfillmentStatus.cancelled.value
            updated_lines.append(line)

        shipments = doc.get("shipments", [])
        for s in shipments:
            s["status"] = FulfillmentStatus.cancelled.value

        await db.orders.update_one(
            {"id": order_id, "storefront_id": context.key, "seller_id": user["id"]},
            {"$set": {
                "cancellations": cancellations,
                "status": OrderStatus.cancelled.value,
                "fulfillment_status": FulfillmentStatus.cancelled.value,
                "lines": updated_lines,
                "shipments": shipments,
                "updated_at": now_str
            }}
        )
    else:
        cancellation["status"] = CancellationStatus.rejected.value
        cancellation["seller_comment"] = req.comment
        cancellation["updated_at"] = now_str

        updated_lines = []
        for line in doc.get("lines", []):
            if line["line_id"] in cancellation.get("line_item_ids", []):
                line["cancellation_status"] = CancellationStatus.rejected.value
            updated_lines.append(line)

        await db.orders.update_one(
            {"id": order_id, "storefront_id": context.key, "seller_id": user["id"]},
            {"$set": {
                "cancellations": cancellations,
                "lines": updated_lines,
                "updated_at": now_str
            }}
        )

    return CancellationResponse(**cancellation)


@orders_router.post("/seller/{order_id}/returns/action", response_model=ReturnResponse)
async def action_seller_return(
    order_id: str,
    req: SellerReturnActionRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_only),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key, "seller_id": user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    returns_list = doc.get("returns", [])
    target_idx = next((i for i, r in enumerate(returns_list) if r.get("seller_id") == user["id"] and r["status"] not in (ReturnStatus.completed.value, ReturnStatus.rejected.value)), None)
    if target_idx is None:
        raise HTTPException(400, "No active return request found")

    ret = returns_list[target_idx]
    current_status = ReturnStatus(ret["status"])
    now_str = datetime.now(timezone.utc).isoformat()

    if req.action == "approve":
        if current_status != ReturnStatus.requested:
            raise HTTPException(400, f"Cannot approve return in status {current_status.value}")
        ret["status"] = ReturnStatus.approved.value
    elif req.action == "reject":
        if current_status != ReturnStatus.requested:
            raise HTTPException(400, f"Cannot reject return in status {current_status.value}")
        ret["status"] = ReturnStatus.rejected.value
    elif req.action == "mark_received":
        if current_status not in (ReturnStatus.approved, ReturnStatus.item_shipped):
            raise HTTPException(400, f"Cannot mark received for return in status {current_status.value}")
        ret["status"] = ReturnStatus.item_received.value
    elif req.action == "issue_refund":
        if current_status not in (ReturnStatus.item_received, ReturnStatus.inspected, ReturnStatus.approved):
            raise HTTPException(400, f"Cannot issue refund for return in status {current_status.value}")
        ret["status"] = ReturnStatus.refund_issued.value
        if req.refund_amount:
            ret["refund_amount"] = req.refund_amount.model_dump()
    else:
        raise HTTPException(400, f"Invalid return action {req.action}")

    if req.comment:
        ret["seller_comment"] = req.comment
    ret["updated_at"] = now_str
    returns_list[target_idx] = ret

    updated_lines = []
    for line in doc.get("lines", []):
        if line["line_id"] == ret["line_item_id"]:
            line["return_status"] = ret["status"]
        updated_lines.append(line)

    await db.orders.update_one(
        {"id": order_id, "storefront_id": context.key, "seller_id": user["id"]},
        {"$set": {
            "returns": returns_list,
            "lines": updated_lines,
            "updated_at": now_str
        }}
    )

    return ReturnResponse(**ret)


# ── Backward Compatibility Helpers ──────────────────────────────────────────

@orders_router.get("/my")
async def legacy_my_orders(
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    return await list_buyer_orders(context, user, db)


@orders_router.get("/{order_id}")
async def legacy_get_order(
    order_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found")
    if user["role"] != "admin" and doc["buyer_id"] != user["id"] and doc.get("seller_id") != user["id"]:
        raise HTTPException(403, "Not your order")

    if user["role"] == "seller" and doc.get("seller_id") == user["id"]:
        return await get_seller_order_detail(order_id, context, user, db)
    return await get_buyer_order_detail(order_id, context, user, db)
