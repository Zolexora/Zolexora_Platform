import secrets
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from catalog import store as catalog_store
from commerce import coins
from commerce import orders as order_store
from content import reels as reel_store
from routers.products import _invalidate_catalog_cache
from routers.cart import settle
from shared.database.postgres import pg_conn_dep
from core.deps import current_user, admin_only, require_permission
from core.config import settings
from core.payments import create_razorpay_order
from users.repositories import UserRepository, get_user_repository

from storefronts.dependencies import optional_storefront_context
from storefronts.models import StorefrontContext



# ── Coins ─────────────────────────────────────────────────────────────────────
coins_router = APIRouter(prefix="/coins", tags=["coins"])

@coins_router.get("/balance")
async def coin_balance(user=Depends(current_user)):
    return {"coin_balance":user.get("coin_balance",0)}

@coins_router.get("/history")
async def coin_history(user=Depends(current_user),pg=Depends(pg_conn_dep)):
    return await coins.history(pg, user["id"])

class DiscountReq(BaseModel):
    coins_to_spend:int; product_id:Optional[str]=None

TIERS=[{"coins":50,"percent":10},{"coins":100,"percent":20},{"coins":200,"percent":30}]

@coins_router.post("/generate-discount")
async def generate_discount(
    req:DiscountReq,
    user=Depends(current_user),
    pg=Depends(pg_conn_dep),
):
    tier = next((t for t in TIERS if t["coins"]==req.coins_to_spend),None)
    if not tier: raise HTTPException(400,f"Valid: {[t['coins'] for t in TIERS]}")
    if user.get("coin_balance",0)<tier["coins"]: raise HTTPException(400,"Insufficient coins")
    discount = {"id":str(uuid.uuid4()),"user_id":user["id"],"code":secrets.token_hex(4).upper(),
                "discount_percent":tier["percent"],"coins_spent":tier["coins"],
                "is_used":False,"product_id":req.product_id,
                "created_at":datetime.now(timezone.utc).isoformat()}
    async with pg.transaction():  # the coins are spent only if the code is stored
        await coins.move(pg, user["id"], -tier["coins"], "spent", f"Generated {tier['percent']}% discount code", discount["id"])
        await pg.execute(
            """INSERT INTO coin_discount_code (id, user_id, code, discount_percent, coins_spent, product_id)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            uuid.UUID(discount["id"]), uuid.UUID(user["id"]), discount["code"], tier["percent"], tier["coins"], req.product_id)
    return discount

@coins_router.get("/discounts")
async def my_discounts(user=Depends(current_user),pg=Depends(pg_conn_dep)):
    rows = await pg.fetch("""SELECT id, user_id, code, discount_percent, coins_spent, is_used, product_id, created_at
                             FROM coin_discount_code WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50""", uuid.UUID(user["id"]))
    return [{**dict(r), "id": str(r["id"]), "user_id": str(r["user_id"]), "created_at": r["created_at"].isoformat()} for r in rows]


# ── Subscriptions ─────────────────────────────────────────────────────────────
subs_router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

@subs_router.get("/plans")
async def get_plans(): return settings.SUBSCRIPTION_PLANS

class SubReq(BaseModel): plan_type:str

@subs_router.post("/checkout")
async def sub_checkout(req:SubReq,user=Depends(current_user),pg=Depends(pg_conn_dep)):
    if req.plan_type not in settings.SUBSCRIPTION_PLANS: raise HTTPException(400,"Invalid plan")
    if not settings.RAZORPAY_KEY_ID: raise HTTPException(503,"Payment gateway not configured")
    plan = settings.SUBSCRIPTION_PLANS[req.plan_type]
    rz_order = create_razorpay_order({"amount":int(plan["price"]*100),"currency":"INR",
        "notes":{"user_id":user["id"],"plan_type":req.plan_type,"type":"subscription"}})
    await pg.execute("""INSERT INTO subscription_payment (id, user_id, razorpay_order_id, plan_type, amount_minor)
                        VALUES ($1, $2, $3, $4, $5)""",
                     uuid.uuid4(), uuid.UUID(user["id"]), rz_order["id"], req.plan_type, int(plan["price"]*100))
    return {"razorpay_order_id":rz_order["id"],"amount":plan["price"],"key_id":settings.RAZORPAY_KEY_ID}


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
        "total_reels":              await reel_store.count(pg, storefront=key),
        "sponsored_reels":          await reel_store.count(pg, storefront=key, content_type="sponsored"),
        "total_orders":             await order_store.count(pg, storefront=key),
        "paid_orders":              await order_store.count(pg, storefront=key, payment_status="paid"),
        "pending_upi_verification": await order_store.count(pg, storefront=key, payment_status="awaiting_verification"),
        "total_reel_views":         await reel_store.view_count(pg, storefront=key),
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

@admin_router.get("/reels")
async def admin_reels(u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), pg=Depends(pg_conn_dep)):
    return await reel_store.find(pg, storefront=context.key if context else None)

@admin_router.put("/reels/{rid}/toggle")
async def admin_toggle_reel(rid:str,u=Depends(require_permission("content:write")), context: Optional[StorefrontContext] = Depends(optional_storefront_context), pg=Depends(pg_conn_dep)):
    active = await reel_store.toggle(pg, id=rid, storefront=context.key if context else None)
    if active is None: raise HTTPException(404)
    return {"is_active":active}

@admin_router.delete("/reels/{rid}")
async def admin_delete_reel(rid:str,u=Depends(require_permission("content:write")), context: Optional[StorefrontContext] = Depends(optional_storefront_context), pg=Depends(pg_conn_dep)):
    await reel_store.delete(pg, id=rid, storefront=context.key if context else None); return {"message":"Deleted"}

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
    checkout_orders = await order_store.find(pg, storefront=sf_key, **checkout)
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
        coins_used = sum(o.get("coins_used",0) for o in checkout_orders)
        async with pg.transaction():
            ids = await order_store.update_many(pg, {
                "payment_status":"failed","status":"cancelled",
                "admin_note":req.admin_note or "Payment not verified"}, storefront=sf_key, **checkout)
            await settle(pg, ids, paid=False)
            # Coins were spent when the order was placed; a rejected payment gives them back.
            if coins_used > 0:
                await coins.move(pg, order["buyer_id"], coins_used, "refund",
                                 f"Order {order.get('order_number', order_id)} payment rejected", order_id)
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
        "coins_orders_30d":      await order_store.count(pg, storefront=key, payment_method="coins", payment_status="paid", since=d30_dt),
        "reel_views_30d":        await reel_store.view_count(pg, storefront=key, since=d30_dt),
        "coins_earned_30d":      await coins.earned_count(pg, since=d30_dt),
        "pending_upi_verify":    await order_store.count(pg, storefront=key, payment_status="awaiting_verification"),
    }
