"""Checkout is one PostgreSQL transaction: stock held (never oversold), coins spent, quote used
once, cart closed and orders stored, or none of it."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from catalog import store as catalog_store
from commerce import cart as cart_store
from commerce import stock
from core.config import settings
from core.deps import shopper
from models.orders import CreateOrderFromQuoteRequest
from routers.cart import CartItemCreate, CheckoutRequest, add_to_cart, checkout_quote, checkout_stub, settle
from routers.orders import create_order_from_quote
from tests.commerce_seed import BUYER_1, BUYER_2, PROD_1, seed_listing, stock_of
from commerce import orders as order_store
from tests.test_cart import ctx_zol

buyer_1 = {"id": BUYER_1, "full_name": "Alice"}
buyer_2 = {"id": BUYER_2, "full_name": "Bob"}
ADDRESS = {"full_name": "Alice", "phone": "9876543210", "email": "a@example.com", "address_line1": "1 Main St",
           "city": "Mumbai", "state": "Maharashtra", "postal_code": "400001", "country": "IN"}


@pytest.fixture(autouse=True)
def quote_secret(monkeypatch):
    monkeypatch.setattr(settings, "CHECKOUT_QUOTE_SIGNING_SECRET", SecretStr("test-only-quote-secret-1234567890"))


async def checkout(pg, user, method="upi", coins=0):
    balance = await pg.fetchval("SELECT coin_balance FROM user_profile WHERE user_id = $1", uuid.UUID(user["id"]))
    return await checkout_stub(CheckoutRequest(payment_method=method, coins_to_use=coins), None, context=ctx_zol,
                               user={**user, "coin_balance": balance}, pg=pg)


async def shown_stock(pg) -> int:
    return (await catalog_store.public_listing(PROD_1, "zolexora-shop", pg)).stock


@pytest.mark.asyncio
async def test_placing_an_order_holds_its_stock_and_closes_the_cart(pg):
    await seed_listing(pg, PROD_1, stock=10)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=3), context=ctx_zol, user=buyer_1, pg=pg)
    res = await checkout(pg, buyer_1)
    assert res["type"] == "upi" and len(await order_store.find(pg)) == 1
    assert await stock_of(pg, PROD_1) == (10, 3)
    assert await shown_stock(pg) == 7
    assert await cart_store.items(pg, BUYER_1, "zolexora-shop") == []


@pytest.mark.asyncio
async def test_the_last_unit_is_sold_once(pg):
    await seed_listing(pg, PROD_1, stock=1)
    for buyer in (buyer_1, buyer_2):
        await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer, pg=pg)
    await checkout(pg, buyer_1)
    with pytest.raises(HTTPException) as exc:
        await checkout(pg, buyer_2)
    assert exc.value.status_code == 409
    assert [o["buyer_id"] for o in await order_store.find(pg)] == [BUYER_1]
    assert await stock_of(pg, PROD_1) == (1, 1)


@pytest.mark.asyncio
async def test_a_failed_order_write_undoes_stock_coins_and_cart(pg, monkeypatch):
    await seed_listing(pg, PROD_1, price=50_000, stock=10)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)

    async def broken(*args):  # the last write of the transaction fails
        raise RuntimeError("order write failed")
    monkeypatch.setattr(order_store, "insert", broken)
    with pytest.raises(RuntimeError):
        await checkout(pg, buyer_1, coins=500)
    assert await stock_of(pg, PROD_1) == (10, 0)
    assert await pg.fetchval("SELECT coin_balance FROM user_profile WHERE user_id = $1", uuid.UUID(BUYER_1)) == 1000
    assert len(await cart_store.items(pg, BUYER_1, "zolexora-shop")) == 1


@pytest.mark.asyncio
async def test_an_order_paid_in_coins_takes_its_stock(pg):
    await seed_listing(pg, PROD_1, price=50_000, stock=10)  # free delivery from ₹499
    await pg.execute("UPDATE user_profile SET coin_balance = 100000 WHERE user_id = $1", uuid.UUID(BUYER_1))
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    res = await checkout(pg, buyer_1, method="coins", coins=100000)
    assert res["type"] == "coins" and (await order_store.find(pg))[0]["payment_status"] == "paid"
    assert await stock_of(pg, PROD_1) == (9, 0)
    assert await pg.fetchval("SELECT coin_balance FROM user_profile WHERE user_id = $1", uuid.UUID(BUYER_1)) == 100000 - 59000


@pytest.mark.asyncio
async def test_payment_takes_and_cancellation_returns_stock(pg):
    await seed_listing(pg, PROD_1, stock=10)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=2), context=ctx_zol, user=buyer_1, pg=pg)
    order_id = (await checkout(pg, buyer_1))["order_id"]
    await settle(pg, [order_id], paid=True)
    assert await stock_of(pg, PROD_1) == (8, 0)
    await settle(pg, [order_id], paid=True)  # a repeated payment notice changes nothing
    assert await stock_of(pg, PROD_1) == (8, 0)
    await settle(pg, [order_id], paid=False)  # cancelled after payment: back on the shelf
    assert await stock_of(pg, PROD_1) == (10, 0)
    reasons = [r["reason"] for r in await pg.fetch("SELECT reason FROM inventory_audit_log WHERE reference_id = $1 ORDER BY created_at", order_id)]
    assert sorted(reasons) == ["order_cancelled", "order_paid"]


@pytest.mark.asyncio
async def test_a_rejected_payment_frees_the_hold(pg):
    await seed_listing(pg, PROD_1, stock=10)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=4), context=ctx_zol, user=buyer_1, pg=pg)
    order_id = (await checkout(pg, buyer_1))["order_id"]
    await settle(pg, [order_id], paid=False)
    assert await stock_of(pg, PROD_1) == (10, 0)


@pytest.mark.asyncio
async def test_a_lapsed_hold_is_for_sale_again(pg):
    await seed_listing(pg, PROD_1, stock=1)
    async with pg.transaction():
        await stock.reserve(pg, "unpaid-order", [(PROD_1, 1, "P")], "razorpay")
    assert await shown_stock(pg) == 0
    await pg.execute("UPDATE inventory_reservation SET expires_at = $1 WHERE reference_id = 'unpaid-order'",
                     datetime.now(timezone.utc) - timedelta(minutes=1))
    assert await shown_stock(pg) == 1
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_2, pg=pg)
    await checkout(pg, buyer_2)
    assert await stock_of(pg, PROD_1) == (1, 1)
    assert await pg.fetchval("SELECT status FROM inventory_reservation WHERE reference_id = 'unpaid-order'") == "EXPIRED"


@pytest.mark.asyncio
async def test_a_quote_buys_once(pg):
    await seed_listing(pg, PROD_1, stock=10)
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    request = lambda key: CreateOrderFromQuoteRequest(quote_id=quote.quote_id, shipping_address=ADDRESS,  # noqa: E731
                                                      payment_method_type="card", idempotency_key=key)
    await create_order_from_quote(request("first"), context=ctx_zol, user=buyer_1, pg_conn=pg)
    with pytest.raises(HTTPException) as exc:
        await create_order_from_quote(request("second"), context=ctx_zol, user=buyer_1, pg_conn=pg)
    assert exc.value.status_code == 409
    assert len(await order_store.find(pg)) == 1 and await stock_of(pg, PROD_1) == (10, 1)


@pytest.mark.asyncio
async def test_only_personal_accounts_shop():
    assert await shopper(buyer_1) == buyer_1
    for user in ({"id": "a", "is_admin": True}, {"id": "s", "zolexora_org_id": "ZX-ORG-1", "seller_org_id": "o"}):
        with pytest.raises(HTTPException) as exc:
            await shopper(user)
        assert exc.value.status_code == 403
