"""Cart, checkout quote and checkout. The cart, prices, stock and coins are PostgreSQL; placing
an order reserves stock, spends coins and closes the cart in one transaction (the order
documents are still written to MongoDB inside it, so a failed write undoes everything)."""

import base64
import hashlib
import hmac
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field, StrictInt

from catalog import store as catalog_store
from commerce import cart as cart_store
from commerce import stock
from core.config import settings
from core.deps import db_dep, shopper
from models.documents import CoinTxDoc
from models.primitives import EntityId, Money, UTCDateTime
from shared.database.postgres import pg_conn_dep
from storefronts.dependencies import require_storefront_context
from storefronts.models import StorefrontContext, StorefrontKey
from users.repositories import UserRepository, get_user_repository

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

def _key(storefront) -> str:
    return str(getattr(storefront, "value", storefront))


async def _get_active_product(product_id: str, storefront_id, conn=None):
    """The buyable listing (PostgreSQL catalog) for this storefront, or None."""
    return await catalog_store.public_listing(product_id, _key(storefront_id), conn)


def _validate_cart_quantity(quantity: int, stock_left: int):
    if quantity <= 0:
        raise HTTPException(400, "Quantity must be a strict positive integer")
    if quantity > settings.MAX_CART_QUANTITY:
        raise HTTPException(400, f"Quantity cannot exceed {settings.MAX_CART_QUANTITY}")
    if quantity > stock_left:
        raise HTTPException(400, f"Only {stock_left} item(s) available")


async def _resolve_cart(conn, buyer_id: str, storefront_id) -> CartResponse:
    sf = _key(storefront_id)
    items = await cart_store.items(conn, buyer_id, sf)
    listings = await catalog_store.public_listings([i for i, _ in items], sf, conn)
    currency, lines = "INR", []
    for listing_id, quantity in items:
        listing = listings.get(listing_id)
        if not listing:  # no longer for sale: left in the cart, not priced or bought
            continue
        if lines and listing.price.currency != currency:
            raise HTTPException(400, "Cross-currency lines are not supported")
        currency = listing.price.currency
        unit = listing.price.amount_minor
        lines.append(CartLine(
            product_id=listing.id, product_title=listing.title,
            image=listing.images[0] if listing.images else None,
            seller_id=listing.seller_id, seller_name=listing.seller_name, quantity=quantity,
            unit_price=Money(amount_minor=unit, currency=currency),
            subtotal=Money(amount_minor=unit * quantity, currency=currency),
        ))
    return CartResponse(
        storefront_id=sf, buyer_id=buyer_id, currency=currency, lines=lines,
        item_count=sum(line.quantity for line in lines),
        subtotal=Money(amount_minor=sum(line.subtotal.amount_minor for line in lines), currency=currency),
        updated_at=datetime.now(timezone.utc),
    )


FREE_DELIVERY_FROM_MINOR = 49900
DELIVERY_MINOR = 4900
TAX_RATE = 0.18


def _split(cart: CartResponse) -> list[dict]:
    """One order per seller organisation: its lines, subtotal and tax. Delivery is charged once,
    on the first order, and is free from FREE_DELIVERY_FROM_MINOR."""
    groups: dict[str, dict] = {}
    for line in cart.lines:
        g = groups.setdefault(line.seller_id, {"seller_id": line.seller_id, "seller_name": line.seller_name, "lines": []})
        g["lines"].append(line)
    out = list(groups.values())
    for g in out:
        g["subtotal"] = sum(line.subtotal.amount_minor for line in g["lines"])
        g["tax"] = int(g["subtotal"] * TAX_RATE)
        g["shipping"] = 0
    if out and cart.subtotal.amount_minor < FREE_DELIVERY_FROM_MINOR:
        out[0]["shipping"] = DELIVERY_MINOR
    return out


def _lines_for_stock(lines) -> list:
    """(listing id, quantity, title) from cart lines (product_id) or order snapshots (listing_id)."""
    return [(_get(line, "listing_id") or _get(line, "product_id"), _get(line, "quantity"),
             _get(line, "product_title") or _get(line, "title") or "A product") for line in lines]


def _get(line, name):
    return line.get(name) if isinstance(line, dict) else getattr(line, name, None)


async def place_orders(pg, db, buyer_id: str, storefront_key: str, orders: list[dict], *,
                       coins_used: int = 0, paid: bool = False, user_repo: UserRepository | None = None,
                       quote_signature: str | None = None) -> None:
    """One PostgreSQL transaction: hold (or, when paid, take) the stock, spend the coins, use up
    the quote, close the cart, then store the orders. Any failure undoes all of it."""
    async with pg.transaction():
        for order in orders:
            await stock.reserve(pg, order["id"], _lines_for_stock(order["lines"]), order.get("payment_method") or "")
            if paid:
                await stock.consume(pg, order["id"])
        if coins_used:
            await (user_repo or UserRepository()).adjust_coin_balance(buyer_id, -coins_used, pg)
        if quote_signature:
            used = await pg.fetchval(
                """UPDATE checkout_quote SET status = 'CONVERTED', updated_at = now()
                   WHERE quote_signature = $1 AND buyer_id = $2 AND status = 'READY' RETURNING id""",
                quote_signature, uuid.UUID(str(buyer_id)),
            )
            if not used:
                raise HTTPException(409, "This quote was already used or is unknown; request a new quote")
        await cart_store.convert(pg, buyer_id, storefront_key)
        await db.orders.insert_many(orders)


async def settle(pg, order_ids, paid: bool) -> None:
    """A payment outcome for orders: paid takes their stock, otherwise it is released."""
    async with pg.transaction():
        for order_id in order_ids:
            await (stock.consume if paid else stock.release)(pg, order_id)


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
                   user=Depends(shopper), pg: Connection=Depends(pg_conn_dep)):
    return await _resolve_cart(pg, user["id"], context.key)


@router.get("/cart/count")
async def cart_count(context: StorefrontContext=Depends(require_storefront_context),
                     user=Depends(shopper), pg: Connection=Depends(pg_conn_dep)):
    return {"count": len(await cart_store.items(pg, user["id"], _key(context.key)))}


@router.post("/cart/items", response_model=CartResponse)
async def add_to_cart(data: CartItemCreate, context: StorefrontContext=Depends(require_storefront_context),
                      user=Depends(shopper), pg: Connection=Depends(pg_conn_dep)):
    sf = _key(context.key)
    product = await _get_active_product(data.product_id, sf, pg)
    if not product:
        raise HTTPException(404, "Product not found or belongs to a different storefront")
    async with pg.transaction():
        final_quantity = data.quantity + await cart_store.quantity(pg, user["id"], sf, product.id)
        _validate_cart_quantity(final_quantity, product.stock)
        await cart_store.set_quantity(pg, user["id"], sf, product.id, final_quantity)
    return await _resolve_cart(pg, user["id"], sf)


@router.put("/cart/items/{product_id}", response_model=CartResponse)
async def update_cart_item(
    product_id: str,
    data: CartItemQuantityUpdate | None = None,
    quantity: int | None = None,
    context: StorefrontContext = Depends(require_storefront_context),
    user = Depends(shopper),
    pg: Connection = Depends(pg_conn_dep),
):
    sf = _key(context.key)
    resolved_qty = data.quantity if data is not None else quantity
    if resolved_qty is None:
        raise HTTPException(422, "Quantity is required")
    if resolved_qty <= 0:
        await cart_store.remove(pg, user["id"], sf, product_id)
        return await _resolve_cart(pg, user["id"], sf)
    product = await _get_active_product(product_id, sf, pg)
    if not product:
        raise HTTPException(404, "Product not found or belongs to a different storefront")
    if not await cart_store.quantity(pg, user["id"], sf, product.id):
        raise HTTPException(404, "Product not in cart")
    _validate_cart_quantity(resolved_qty, product.stock)
    await cart_store.set_quantity(pg, user["id"], sf, product.id, resolved_qty)
    return await _resolve_cart(pg, user["id"], sf)


@router.delete("/cart/items/{product_id}", response_model=CartResponse)
async def remove_cart_item(product_id: str, context: StorefrontContext=Depends(require_storefront_context),
                           user=Depends(shopper), pg: Connection=Depends(pg_conn_dep)):
    await cart_store.remove(pg, user["id"], _key(context.key), product_id)
    return await _resolve_cart(pg, user["id"], context.key)


@router.delete("/cart")
async def clear_cart(context: StorefrontContext=Depends(require_storefront_context),
                     user=Depends(shopper), pg: Connection=Depends(pg_conn_dep)):
    await cart_store.remove(pg, user["id"], _key(context.key))
    return {"message": "Cart cleared"}


# ── Checkout Quotation ────────────────────────────────────────────────────────

@router.post("/cart/checkout/quote", response_model=CheckoutQuote)
async def checkout_quote(context: StorefrontContext=Depends(require_storefront_context),
                         user=Depends(shopper), pg: Connection=Depends(pg_conn_dep)):
    sf = _key(context.key)
    cart = await _resolve_cart(pg, user["id"], sf)
    if not cart.lines:
        raise HTTPException(400, "Cart is empty")
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=settings.CHECKOUT_QUOTE_EXPIRY_MINUTES)
    groups = _split(cart)
    subtotal_minor = cart.subtotal.amount_minor
    shipping_minor = sum(g["shipping"] for g in groups)
    tax_minor = sum(g["tax"] for g in groups)
    discount_minor = 0
    grand_total_minor = subtotal_minor - discount_minor + shipping_minor + tax_minor
    if grand_total_minor > 9007199254740991:
        raise HTTPException(400, "Unsafe integer total limit exceeded")
    quote_data_for_signing = {
        "storefront_id": sf,
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
    # Recorded so an order can use it once (POST /orders marks it CONVERTED).
    await pg.execute(
        """INSERT INTO checkout_quote (id, storefront_id, buyer_id, cart_id, status, currency, subtotal_minor, tax_minor,
                                       shipping_minor, discount_minor, total_minor, expires_at, quote_signature)
           SELECT $1, s.id, $2, $3, 'READY', $4, $5, $6, $7, $8, $9, $10, $11 FROM storefront s WHERE s.storefront_key = $12""",
        uuid.uuid4(), uuid.UUID(str(user["id"])), await cart_store.cart_id(pg, user["id"], sf), cart.currency,
        subtotal_minor, tax_minor, shipping_minor, discount_minor, grand_total_minor, expires_at,
        quote_id.rsplit(".", 1)[1], sf,
    )
    money = lambda v: Money(amount_minor=v, currency=cart.currency)  # noqa: E731
    return CheckoutQuote(
        quote_id=quote_id, storefront_id=sf, currency=cart.currency, lines=cart.lines,
        item_subtotal=money(subtotal_minor), discount_total=money(discount_minor),
        shipping_total=money(shipping_minor), tax_total=money(tax_minor), grand_total=money(grand_total_minor),
        issued_at=issued_at, expires_at=expires_at,
    )


class CheckoutRequest(BaseModel):
    payment_method: str
    delivery_address: dict = {}
    coins_to_use: int = Field(default=0, ge=0)

@router.post("/cart/checkout")
async def checkout_stub(
    req: CheckoutRequest,
    request: Request,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(shopper),
    db: AsyncIOMotorDatabase = Depends(db_dep),
    user_repo: UserRepository = Depends(get_user_repository),
    pg: Connection = Depends(pg_conn_dep),
):
    sf = _key(context.key)
    cart = await _resolve_cart(pg, user["id"], sf)
    if not cart.lines:
        raise HTTPException(400, "Cart is empty")
    groups = _split(cart)
    payable_minor = sum(g["subtotal"] + g["tax"] + g["shipping"] for g in groups)
    # Coins cover at most the total and what the buyer holds; they are spent in the same
    # transaction that places the orders, never just trusted.
    coin_minor = round(settings.COIN_VALUE * 100)
    coins_used = min(req.coins_to_use, payable_minor // coin_minor if coin_minor > 0 else 0)
    if coins_used > int(user.get("coin_balance") or 0):
        raise HTTPException(400, "Insufficient coin balance")
    discount_left = coins_used * coin_minor
    grand_total_minor = payable_minor - discount_left

    now = datetime.now(timezone.utc).isoformat()
    checkout_id = str(uuid.uuid4())
    buyer_name = user.get("full_name") or user.get("name") or user.get("email") or "Buyer"
    money = lambda v: {"amount_minor": v, "currency": cart.currency}  # noqa: E731
    orders = []
    for g in groups:
        payable = g["subtotal"] + g["tax"] + g["shipping"]
        discount = min(discount_left, payable)
        discount_left -= discount
        orders.append({
            "id": str(uuid.uuid4()),
            "order_number": f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
            "checkout_id": checkout_id,
            "storefront_id": sf,
            "buyer_id": user["id"],
            "buyer_name": buyer_name,
            "seller_id": g["seller_id"],
            "seller_name": g["seller_name"],
            "status": "placed",
            "payment_status": "pending",
            "fulfillment_status": "unfulfilled",
            "currency": cart.currency,
            "lines": [line.model_dump() for line in g["lines"]],
            "shipping_address": req.delivery_address,
            "payment_method": req.payment_method,
            "payment_method_type": req.payment_method,
            "item_subtotal": money(g["subtotal"]),
            "shipping_total": money(g["shipping"]),
            "tax_total": money(g["tax"]),
            "discount_total": money(discount),
            "coins_used": discount // coin_minor if coin_minor else 0,
            "grand_total": money(payable - discount),
            "shipments": [],
            "cancellations": [],
            "returns": [],
            "created_at": now,
            "updated_at": now,
        })
    order_id = orders[0]["id"]  # the checkout's handle for payment and redirects
    order_doc = orders[0]

    def tag(**fields):
        for order in orders:
            order.update(fields)

    async def place_order(paid: bool = False) -> None:
        await place_orders(pg, db, user["id"], sf, orders, coins_used=coins_used, paid=paid, user_repo=user_repo)
        if coins_used:
            await db.coin_transactions.insert_one(CoinTxDoc(
                user_id=user["id"], amount=-coins_used, type="spent",
                description=f"Order {order_doc['order_number']}", ref_id=order_id).model_dump())

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
            
            tag(cashfree_order_id=cf_order["order_id"], payment_session_id=cf_order.get("payment_session_id"))
            await place_order()
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
            
            tag(razorpay_order_id=rzp_order["id"])
            await place_order()
            return {
                "type": "razorpay",
                "amount": grand_total_minor / 100,
                "razorpay_order_id": rzp_order["id"],
                "order_id": order_id,
                "key_id": settings.RAZORPAY_KEY_ID
            }
    
    elif req.payment_method == "coins" and grand_total_minor == 0:
        tag(payment_status="paid")
        await place_order(paid=True)
        return {"type": "coins", "order_id": order_id}

    elif req.payment_method == "upi":
        await place_order()
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
    user=Depends(shopper),
    db: AsyncIOMotorDatabase = Depends(db_dep),
    pg: Connection = Depends(pg_conn_dep),
):
    if not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(503, "Razorpay is not configured")
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected_sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
        msg.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_sig, req.razorpay_signature):
        raise HTTPException(400, "Signature verification failed")
    
    pending = {"razorpay_order_id": req.razorpay_order_id, "buyer_id": user["id"],
               "storefront_id": _key(context.key), "payment_status": "pending"}
    ids = [o["id"] for o in await db.orders.find(pending, {"_id": 0, "id": 1}).to_list(50)]
    if not ids:
        raise HTTPException(404, "Pending order not found")
    await db.orders.update_many(
        {**pending, "id": {"$in": ids}},
        {"$set": {"payment_status": "paid", "razorpay_payment_id": req.razorpay_payment_id,
                  "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await settle(pg, ids, paid=True)
    return {"status": "ok"}

class VerifyCashfreeRequest(BaseModel):
    order_id: str

@router.post("/cart/checkout/verify-cashfree")
async def verify_cashfree_stub(
    req: VerifyCashfreeRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(shopper),
    db: AsyncIOMotorDatabase = Depends(db_dep),
    pg: Connection = Depends(pg_conn_dep),
):
    from core.payments import get_cashfree_order
    try:
        cf_info = await get_cashfree_order(req.order_id)
    except Exception as e:
        raise HTTPException(400, f"Failed to verify Cashfree order: {e}")
    
    order_status = cf_info.get("order_status")
    if order_status == "PAID":
        await mark_cashfree_paid(db, pg, req.order_id, {"buyer_id": user["id"], "storefront_id": _key(context.key)})
        return {"status": "paid", "order_status": order_status}
    return {"status": order_status.lower() if order_status else "pending", "order_status": order_status}

async def mark_cashfree_paid(db, pg, cashfree_order_id: str, scope: dict) -> None:
    """Cashfree says PAID: every pending order of that checkout is paid and takes its stock."""
    pending = {"$or": [{"cashfree_order_id": cashfree_order_id}, {"id": cashfree_order_id}], **scope, "payment_status": "pending"}
    ids = [o["id"] for o in await db.orders.find(pending, {"_id": 0, "id": 1}).to_list(50)]
    if ids:
        await db.orders.update_many({"id": {"$in": ids}}, {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}})
        await settle(pg, ids, paid=True)

class UpiPaidRequest(BaseModel):
    order_id: str
    upi_transaction_ref: str = Field(min_length=6, max_length=64, pattern=r"^[A-Za-z0-9]+$")

@router.post("/cart/checkout/upi-paid")
async def upi_paid_stub(
    req: UpiPaidRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(shopper),
    db: AsyncIOMotorDatabase = Depends(db_dep)
):
    # The buyer's UTR is a claim, not proof: an admin checks it (PUT /admin/orders/{id}/verify-upi).
    scope = {"buyer_id": user["id"], "storefront_id": _key(context.key), "payment_method": "upi", "payment_status": "pending"}
    order = await db.orders.find_one({"id": req.order_id, **scope})
    if not order:
        raise HTTPException(404, "Pending UPI order not found")
    # One UPI payment covers the whole checkout (one order per seller).
    await db.orders.update_many(
        {"checkout_id": order["checkout_id"], **scope} if order.get("checkout_id") else {"id": req.order_id, **scope},
        {"$set": {"payment_status": "awaiting_verification", "upi_transaction_ref": req.upi_transaction_ref, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "awaiting_verification"}

