import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.deps import db_dep, current_user, admin_only
from core.config import settings
from core.payments import create_razorpay_order
from models.documents import CoinTxDoc
from users.repositories import UserRepository, get_user_repository

from storefronts.dependencies import optional_storefront_context, require_storefront_context
from storefronts.models import StorefrontContext

# ── Orders ────────────────────────────────────────────────────────────────────
orders_router = APIRouter(prefix="/orders", tags=["orders"])

@orders_router.get("/my")
async def my_orders(user=Depends(current_user), context: StorefrontContext=Depends(require_storefront_context), db=Depends(db_dep)):
    return await db.orders.find({"buyer_id":user["id"], "storefront_id": context.key},{"_id":0}).sort("created_at",-1).to_list(100)

@orders_router.get("/seller")
async def seller_orders(user=Depends(current_user), context: StorefrontContext=Depends(require_storefront_context), db=Depends(db_dep)):
    if user["role"] not in ("seller","admin"): raise HTTPException(403,"Sellers only")
    q = {"storefront_id": context.key} if user["role"]=="admin" else {"seller_id":user["id"], "storefront_id": context.key}
    return await db.orders.find(q,{"_id":0}).sort("created_at",-1).to_list(200)

@orders_router.get("/{order_id}")
async def get_order(order_id:str, user=Depends(current_user), context: StorefrontContext=Depends(require_storefront_context), db=Depends(db_dep)):
    order = await db.orders.find_one({"id":order_id, "storefront_id": context.key},{"_id":0})
    if not order: raise HTTPException(404,"Order not found")
    if user["role"]!="admin" and order["buyer_id"]!=user["id"] and order.get("seller_id")!=user["id"]:
        raise HTTPException(403,"Not your order")
    
    # If order is pending and has a cashfree order id, auto-sync payment status
    if order.get("payment_status") != "paid" and (order.get("cashfree_order_id") or order.get("payment_method") == "cashfree"):
        cf_id = order.get("cashfree_order_id") or order.get("id")
        from core.payments import get_cashfree_order
        try:
            cf_info = await get_cashfree_order(cf_id)
            if cf_info.get("order_status") == "PAID":
                await db.orders.update_one(
                    {"id": order_id, "storefront_id": context.key},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                order["payment_status"] = "paid"
        except Exception:
            pass

    return order

@orders_router.put("/{order_id}/status")
async def update_order_status(order_id:str,status:str,user=Depends(current_user), context: StorefrontContext=Depends(require_storefront_context), db=Depends(db_dep)):
    if status not in ("processing","shipped","delivered","cancelled"):
        raise HTTPException(400,"Invalid status")
    fq = {"id":order_id, "storefront_id": context.key} if user["role"]=="admin" else {"id":order_id,"seller_id":user["id"], "storefront_id": context.key}
    r = await db.orders.update_one(fq,{"$set":{"status":status,"updated_at":datetime.now(timezone.utc).isoformat()}})
    if r.matched_count==0: raise HTTPException(404,"Order not found or access denied")
    return {"message":"Status updated"}


# ── Coins ─────────────────────────────────────────────────────────────────────
coins_router = APIRouter(prefix="/coins", tags=["coins"])

@coins_router.get("/balance")
async def coin_balance(user=Depends(current_user)):
    return {"coin_balance":user.get("coin_balance",0)}

@coins_router.get("/history")
async def coin_history(user=Depends(current_user),db=Depends(db_dep)):
    return await db.coin_transactions.find({"user_id":user["id"]},{"_id":0}).sort("created_at",-1).to_list(100)

class DiscountReq(BaseModel):
    coins_to_spend:int; product_id:Optional[str]=None

TIERS=[{"coins":50,"percent":10},{"coins":100,"percent":20},{"coins":200,"percent":30}]

@coins_router.post("/generate-discount")
async def generate_discount(
    req:DiscountReq,
    user=Depends(current_user),
    db=Depends(db_dep),
    user_repo:UserRepository=Depends(get_user_repository),
):
    tier = next((t for t in TIERS if t["coins"]==req.coins_to_spend),None)
    if not tier: raise HTTPException(400,f"Valid: {[t['coins'] for t in TIERS]}")
    if user.get("coin_balance",0)<tier["coins"]: raise HTTPException(400,"Insufficient coins")
    code = str(uuid.uuid4())[:8].upper()
    discount = {"id":str(uuid.uuid4()),"user_id":user["id"],"code":code,
                "discount_percent":tier["percent"],"coins_spent":tier["coins"],
                "is_used":False,"product_id":req.product_id,
                "created_at":datetime.now(timezone.utc).isoformat()}
    await db.discount_codes.insert_one(discount)
    await user_repo.adjust_coin_balance(user["id"], -tier["coins"])
    await db.coin_transactions.insert_one(CoinTxDoc(user_id=user["id"],amount=-tier["coins"],type="spent",
        description=f"Generated {tier['percent']}% discount code").model_dump())
    discount.pop("_id",None); return discount

@coins_router.get("/discounts")
async def my_discounts(user=Depends(current_user),db=Depends(db_dep)):
    return await db.discount_codes.find({"user_id":user["id"]},{"_id":0}).sort("created_at",-1).to_list(50)


# ── Subscriptions ─────────────────────────────────────────────────────────────
subs_router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

@subs_router.get("/plans")
async def get_plans(): return settings.SUBSCRIPTION_PLANS

class SubReq(BaseModel): plan_type:str

@subs_router.post("/checkout")
async def sub_checkout(req:SubReq,user=Depends(current_user),db=Depends(db_dep)):
    if req.plan_type not in settings.SUBSCRIPTION_PLANS: raise HTTPException(400,"Invalid plan")
    if not settings.RAZORPAY_KEY_ID: raise HTTPException(503,"Payment gateway not configured")
    plan = settings.SUBSCRIPTION_PLANS[req.plan_type]
    rz_order = create_razorpay_order({"amount":int(plan["price"]*100),"currency":"INR",
        "notes":{"user_id":user["id"],"plan_type":req.plan_type,"type":"subscription"}})
    await db.payment_transactions.insert_one({"id":str(uuid.uuid4()),"user_id":user["id"],
        "razorpay_order_id":rz_order["id"],"amount":plan["price"],"plan_type":req.plan_type,
        "status":"pending","created_at":datetime.now(timezone.utc).isoformat()})
    return {"razorpay_order_id":rz_order["id"],"amount":plan["price"],"key_id":settings.RAZORPAY_KEY_ID}


# ── Admin ─────────────────────────────────────────────────────────────────────
admin_router = APIRouter(prefix="/admin", tags=["admin"])

@admin_router.get("/stats")
async def admin_stats(
    u=Depends(admin_only),
    context: Optional[StorefrontContext] = Depends(optional_storefront_context),
    db=Depends(db_dep),
    user_repo:UserRepository=Depends(get_user_repository),
):
    sf = {"storefront_id": context.key.value} if context else {}
    return {
        "total_users":              await user_repo.count_users(),
        "viewers":                  await user_repo.count_users(role="viewer"),
        "sellers":                  await user_repo.count_users(role="seller"),
        "total_products":           await db.storefront_listings.count_documents(sf),
        "active_products":          await db.storefront_listings.count_documents({**sf, "is_active":True}),
        "total_reels":              await db.reels.count_documents(sf),
        "sponsored_reels":          await db.reels.count_documents({**sf, "content_type":"sponsored"}),
        "total_orders":             await db.orders.count_documents(sf),
        "paid_orders":              await db.orders.count_documents({**sf, "payment_status":"paid"}),
        "pending_upi_verification": await db.orders.count_documents({**sf, "payment_status":"awaiting_verification"}),
        "total_reel_views":         await db.reel_views.count_documents(sf),
        "pending_orders":           await db.orders.count_documents({**sf, "status":"pending"}),
    }

@admin_router.get("/users")
async def admin_users(
    u=Depends(admin_only),
    user_repo:UserRepository=Depends(get_user_repository),
):
    return await user_repo.list_users(limit=1000)

@admin_router.put("/users/{uid}/role")
async def admin_set_role(
    uid:str,
    role:str,
    u=Depends(admin_only),
    user_repo:UserRepository=Depends(get_user_repository),
):
    if role not in ("admin","seller","buyer"): raise HTTPException(400,"Invalid role")
    if not await user_repo.set_role(uid, role): raise HTTPException(404,"User not found")
    return {"message":"Updated"}

@admin_router.put("/users/{uid}/toggle")
async def admin_toggle_user(
    uid:str,
    u=Depends(admin_only),
    user_repo:UserRepository=Depends(get_user_repository),
):
    doc = await user_repo.get_by_id(uid)
    if not doc: raise HTTPException(404)
    await user_repo.set_active(uid, not doc["is_active"])
    return {"is_active":not doc["is_active"]}

@admin_router.get("/products", include_in_schema=False)
async def admin_products(u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), db=Depends(db_dep)):
    sf = {"storefront_id": context.key.value} if context else {}
    return await db.storefront_listings.find(sf,{"_id":0}).sort("created_at",-1).to_list(500)

@admin_router.put("/products/{pid}/toggle", include_in_schema=False)
async def admin_toggle_product(pid:str,u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), db=Depends(db_dep)):
    sf = {"storefront_id": context.key.value} if context else {}
    p = await db.storefront_listings.find_one({"id":pid, **sf})
    if not p: raise HTTPException(404)
    await db.storefront_listings.update_one({"id":pid, **sf},{"$set":{"is_active":not p["is_active"]}})
    return {"is_active":not p["is_active"]}

@admin_router.delete("/products/{pid}", include_in_schema=False)
async def admin_delete_product(pid:str,u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), db=Depends(db_dep)):
    sf = {"storefront_id": context.key.value} if context else {}
    r = await db.storefront_listings.delete_one({"id":pid, **sf})
    if r.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"message":"Deleted"}

@admin_router.get("/reels")
async def admin_reels(u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), db=Depends(db_dep)):
    sf = {"storefront_id": context.key.value} if context else {}
    return await db.reels.find(sf,{"_id":0}).sort("created_at",-1).to_list(500)

@admin_router.put("/reels/{rid}/toggle")
async def admin_toggle_reel(rid:str,u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), db=Depends(db_dep)):
    sf = {"storefront_id": context.key.value} if context else {}
    r = await db.reels.find_one({"id":rid, **sf})
    if not r: raise HTTPException(404)
    await db.reels.update_one({"id":rid, **sf},{"$set":{"is_active":not r["is_active"]}})
    return {"is_active":not r["is_active"]}

@admin_router.delete("/reels/{rid}")
async def admin_delete_reel(rid:str,u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), db=Depends(db_dep)):
    sf = {"storefront_id": context.key.value} if context else {}
    await db.reels.delete_one({"id":rid, **sf}); return {"message":"Deleted"}

@admin_router.get("/orders")
async def admin_orders(u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), db=Depends(db_dep)):
    sf = {"storefront_id": context.key.value} if context else {}
    return await db.orders.find(sf,{"_id":0}).sort("created_at",-1).to_list(500)

# ── UPI verification ──────────────────────────────────────────────────────────
@admin_router.get("/orders/pending-upi")
async def pending_upi(u=Depends(admin_only), context: Optional[StorefrontContext] = Depends(optional_storefront_context), db=Depends(db_dep)):
    sf = {"storefront_id": context.key.value} if context else {}
    return await db.orders.find(
        {"payment_method":"upi","payment_status":"awaiting_verification", **sf},
        {"_id":0}).sort("created_at",-1).to_list(500)

class UPIVerifyReq(BaseModel):
    approve:bool; admin_note:Optional[str]=None

@admin_router.put("/orders/{order_id}/verify-upi")
async def verify_upi(
    order_id:str,
    req:UPIVerifyReq,
    u=Depends(admin_only),
    context: Optional[StorefrontContext] = Depends(optional_storefront_context),
    db=Depends(db_dep),
    user_repo:UserRepository=Depends(get_user_repository),
):
    sf = {"storefront_id": context.key.value} if context else {}
    order = await db.orders.find_one({"id":order_id, **sf})
    if not order: raise HTTPException(404,"Order not found")
    if order.get("payment_method")!="upi": raise HTTPException(400,"Not a UPI order")
    if order.get("payment_status") not in ("awaiting_verification","pending"):
        raise HTTPException(400,f"Cannot verify — current status: {order.get('payment_status')}")
    checkout_filter = {"checkout_id":order["checkout_id"], **sf} if order.get("checkout_id") else {"id":order_id, **sf}
    checkout_orders = await db.orders.find(checkout_filter,{"_id":0}).to_list(50)
    now = datetime.now(timezone.utc).isoformat()
    if req.approve:
        await db.orders.update_many(checkout_filter,{"$set":{
            "payment_status":"paid","status":"processing",
            "upi_verified_by":u["id"],"upi_verified_at":now,
            "admin_note":req.admin_note,"updated_at":now}})
        coins_used = sum(o.get("coins_used",0) for o in checkout_orders)
        if coins_used > 0:
            await user_repo.adjust_coin_balance(order["buyer_id"], -coins_used)
            await db.coin_transactions.insert_one(CoinTxDoc(
                user_id=order["buyer_id"],amount=-coins_used,type="spent",
                description=f"Checkout #{order.get('checkout_id', order_id)[:8]} (UPI verified)",ref_id=order.get("checkout_id", order_id)).model_dump())
        return {"message":"Payment approved ✓","order_id":order_id,"status":"processing"}
    else:
        await db.orders.update_many(checkout_filter,{"$set":{
            "payment_status":"failed","status":"cancelled",
            "admin_note":req.admin_note or "Payment not verified","updated_at":now}})
        return {"message":"Payment rejected ✗","order_id":order_id,"status":"cancelled"}

@admin_router.get("/analytics")
async def admin_analytics(
    u=Depends(admin_only),
    context: Optional[StorefrontContext] = Depends(optional_storefront_context),
    db=Depends(db_dep),
    user_repo:UserRepository=Depends(get_user_repository),
):
    sf = {"storefront_id": context.key.value} if context else {}
    now=datetime.now(timezone.utc)
    d30_dt=now-timedelta(days=30); d7_dt=now-timedelta(days=7)
    d30=d30_dt.isoformat(); d7=d7_dt.isoformat()
    return {
        "new_users_30d":         await user_repo.count_users(created_since=d30_dt),
        "new_users_7d":          await user_repo.count_users(created_since=d7_dt),
        "orders_30d":            await db.orders.count_documents({**sf, "created_at":{"$gte":d30}}),
        "orders_7d":             await db.orders.count_documents({**sf, "created_at":{"$gte":d7}}),
        "razorpay_orders_30d":   await db.orders.count_documents({**sf, "payment_method":"razorpay","payment_status":"paid","created_at":{"$gte":d30}}),
        "upi_orders_30d":        await db.orders.count_documents({**sf, "payment_method":"upi","payment_status":"paid","created_at":{"$gte":d30}}),
        "coins_orders_30d":      await db.orders.count_documents({**sf, "payment_method":"coins","payment_status":"paid","created_at":{"$gte":d30}}),
        "reel_views_30d":        await db.reel_views.count_documents({**sf, "created_at":{"$gte":d30}}),
        "coins_earned_30d":      await db.coin_transactions.count_documents({"type":"earned","created_at":{"$gte":d30}}),
        "pending_upi_verify":    await db.orders.count_documents({**sf, "payment_status":"awaiting_verification"}),
    }
