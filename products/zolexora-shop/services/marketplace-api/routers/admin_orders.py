"""
Canonical Admin Orders API router for Zolexora Shop.
Standardized for MR-01E / ADR 0013.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from commerce import orders as order_store
from core.deps import admin_only, require_permission
from shared.database.postgres import pg_conn_dep
from storefronts.dependencies import require_storefront_context
from storefronts.models import StorefrontContext
from models.primitives import Money
from models.orders import (
    OrderStatus, FulfillmentStatus, PaymentStatus,
    OrderLineSnapshot, ShippingAddress, ShipmentResponse,
    CancellationResponse, ReturnResponse,
    AdminOrderSummaryResponse, AdminOrderResponse,
)

admin_orders_router = APIRouter(prefix="/orders/admin", tags=["admin-orders"])


@admin_orders_router.get("", response_model=List[AdminOrderSummaryResponse])
async def list_admin_orders(
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(admin_only),
    pg=Depends(pg_conn_dep),
):
    docs = await order_store.find(pg, storefront=context.key, limit=500)

    summaries = []
    for doc in docs:
        seller_ids = doc.get("seller_ids") or ([doc.get("seller_id")] if doc.get("seller_id") else [])
        summaries.append(AdminOrderSummaryResponse(
            order_id=doc["id"],
            order_number=doc["order_number"],
            storefront_id=doc["storefront_id"],
            buyer_id=doc["buyer_id"],
            seller_ids=[s for s in seller_ids if s],
            status=OrderStatus(doc["status"]),
            payment_status=PaymentStatus(doc["payment_status"]),
            fulfillment_status=FulfillmentStatus(doc.get("fulfillment_status", FulfillmentStatus.unfulfilled)),
            currency=doc["currency"],
            grand_total=Money(**doc["grand_total"]),
            created_at=doc["created_at"],
        ))
    return summaries


@admin_orders_router.get("/{order_id}", response_model=AdminOrderResponse)
async def get_admin_order_detail(
    order_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(admin_only),
    pg=Depends(pg_conn_dep),
):
    doc = await order_store.get(pg, id=order_id, storefront=context.key)
    if not doc:
        raise HTTPException(404, "Order not found or access denied")

    seller_ids = doc.get("seller_ids") or ([doc.get("seller_id")] if doc.get("seller_id") else [])

    return AdminOrderResponse(
        order_id=doc["id"],
        order_number=doc["order_number"],
        storefront_id=doc["storefront_id"],
        buyer_id=doc["buyer_id"],
        seller_ids=[s for s in seller_ids if s],
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
        admin_notes=doc.get("admin_notes", []),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )





class RefundRecorded(BaseModel):
    reference: str = Field(..., min_length=3, max_length=128, description="Bank, UPI or gateway refund reference")


@admin_orders_router.post("/{order_id}/refunded")
async def record_refund(
    order_id: str,
    req: RefundRecorded,
    context: StorefrontContext = Depends(require_storefront_context),
    admin=Depends(require_permission("orders:write")),
    pg=Depends(pg_conn_dep),
):
    """Records that the money of a cancelled, paid order was paid back to the buyer."""
    doc = await order_store.get(pg, id=order_id, storefront=context.key)
    if not doc:
        raise HTTPException(404, "Order not found")
    if not doc.get("refund_due"):
        raise HTTPException(400, "No refund is due on this order")
    await order_store.update(pg, order_id, {"payment_status": PaymentStatus.refunded.value, "refund_due": False,
                                            "refund_reference": req.reference, "refunded_by": admin["id"]})
    return {"order_id": order_id, "payment_status": PaymentStatus.refunded.value}
