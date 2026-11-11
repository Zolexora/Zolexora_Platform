"""
Canonical Order, Fulfillment, Cancellation, and Returns API router for Zolexora Shop.
Standardized for MR-01E / ADR 0013.
"""

import asyncio
import uuid
from typing import List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from core.config import settings
from core.deps import current_user, is_admin, seller_only, shopper
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
from commerce import coins, orders as order_store
from routers.cart import verify_quote_token, _get_active_product, place_orders, settle

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
    user=Depends(shopper),
    pg_conn=Depends(pg_conn_dep)
):
    if req.idempotency_key:
        lock = _get_idempotency_lock(f"{user['id']}:{req.idempotency_key}")
        async with lock:
            return await _create_order_from_quote_impl(req, context, user, pg_conn)
    return await _create_order_from_quote_impl(req, context, user, pg_conn)


async def _create_order_from_quote_impl(
    req: CreateOrderFromQuoteRequest,
    context: StorefrontContext,
    user: dict,
    pg_conn
):
    # 1. Verify Quote Token
    quote_data = verify_quote_token(req.quote_id, buyer_id=user["id"], storefront_id=context.key)

    # 2. Check Idempotency Key
    if req.idempotency_key:
        existing_orders = await order_store.find(pg_conn, storefront=context.key, buyer_id=user["id"],
                                                 idempotency_key=req.idempotency_key)
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

        p_obj = await _get_active_product(pid, context.key, pg_conn)
        if not p_obj:
            raise HTTPException(409, "A product in your cart is no longer available; review your cart")
        master_pid = pid
        seller_id = p_obj.seller_id
        seller_name = p_obj.seller_name or "Seller"
        title = p_obj.title or "Product"
        image_url = p_obj.images[0] if p_obj.images else None

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

    given = [0, 0, 0]  # shipping, tax, discount allocated so far
    for seller_index, (seller_id, seller_data) in enumerate(snapshots_by_seller.items()):
        order_id = str(uuid.uuid4())
        order_number = f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        s_lines = seller_data["lines"]
        s_subtotal_minor = sum(line.subtotal.amount_minor for line in s_lines)

        if seller_index == num_sellers - 1:  # the last order takes what is left, so the parts add up
            s_shipping, s_tax, s_discount = quote_shipping - given[0], quote_tax - given[1], quote_discount - given[2]
        else:
            ratio = s_subtotal_minor / quote_item_subtotal if quote_item_subtotal > 0 else (1.0 / num_sellers)
            s_shipping = int(quote_shipping * ratio)
            s_tax = int(quote_tax * ratio)
            s_discount = int(quote_discount * ratio)
        given = [given[0] + s_shipping, given[1] + s_tax, given[2] + s_discount]

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

        created_orders.append(order_doc)

    # 5. One PostgreSQL transaction: stock held, quote used once, cart closed, orders stored,
    #    and their ERP events queued with them.
    storefront_key = str(getattr(context.key, "value", context.key))
    async with pg_conn.transaction():
        await place_orders(pg_conn, user["id"], storefront_key, created_orders,
                           quote_signature=req.quote_id.rsplit(".", 1)[1])
        for order_doc in created_orders:
            await sync_to_erp_outbox(pg_conn, "order.created", "order", order_doc["id"], order_doc,
                                     storefront_key=storefront_key)

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
    pg=Depends(pg_conn_dep),
):
    docs = await order_store.find(pg, **{"storefront": context.key, "buyer_id": user["id"]})

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
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, **{"id": order_id, "storefront": context.key, "buyer_id": user["id"]})
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


async def close_cancelled(pg, doc: dict) -> dict:
    """What a cancelled order gives back: its stock goes back on sale, spent coins return, and an
    unpaid payment is voided; a paid one is marked refund due until an admin records the refund.
    Returns the order fields to save. Run inside the caller's transaction."""
    await settle(pg, [doc["id"]], paid=False)
    if doc.get("coins_used"):
        await coins.move(pg, doc["buyer_id"], int(doc["coins_used"]), "refund",
                         f"Order {doc.get('order_number', doc['id'])} cancelled", doc["id"])
    if doc.get("payment_status") == PaymentStatus.paid.value:
        return {"refund_due": True}
    return {"payment_status": PaymentStatus.voided.value}


@orders_router.post("/buyer/{order_id}/cancel", response_model=CancellationResponse)
async def request_buyer_cancellation(
    order_id: str,
    req: CancellationRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, **{"id": order_id, "storefront": context.key, "buyer_id": user["id"]})
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
    if req.line_item_ids and set(req.line_item_ids) != set(all_line_ids):
        # Each order has one seller; it is cancelled whole (totals, coins and refunds stay simple).
        raise HTTPException(400, "Cancel the whole order; single items cannot be cancelled")
    if any(c["status"] == CancellationStatus.requested.value for c in doc.get("cancellations", [])):
        raise HTTPException(409, "A cancellation is already requested")
    target_line_ids = all_line_ids

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

    await order_store.update(pg, order_id, {
            "cancellations": cancellations,
            "lines": updated_lines,
            "updated_at": now_str
        })

    return cancellation


@orders_router.post("/buyer/{order_id}/return", response_model=ReturnResponse)
async def request_buyer_return(
    order_id: str,
    req: ReturnRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, **{"id": order_id, "storefront": context.key, "buyer_id": user["id"]})
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    current_fulfillment = doc.get("fulfillment_status", FulfillmentStatus.unfulfilled.value)
    if current_fulfillment != FulfillmentStatus.delivered.value:
        raise HTTPException(400, "Return requests are only permitted for delivered orders")

    target_line = next((line for line in doc.get("lines", []) if line["line_id"] == req.line_item_id), None)
    if not target_line:
        raise HTTPException(400, f"Line item {req.line_item_id} not found in order")

    already = sum(r["quantity"] for r in doc.get("returns", [])
                  if r.get("line_item_id") == req.line_item_id and r.get("status") != ReturnStatus.rejected.value)
    if already + req.quantity > target_line["quantity"]:
        raise HTTPException(400, f"Only {target_line['quantity'] - already} of this item can still be returned")

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

    await order_store.update(pg, order_id, {
            "returns": returns_list,
            "lines": updated_lines,
            "updated_at": now_str
        })

    return ret_resp


# ── 3. Seller Order Router (/api/orders/seller) ───────────────────────────────

@orders_router.get("/seller", response_model=List[SellerOrderSummaryResponse])
async def list_seller_orders(
    context: StorefrontContext | None = Depends(optional_storefront_context),
    user=Depends(seller_only),
    pg=Depends(pg_conn_dep),
):
    query = {"seller_id": user.get("seller_org_id")}
    if context is not None:
        query["storefront"] = context.key
        
    docs = await order_store.find(pg, **query)

    summaries = []
    for doc in docs:
        seller_lines = [line for line in doc.get("lines", []) if line.get("seller_id") == user.get("seller_org_id")]
        seller_item_count = sum(line.get("quantity", 1) for line in seller_lines)
        seller_subtotal_minor = sum(line["subtotal"]["amount_minor"] for line in seller_lines) if seller_lines else doc["item_subtotal"]["amount_minor"]

        summaries.append(SellerOrderSummaryResponse(
            order_id=doc["id"],
            order_number=doc["order_number"],
            storefront_id=doc["storefront_id"],
            buyer_name=doc.get("shipping_address", {}).get("full_name") or "Unknown Buyer",
            seller_id=user.get("seller_org_id"),
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
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, **{"id": order_id, "storefront": context.key, "seller_id": user.get("seller_org_id")})
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    seller_lines = [line for line in doc.get("lines", []) if line.get("seller_id") == user.get("seller_org_id")]
    seller_shipments = [s for s in doc.get("shipments", []) if s.get("seller_id") == user.get("seller_org_id")]
    seller_line_ids = [line["line_id"] for line in seller_lines]
    seller_cancellations = [c for c in doc.get("cancellations", []) if any(lid in seller_line_ids for lid in c.get("line_item_ids", []))]
    seller_returns = [r for r in doc.get("returns", []) if r.get("seller_id") == user.get("seller_org_id")]

    seller_subtotal_minor = sum(line["subtotal"]["amount_minor"] for line in seller_lines)

    return SellerOrderResponse(
        order_id=doc["id"],
        order_number=doc["order_number"],
        storefront_id=doc["storefront_id"],
        seller_id=user.get("seller_org_id"),
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
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, **{"id": order_id, "storefront": context.key, "seller_id": user.get("seller_org_id")})
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    shipments = doc.get("shipments", [])
    shipment_idx = next((i for i, s in enumerate(shipments) if s["shipment_id"] == shipment_id and s.get("seller_id") == user.get("seller_org_id")), None)
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

    async with pg.transaction():
        cancelled = req.target_status == FulfillmentStatus.cancelled and doc.get("status") != OrderStatus.cancelled.value
        await order_store.update(pg, order_id, {
            "shipments": shipments,
            "fulfillment_status": req.target_status.value,
            "status": new_order_status,
            "lines": updated_lines,
            **(await close_cancelled(pg, doc) if cancelled else {}),
        })

    return ShipmentResponse(**shipment)


@orders_router.post("/seller/{order_id}/cancellations/action", response_model=CancellationResponse)
async def action_seller_cancellation(
    order_id: str,
    req: SellerCancellationActionRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_only),
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, **{"id": order_id, "storefront": context.key, "seller_id": user.get("seller_org_id")})
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

        async with pg.transaction():
            await order_store.update(pg, order_id, {
                "cancellations": cancellations,
                "status": OrderStatus.cancelled.value,
                "fulfillment_status": FulfillmentStatus.cancelled.value,
                "lines": updated_lines,
                "shipments": shipments,
                **await close_cancelled(pg, doc),
            })
    else:
        cancellation["status"] = CancellationStatus.rejected.value
        cancellation["seller_comment"] = req.comment
        cancellation["updated_at"] = now_str

        updated_lines = []
        for line in doc.get("lines", []):
            if line["line_id"] in cancellation.get("line_item_ids", []):
                line["cancellation_status"] = CancellationStatus.rejected.value
            updated_lines.append(line)

        await order_store.update(pg, order_id, {
                "cancellations": cancellations,
                "lines": updated_lines,
                "updated_at": now_str
            })

    return CancellationResponse(**cancellation)


@orders_router.post("/seller/{order_id}/returns/action", response_model=ReturnResponse)
async def action_seller_return(
    order_id: str,
    req: SellerReturnActionRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_only),
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, **{"id": order_id, "storefront": context.key, "seller_id": user.get("seller_org_id")})
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    returns_list = doc.get("returns", [])
    target_idx = next((i for i, r in enumerate(returns_list) if r.get("seller_id") == user.get("seller_org_id") and r["status"] not in (ReturnStatus.completed.value, ReturnStatus.rejected.value)), None)
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

    await order_store.update(pg, order_id, {
            "returns": returns_list,
            "lines": updated_lines,
            "updated_at": now_str
        })

    return ReturnResponse(**ret)


@orders_router.put("/{order_id}/status")
async def update_order_status(order_id:str,status:str,user=Depends(seller_only), context: StorefrontContext=Depends(require_storefront_context),
                              pg=Depends(pg_conn_dep)):
    # The portal's simple statuses, as order status and fulfilment status.
    states = {"processing": ("processing", "processing"), "shipped": ("fulfilled", "shipped"),
              "delivered": ("completed", "delivered"), "cancelled": ("cancelled", "cancelled")}
    if status not in states:
        raise HTTPException(400,"Invalid status")
    async with pg.transaction():
        ids = await order_store.update_many(
            pg, {"status": states[status][0], "fulfillment_status": states[status][1]},
            id=order_id, storefront=context.key, seller_id=None if is_admin(user) else user["seller_org_id"])
        if not ids: raise HTTPException(404,"Order not found or access denied")
        if status == "cancelled":
            await settle(pg, ids, paid=False)  # its stock goes back on sale
    return {"message":"Status updated"}


# ── Backward Compatibility Helpers ──────────────────────────────────────────

# The storefront and seller apps show orders in a simple shape: a five-step status, rupee
# amounts, `items` and flat delivery fields. These routes serve that view of the stored order
# (which keeps its full status as `order_status`); /orders/buyer and /orders/seller are the
# detailed API.

def portal_status(doc: dict) -> str:
    status, fulfilment = doc.get("status"), doc.get("fulfillment_status")
    if status in ("cancelled", "partially_cancelled"):
        return "cancelled"
    if status == "completed" or fulfilment == "delivered":
        return "delivered"
    if status == "fulfilled" or fulfilment in ("shipped", "out_for_delivery"):
        return "shipped"
    if status in ("processing", "paid", "partially_fulfilled") or fulfilment == "processing":
        return "processing"
    return "pending"


def portal_order(doc: dict) -> dict:
    rupees = lambda money: (money or {}).get("amount_minor", 0) / 100  # noqa: E731
    address = doc.get("shipping_address") or {}
    items = [{"id": line.get("line_id"), "product_id": line.get("product_id"),
              "product_title": line.get("title") or line.get("product_title"),
              "title": line.get("title") or line.get("product_title"),
              "quantity": line.get("quantity", 1), "price": rupees(line.get("unit_price")),
              "image": line.get("image_url")} for line in doc.get("lines", [])]
    return {
        **doc, "status": portal_status(doc), "order_status": doc.get("status"), "items": items,
        "subtotal": rupees(doc.get("item_subtotal")), "total_paid": rupees(doc.get("grand_total")),
        "coins_discount": (doc.get("coins_used") or 0) * settings.COIN_VALUE,
        "buyer_name": doc.get("buyer_name") or address.get("full_name") or "",
        "delivery_name": address.get("full_name", ""), "delivery_phone": address.get("phone", ""),
        "delivery_email": address.get("email", ""),
        "delivery_address": ", ".join(filter(None, (address.get("address_line1"), address.get("address_line2")))),
        "delivery_city": address.get("city", ""), "delivery_state": address.get("state", ""),
        "delivery_pincode": address.get("postal_code", ""),
    }


@orders_router.get("/my")
async def legacy_my_orders(
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    pg=Depends(pg_conn_dep),
):
    """The caller's orders on this storefront, newest first."""
    return [portal_order(d) for d in await order_store.find(pg, buyer_id=user["id"], storefront=context.key, limit=100)]


@orders_router.get("/sales")
async def legacy_seller_orders(
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_only),
    pg=Depends(pg_conn_dep),
):
    """The orders of the caller's organisation on this storefront (every order for an admin)."""
    if not is_admin(user) and not user.get("seller_org_id"):
        return []
    org = None if is_admin(user) else user["seller_org_id"]
    return [portal_order(d) for d in await order_store.find(pg, seller_id=org, storefront=context.key)]


@orders_router.get("/{order_id}")
async def legacy_get_order(
    order_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, **{"id": order_id, "storefront": context.key})
    if not doc:
        raise HTTPException(404, "Order not found")
    if not is_admin(user) and doc["buyer_id"] != user["id"] and (not user.get("seller_org_id") or doc.get("seller_id") != user["seller_org_id"]):
        raise HTTPException(403, "Not your order")
    return portal_order(doc)
