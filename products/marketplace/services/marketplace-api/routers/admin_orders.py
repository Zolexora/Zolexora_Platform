"""
Canonical Admin Orders API router for Zolexora Marketplace.
Standardized for MR-01E / ADR 0013.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.deps import db_dep, admin_only
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
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    docs = await db.orders.find(
        {"storefront_id": context.key},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)

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
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    doc = await db.orders.find_one(
        {"id": order_id, "storefront_id": context.key},
        {"_id": 0}
    )
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



