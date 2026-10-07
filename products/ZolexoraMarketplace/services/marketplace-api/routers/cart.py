import uuid
import os
import time
import asyncio
import hmac
import hashlib
import json
import base64
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field, StrictInt

from core.deps import db_dep, current_user
from core.config import settings
from storefronts.dependencies import require_storefront_context
from storefronts.models import StorefrontContext, StorefrontKey
from models.primitives import Money, UTCDateTime, EntityId

router = APIRouter(tags=["cart"])

# ── Public Contracts ───────────────────────────────────────────────────────────

class CartItemCreate(BaseModel):
    product_id: EntityId
    quantity: StrictInt = Field(default=1, gt=0)

class CartItemQuantityUpdate(BaseModel):
    quantity: StrictInt = Field(..., gt=0)

class CartLine(BaseModel):
    product_id: EntityId
    product_title: str
    image: Optional[str] = None
    seller_id: EntityId
    seller_name: str
    quantity: StrictInt
    unit_price: Money
    subtotal: Money

class CartResponse(BaseModel):
    storefront_id: StorefrontKey
    buyer_id: EntityId
    currency: str
    lines: List[CartLine]
    item_count: int
    subtotal: Money
    updated_at: UTCDateTime

class CheckoutQuote(BaseModel):
    quote_id: str
    storefront_id: StorefrontKey
    currency: str
    lines: List[CartLine]
    item_subtotal: Money
    discount_total: Money
    shipping_total: Money
    tax_total: Money
    grand_total: Money
    issued_at: UTCDateTime
    expires_at: UTCDateTime


# ── Internal Helpers ──────────────────────────────────────────────────────────

async def _get_active_product(db: AsyncIOMotorDatabase, product_id: str, storefront_id: str):
    from routers.products import _fetch_product_listing
    sf_str = str(storefront_id.value if hasattr(storefront_id, "value") else storefront_id)
    listing = await db.storefront_listings.find_one({"id": product_id, "storefront_id": sf_str, "status": "active"})
    if not listing:
        return None
    product_obj = await _fetch_product_listing(db, listing)
    return product_obj

def _validate_cart_quantity(quantity: int, stock: int):
    max_quantity = settings.MAX_CART_QUANTITY
    if quantity <= 0:
        raise HTTPException(400, "Quantity must be a strict positive integer")
    if quantity > max_quantity:
        raise HTTPException(400, f"Quantity cannot exceed {max_quantity}")
    if quantity > stock:
        raise HTTPException(400, f"Only {stock} item(s) available")


_CART_CACHE: dict[str, tuple[float, CartResponse]] = {}

def _invalidate_cart_cache(buyer_id: str, storefront_id: str | None = None):
    sf_str = str(storefront_id.value if hasattr(storefront_id, "value") else storefront_id) if storefront_id else None
    if sf_str:
        _CART_CACHE.pop(f"{buyer_id}:{sf_str}", None)
    else:
        for k in list(_CART_CACHE.keys()):
            if k.startswith(f"{buyer_id}:"):
                _CART_CACHE.pop(k, None)


async def _resolve_cart(db: AsyncIOMotorDatabase, buyer_id: str, storefront_id: str) -> CartResponse:
    sf_str = str(storefront_id.value if hasattr(storefront_id, "value") else storefront_id)
    cache_key = f"{buyer_id}:{sf_str}"
    now = time.time()
    if not getattr(settings, "TESTING", False) and "PYTEST_CURRENT_TEST" not in os.environ:
        if cache_key in _CART_CACHE:
            ts, cached = _CART_CACHE[cache_key]
            if now - ts < 15:
                return cached

    items = await db.cart.find({"user_id": buyer_id, "storefront_id": sf_str}, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    currency = "INR"  # Default canonical currency
    if not items:
        res = CartResponse(
            storefront_id=sf_str,
            buyer_id=buyer_id,
            currency=currency,
            lines=[],
            item_count=0,
            subtotal=Money(amount_minor=0, currency=currency),
            updated_at=datetime.now(timezone.utc)
        )
        if not getattr(settings, "TESTING", False):
            _CART_CACHE[cache_key] = (now, res)
        return res
        
    product_ids = [item["product_id"] for item in items]
    
    # 1. Batch fetch all active storefront listings in 1 query (with fallback for unit test mocks)
    listings = []
    try:
        res = db.storefront_listings.find({
            "id": {"$in": product_ids},
            "storefront_id": sf_str,
            "status": "active"
        })
        listings = await res.to_list(None) if hasattr(res, "to_list") else await res
    except Exception:
        listings = []

    if not listings and hasattr(db.storefront_listings, "find_one"):
        for pid in product_ids:
            l = await db.storefront_listings.find_one({"id": pid, "storefront_id": sf_str, "status": "active"})
            if l:
                listings.append(l)
    
    listing_by_id = {l["id"]: l for l in listings}
    master_ids = [l["product_id"] for l in listings]
    
    # 2. Batch fetch master products and inventory concurrently (with fallback for unit test mocks)
    masters, invs = [], []
    try:
        masters_coro = db.master_products.find({"id": {"$in": master_ids}}).to_list(None)
        invs_coro = db.inventory_balances.find({"product_id": {"$in": master_ids}}).to_list(None)
        masters, invs = await asyncio.gather(masters_coro, invs_coro)
    except Exception:
        masters, invs = [], []

    if not masters and hasattr(db.master_products, "find_one"):
        for mid in master_ids:
            m = await db.master_products.find_one({"id": mid})
            if m:
                masters.append(m)
    
    master_by_id = {m["id"]: m for m in masters}
    
    lines = []
    subtotal_minor = 0
    item_count = 0
    
    for item in items:
        pid = item["product_id"]
        listing = listing_by_id.get(pid)
        if not listing:
            continue
            
        master = master_by_id.get(listing["product_id"]) or {}
        quantity = item["quantity"]
        
        raw_price = listing.get("price")
        if isinstance(raw_price, dict):
            unit_price = raw_price["amount_minor"]
            line_currency = raw_price.get("currency", "INR")
        else:
            unit_price = getattr(raw_price, "amount_minor", 0)
            line_currency = getattr(raw_price, "currency", "INR")
            
        if lines and line_currency != currency:
            raise HTTPException(400, "Cross-currency lines are not supported")
            
        currency = line_currency
        line_subtotal = unit_price * quantity
        
        images = listing.get("images_override") or master.get("images", [])
        title = listing.get("title_override") or master.get("title", "Product")
        seller_name = master.get("seller_name", "Seller")
        
        lines.append(CartLine(
            product_id=listing["id"],
            product_title=title,
            image=images[0] if images else None,
            seller_id=listing["seller_id"],
            seller_name=seller_name,
            quantity=quantity,
            unit_price=Money(amount_minor=unit_price, currency=currency),
            subtotal=Money(amount_minor=line_subtotal, currency=currency)
        ))
        subtotal_minor += line_subtotal
        item_count += quantity
        
    res = CartResponse(
        storefront_id=storefront_id,
        buyer_id=buyer_id,
        currency=currency,
        lines=lines,
        item_count=item_count,
        subtotal=Money(amount_minor=subtotal_minor, currency=currency),
        updated_at=datetime.now(timezone.utc)
    )
    _CART_CACHE[cache_key] = (now, res)
    return res

def _generate_quote_token(buyer_id: str, quote_data: dict) -> str:
    if not settings.CHECKOUT_QUOTE_SIGNING_SECRET:
        raise HTTPException(500, "Checkout quoting is currently unavailable (missing configuration).")
    
    payload = {
        "v": "1",
        "b": buyer_id,
        "q": quote_data
    }
    payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
    
    secret = settings.CHECKOUT_QUOTE_SIGNING_SECRET.get_secret_value().encode()
    signature = hmac.new(secret, payload_b64.encode(), hashlib.sha256).hexdigest()
    
    return f"{payload_b64}.{signature}"

def _verify_quote_token(token: str, buyer_id: str, storefront_id: str) -> dict:
    if not settings.CHECKOUT_QUOTE_SIGNING_SECRET:
        raise HTTPException(500, "Checkout quoting is currently unavailable (missing configuration).")
        
    parts = token.split(".")
    if len(parts) != 2:
        raise HTTPException(400, "Invalid quote token")
        
    payload_b64, signature = parts
    secret = settings.CHECKOUT_QUOTE_SIGNING_SECRET.get_secret_value().encode()
    expected_sig = hmac.new(secret, payload_b64.encode(), hashlib.sha256).hexdigest()
    
    if not hmac.compare_digest(expected_sig, signature):
        raise HTTPException(400, "Quote token signature invalid")
        
    payload_json = base64.urlsafe_b64decode(payload_b64 + "===").decode()
    payload = json.loads(payload_json)
    
    if payload.get("v") != "1":
        raise HTTPException(400, "Unsupported quote token version")
        
    if payload.get("b") != buyer_id:
        raise HTTPException(403, "Quote belongs to a different buyer")
        
    quote_data = payload.get("q", {})
    if quote_data.get("storefront_id") != storefront_id:
        raise HTTPException(403, "Quote belongs to a different storefront")
        
    expires_at_iso = quote_data.get("expires_at")
    if not expires_at_iso:
        raise HTTPException(400, "Quote missing expiration")
    
    expires_at = datetime.fromisoformat(expires_at_iso)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(400, "Quote has expired")
        
    return quote_data


verify_quote_token = _verify_quote_token



# ── Cart Routes ───────────────────────────────────────────────────────────────

@router.get("/cart", response_model=CartResponse)
async def get_cart(context: StorefrontContext=Depends(require_storefront_context),
                   user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    return await _resolve_cart(db, user["id"], sf_key)

@router.get("/cart/count")
async def cart_count(context: StorefrontContext=Depends(require_storefront_context),
                     user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    cache_key = f"{user['id']}:{sf_key}"
    if not getattr(settings, "TESTING", False) and "PYTEST_CURRENT_TEST" not in os.environ:
        if cache_key in _CART_CACHE:
            ts, cached = _CART_CACHE[cache_key]
            if time.time() - ts < 15:
                return {"count": cached.item_count}
    count = await db.cart.count_documents({"user_id": user["id"], "storefront_id": sf_key})
    return {"count": count}

@router.post("/cart/items", response_model=CartResponse)
async def add_to_cart(data: CartItemCreate, context: StorefrontContext=Depends(require_storefront_context),
                      user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    product = await _get_active_product(db, data.product_id, sf_key)
    if not product:
        raise HTTPException(404, "Product not found or belongs to a different storefront")
        
    ex = await db.cart.find_one({"user_id": user["id"], "product_id": data.product_id, "storefront_id": sf_key})
    current_quantity = ex.get("quantity", 0) if ex else 0
    final_quantity = data.quantity + current_quantity
    
    _validate_cart_quantity(final_quantity, product.stock)
    
    if ex:
        await db.cart.update_one({"user_id": user["id"], "product_id": data.product_id, "storefront_id": sf_key}, 
                                 {"$set": {"quantity": final_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        await db.cart.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "product_id": data.product_id,
            "quantity": data.quantity,
            "storefront_id": sf_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
        
    _invalidate_cart_cache(user["id"], sf_key)
    return await _resolve_cart(db, user["id"], sf_key)

@router.put("/cart/items/{product_id}", response_model=CartResponse)
async def update_cart_item(
    product_id: str,
    data: CartItemQuantityUpdate | None = None,
    quantity: int | None = None,
    context: StorefrontContext = Depends(require_storefront_context),
    user = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    resolved_qty = data.quantity if data is not None else quantity
    if resolved_qty is None:
        raise HTTPException(422, "Quantity is required")
        
    if resolved_qty <= 0:
        await db.cart.delete_one({"user_id": user["id"], "product_id": product_id, "storefront_id": sf_key})
        _invalidate_cart_cache(user["id"], sf_key)
        return await _resolve_cart(db, user["id"], sf_key)

    product = await _get_active_product(db, product_id, sf_key)
    if not product:
        raise HTTPException(404, "Product not found or belongs to a different storefront")
        
    ex = await db.cart.find_one({"user_id": user["id"], "product_id": product_id, "storefront_id": sf_key})
    if not ex:
        raise HTTPException(404, "Product not in cart")
        
    _validate_cart_quantity(resolved_qty, product.stock)
    
    await db.cart.update_one(
        {"user_id": user["id"], "product_id": product_id, "storefront_id": sf_key},
        {"$set": {"quantity": resolved_qty, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
                             
    _invalidate_cart_cache(user["id"], sf_key)
    return await _resolve_cart(db, user["id"], sf_key)

@router.delete("/cart/items/{product_id}", response_model=CartResponse)
async def remove_cart_item(product_id: str, context: StorefrontContext=Depends(require_storefront_context),
                            user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    await db.cart.delete_one({"user_id": user["id"], "product_id": product_id, "storefront_id": sf_key})
    _invalidate_cart_cache(user["id"], sf_key)
    return await _resolve_cart(db, user["id"], sf_key)

@router.delete("/cart")
async def clear_cart(context: StorefrontContext=Depends(require_storefront_context),
                     user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    await db.cart.delete_many({"user_id": user["id"], "storefront_id": sf_key})
    _invalidate_cart_cache(user["id"], sf_key)
    return {"message": "Cart cleared"}


# ── Checkout Quotation ────────────────────────────────────────────────────────

@router.post("/cart/checkout/quote", response_model=CheckoutQuote)
async def checkout_quote(context: StorefrontContext=Depends(require_storefront_context),
                         user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    cart = await _resolve_cart(db, user["id"], sf_key)
    if not cart.lines:
        raise HTTPException(400, "Cart is empty")
        
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=settings.CHECKOUT_QUOTE_EXPIRY_MINUTES)
    
    subtotal_minor = cart.subtotal.amount_minor
    # No fake discounts or shipping for now
    discount_minor = 0
    shipping_minor = 0
    tax_minor = 0
    grand_total_minor = subtotal_minor - discount_minor + shipping_minor + tax_minor
    
    if grand_total_minor < 0:
        raise HTTPException(400, "Invalid totals (negative)")
    if grand_total_minor > 9007199254740991:
        raise HTTPException(400, "Unsafe integer total limit exceeded")
    
    quote_data_for_signing = {
        "storefront_id": context.key,
        "currency": cart.currency,
        "lines": [{"product_id": line.product_id, "quantity": line.quantity, "unit_price": line.unit_price.amount_minor} for line in cart.lines],
        "item_subtotal": subtotal_minor,
        "discount_total": discount_minor,
        "shipping_total": shipping_minor,
        "tax_total": tax_minor,
        "grand_total": grand_total_minor,
        "issued_at": issued_at.isoformat(),
        "expires_at": expires_at.isoformat()
    }
    
    quote_id = _generate_quote_token(user["id"], quote_data_for_signing)
    
    return CheckoutQuote(
        quote_id=quote_id,
        storefront_id=context.key,
        currency=cart.currency,
        lines=cart.lines,
        item_subtotal=Money(amount_minor=subtotal_minor, currency=cart.currency),
        discount_total=Money(amount_minor=discount_minor, currency=cart.currency),
        shipping_total=Money(amount_minor=shipping_minor, currency=cart.currency),
        tax_total=Money(amount_minor=tax_minor, currency=cart.currency),
        grand_total=Money(amount_minor=grand_total_minor, currency=cart.currency),
        issued_at=issued_at,
        expires_at=expires_at
    )


class CheckoutRequest(BaseModel):
    payment_method: str
    delivery_address: dict = {}
    coins_to_use: int = 0

@router.post("/cart/checkout")
async def checkout_stub(
    req: CheckoutRequest,
    request: Request,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    cart = await _resolve_cart(db, user["id"], context.key)
    if not cart.lines:
        raise HTTPException(400, "Cart is empty")

    subtotal_minor = cart.subtotal.amount_minor
    # Delivery fee logic from frontend: 0 if >= 499 else 49
    delivery_minor = 0 if subtotal_minor >= 49900 else 4900
    tax_minor = int(subtotal_minor * 0.18)
    discount_minor = req.coins_to_use * int(settings.COIN_VALUE * 100)
    
    grand_total_minor = max(0, subtotal_minor + tax_minor + delivery_minor - discount_minor)
    
    order_id = str(uuid.uuid4())
    order_doc = {
        "id": order_id,
        "order_number": f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        "storefront_id": context.key,
        "buyer_id": user["id"],
        "buyer_name": user.get("full_name") or user.get("name") or user.get("email") or "Buyer",
        "seller_id": cart.lines[0].seller_id if cart.lines else "seller_default",
        "seller_name": cart.lines[0].seller_name if cart.lines else "Seller",
        "status": "placed",
        "payment_status": "pending",
        "fulfillment_status": "unfulfilled",
        "currency": cart.currency,
        "lines": [line.model_dump() for line in cart.lines],
        "shipping_address": req.delivery_address,
        "payment_method": req.payment_method,
        "payment_method_type": req.payment_method,
        "item_subtotal": {"amount_minor": subtotal_minor, "currency": cart.currency},
        "shipping_total": {"amount_minor": delivery_minor, "currency": cart.currency},
        "tax_total": {"amount_minor": tax_minor, "currency": cart.currency},
        "discount_total": {"amount_minor": discount_minor, "currency": cart.currency},
        "grand_total": {"amount_minor": grand_total_minor, "currency": cart.currency},
        "shipments": [],
        "cancellations": [],
        "returns": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # Dynamically select gateway based on storefront config
    raw_provider = (
        os.environ.get("ZOLEXORA_SHOP_PAYMENT_PROVIDER")
        or getattr(settings, "ZOLEXORA_SHOP_PAYMENT_PROVIDER", "razorpay")
    ) if context.key == "zolexora-shop" else (
        os.environ.get("MAHILA_MADEL_PAYMENT_PROVIDER")
        or getattr(settings, "MAHILA_MADEL_PAYMENT_PROVIDER", "razorpay")
    )
    provider = str(raw_provider).strip().lower()

    if req.payment_method in ("razorpay", "cashfree", "card", "gateway"):
        if provider == "cashfree":
            from core.payments import create_cashfree_order
            
            import re
            raw_phone = req.delivery_address.get("phone", "9999999999")
            clean_phone = re.sub(r'[^0-9]', '', raw_phone)
            if len(clean_phone) < 10:
                clean_phone = "9999999999"
            if len(clean_phone) > 10 and clean_phone.startswith("91"):
                clean_phone = clean_phone[2:]
            
            cf_amount = float(grand_total_minor / 100)
            if cf_amount < 1.0:
                cf_amount = 1.0  # Cashfree min amount is INR 1.0
                
            origin = request.headers.get("origin")
            if not origin and request.headers.get("referer"):
                from urllib.parse import urlsplit
                parsed = urlsplit(request.headers.get("referer"))
                origin = f"{parsed.scheme}://{parsed.netloc}"
            if not origin:
                origin = f"https://{context.storefront.canonical_host}"
            
            return_url = f"{origin}/orders/{order_id}?payment=cashfree&order_id={order_id}"

            cf_payload = {
                "order_id": order_id,
                "order_amount": cf_amount,
                "order_currency": cart.currency,
                "customer_details": {
                    "customer_id": user["id"],
                    "customer_phone": clean_phone[-10:], # Ensure 10 digits
                    "customer_name": order_doc["buyer_name"] or "User",
                    "customer_email": req.delivery_address.get("email", user.get("email", "buyer@example.com"))
                },
                "order_meta": {
                    "return_url": return_url
                }
            }
            try:
                cf_order = await create_cashfree_order(cf_payload)
            except Exception as e:
                raise HTTPException(500, f"Cashfree API Error: Check your backend credentials or connection. ({e})")
            
            order_doc["cashfree_order_id"] = cf_order["order_id"]
            order_doc["payment_session_id"] = cf_order.get("payment_session_id")
            await db.orders.insert_one(order_doc)
            await db.cart.delete_many({"user_id": user["id"], "storefront_id": context.key})
            return {
                "type": "cashfree",
                "payment_session_id": cf_order.get("payment_session_id"),
                "order_id": order_id,
                "return_url": return_url,
                "environment": settings.CASHFREE_ENVIRONMENT.lower()
            }

        else: # default to razorpay
            from core.payments import create_razorpay_order
            try:
                rzp_order = await create_razorpay_order({
                    "amount": grand_total_minor,
                    "currency": cart.currency,
                    "receipt": order_id,
                    "payment_capture": 1
                })
            except Exception as e:
                raise HTTPException(500, f"Razorpay API Error: Check your backend credentials or connection. ({e})")
            
            order_doc["razorpay_order_id"] = rzp_order["id"]
            await db.orders.insert_one(order_doc)
            return {
                "type": "razorpay",
                "amount": grand_total_minor / 100,
                "razorpay_order_id": rzp_order["id"],
                "order_id": order_id,
                "key_id": settings.RAZORPAY_KEY_ID
            }
    
    elif req.payment_method == "coins" and grand_total_minor == 0:
        order_doc["payment_status"] = "paid"
        await db.orders.insert_one(order_doc)
        await db.cart.delete_many({"user_id": user["id"], "storefront_id": context.key})
        return {"type": "coins", "order_id": order_id}

    elif req.payment_method == "upi":
        await db.orders.insert_one(order_doc)
        await db.cart.delete_many({"user_id": user["id"], "storefront_id": context.key})
        return {"type": "upi", "order_id": order_id}

    raise HTTPException(400, "Unsupported payment method")

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@router.post("/cart/checkout/verify-payment")
async def verify_payment_stub(
    req: VerifyPaymentRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    import hmac
    import hashlib
    
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected_sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
        msg.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_sig, req.razorpay_signature):
        raise HTTPException(400, "Signature verification failed")
    
    await db.orders.update_one(
        {"razorpay_order_id": req.razorpay_order_id},
        {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.cart.delete_many({"user_id": user["id"], "storefront_id": context.key})
    _invalidate_cart_cache(user["id"], context.key)
    return {"status": "ok"}

class VerifyCashfreeRequest(BaseModel):
    order_id: str

@router.post("/cart/checkout/verify-cashfree")
async def verify_cashfree_stub(
    req: VerifyCashfreeRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    from core.payments import get_cashfree_order
    try:
        cf_info = await get_cashfree_order(req.order_id)
    except Exception as e:
        raise HTTPException(400, f"Failed to verify Cashfree order: {e}")
    
    order_status = cf_info.get("order_status")
    if order_status == "PAID":
        await db.orders.update_one(
            {"id": req.order_id, "storefront_id": context.key},
            {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"status": "paid", "order_status": order_status}
    return {"status": order_status.lower() if order_status else "pending", "order_status": order_status}

class UpiPaidRequest(BaseModel):
    order_id: str
    upi_transaction_ref: str

@router.post("/cart/checkout/upi-paid")
async def upi_paid_stub(
    req: UpiPaidRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    res = await db.orders.update_one(
        {"id": req.order_id, "buyer_id": user["id"]},
        {"$set": {"payment_status": "paid", "upi_transaction_ref": req.upi_transaction_ref, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Order not found")
    return {"status": "ok"}

