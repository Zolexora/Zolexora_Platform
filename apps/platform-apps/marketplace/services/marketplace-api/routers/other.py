from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from catalog import store as catalog_store
from commerce import orders as order_store
from routers.products import _invalidate_catalog_cache
from routers.cart import settle
from shared.database.postgres import pg_conn_dep
from core.deps import admin_only, require_permission
from users.repositories import UserRepository, get_user_repository

from storefronts.dependencies import optional_storefront_context
from storefronts.models import StorefrontContext



# ── Admin ─────────────────────────────────────────────────────────────────────
admin_router = APIRouter(prefix="/admin", tags=["admin"])

@admin_router.get("/stats")
async def admin_stats(
    u=Depends(admin_only),
    context: Optional[StorefrontContext] = Depends(optional_storefront_context),
    user_repo:UserRepository=Depends(get_user_repository),
    pg=Depends(pg_conn_dep),
):
    key = context.key.value if context else None
    return {
        "total_users":              await user_repo.count_users(),
        **await catalog_store.listing_counts(pg, context.key.value if context else None),
        "total_orders":             await order_store.count(pg, storefront=key),
        "paid_orders":              await order_store.count(pg, storefront=key, payment_status="paid"),
        "pending_upi_verification": await order_store.count(pg, storefront=key, payment_status="awaiting_verification"),
        "pending_orders":           await order_store.count(pg, storefront=key, status="placed"),
    }

@admin_router.get("/users")
async def admin_users(
    u=Depends(require_permission("users:read")),
    user_repo:UserRepository=Depends(get_user_repository),
):
    return await user_repo.list_users(limit=1000)

@admin_router.put("/users/{uid}/toggle")
async def admin_toggle_user(
    uid:str,
    u=Depends(require_permission("users:write")),
    user_repo:UserRepository=Depends(get_user_repository),
):
    doc = await user_repo.get_by_id(uid)
    if not doc: raise HTTPException(404)
    await user_repo.set_active(uid, not doc["is_active"])
    return {"is_active":not doc["is_active"]}

@admin_router.get("/products", include_in_schema=False)
async def admin_products(u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context),
                         pg=Depends(pg_conn_dep)):
    return await catalog_store.all_listings(pg, context.key.value if context else None)

@admin_router.put("/products/{pid}/toggle", include_in_schema=False)
async def admin_toggle_product(pid:str,u=Depends(require_permission("catalog:write")), context: Optional[StorefrontContext] = Depends(optional_storefront_context),
                               pg=Depends(pg_conn_dep)):
    state = await pg.fetchval(
        """UPDATE storefront_listing l SET publication_state = CASE WHEN l.publication_state = 'PUBLISHED' THEN 'HIDDEN' ELSE 'PUBLISHED' END,
                  updated_at = now()
           FROM storefront s WHERE s.id = l.storefront_id AND l.id = $1 AND ($2::text IS NULL OR s.storefront_key = $2)
           RETURNING l.publication_state""",
        catalog_store._uuid(pid), context.key.value if context else None,
    ) if catalog_store._uuid(pid) else None
    if not state: raise HTTPException(404)
    _invalidate_catalog_cache()
    return {"is_active": state == "PUBLISHED"}

@admin_router.delete("/products/{pid}", include_in_schema=False)
async def admin_delete_product(pid:str,u=Depends(require_permission("catalog:write")), context: Optional[StorefrontContext] = Depends(optional_storefront_context),
                               pg=Depends(pg_conn_dep)):
    listing = await catalog_store.find_listing(pg, pid, None, context.key.value if context else None)
    if not listing or str(listing["id"]) != pid:
        raise HTTPException(404, "Product not found")
    await catalog_store.remove_listing(pg, listing["id"])
    _invalidate_catalog_cache()
    return {"message":"Deleted"}

@admin_router.get("/orders")
async def admin_orders(u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), pg=Depends(pg_conn_dep)):
    return await order_store.find(pg, storefront=context.key if context else None, limit=500)

# ── UPI verification ──────────────────────────────────────────────────────────
@admin_router.get("/orders/pending-upi")
async def pending_upi(u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), pg=Depends(pg_conn_dep)):
    return await order_store.find(pg, payment_method="upi", payment_status="awaiting_verification",
                                  storefront=context.key if context else None, limit=500)

class UPIVerifyReq(BaseModel):
    approve:bool; admin_note:Optional[str]=None

@admin_router.put("/orders/{order_id}/verify-upi")
async def verify_upi(
    order_id:str,
    req:UPIVerifyReq,
    u=Depends(require_permission("orders:write")),
    context: Optional[StorefrontContext] = Depends(optional_storefront_context),
    pg=Depends(pg_conn_dep),
):
    sf_key = context.key.value if context else None
    order = await order_store.get(pg, id=order_id, storefront=sf_key)
    if not order: raise HTTPException(404,"Order not found")
    if order.get("payment_method")!="upi": raise HTTPException(400,"Not a UPI order")
    if order.get("payment_status") not in ("awaiting_verification","pending"):
        raise HTTPException(400,f"Cannot verify — current status: {order.get('payment_status')}")
    checkout = {"checkout_id": order["checkout_id"]} if order.get("checkout_id") else {"id": order_id}
    now = datetime.now(timezone.utc).isoformat()
    if req.approve:
        async with pg.transaction():
            ids = await order_store.update_many(pg, {
                "payment_status":"paid","status":"processing",
                "upi_verified_by":u["id"],"upi_verified_at":now,
                "admin_note":req.admin_note}, storefront=sf_key, **checkout)
            await settle(pg, ids, paid=True)
        return {"message":"Payment approved ✓","order_id":order_id,"status":"processing"}
    else:
        async with pg.transaction():
            ids = await order_store.update_many(pg, {
                "payment_status":"failed","status":"cancelled",
                "admin_note":req.admin_note or "Payment not verified"}, storefront=sf_key, **checkout)
            await settle(pg, ids, paid=False)
        return {"message":"Payment rejected ✗","order_id":order_id,"status":"cancelled"}

@admin_router.get("/analytics")
async def admin_analytics(
    u=Depends(admin_only),
    context: Optional[StorefrontContext] = Depends(optional_storefront_context),
    user_repo:UserRepository=Depends(get_user_repository),
    pg=Depends(pg_conn_dep),
):
    key = context.key.value if context else None
    now=datetime.now(timezone.utc)
    d30_dt=now-timedelta(days=30); d7_dt=now-timedelta(days=7)
    return {
        "new_users_30d":         await user_repo.count_users(created_since=d30_dt),
        "new_users_7d":          await user_repo.count_users(created_since=d7_dt),
        "orders_30d":            await order_store.count(pg, storefront=key, since=d30_dt),
        "orders_7d":             await order_store.count(pg, storefront=key, since=d7_dt),
        "razorpay_orders_30d":   await order_store.count(pg, storefront=key, payment_method="razorpay", payment_status="paid", since=d30_dt),
        "upi_orders_30d":        await order_store.count(pg, storefront=key, payment_method="upi", payment_status="paid", since=d30_dt),
        "pending_upi_verify":    await order_store.count(pg, storefront=key, payment_status="awaiting_verification"),
    }
