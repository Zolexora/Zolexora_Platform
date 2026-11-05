"""Regression tests: coins can't fund free orders, a UPI reference isn't proof of payment,
and Razorpay verification needs its secret and the buyer's own pending order."""
import uuid

import pytest
from fastapi import HTTPException

from core.config import settings
from routers.cart import (
    CartItemCreate, CheckoutRequest, UpiPaidRequest, VerifyPaymentRequest,
    add_to_cart, checkout_stub, upi_paid_stub, verify_payment_stub,
)
from tests.test_cart import buyer_1, buyer_2, ctx_zol
from tests.commerce_seed import SEL_1, PROD_1, seed_listing, BUYER_1, BUYER_2, ORDER_1, seed_order
from commerce import coins
from commerce import orders as order_store


async def balance(pg, user_id=BUYER_1) -> int:
    return await pg.fetchval("SELECT coin_balance FROM user_profile WHERE user_id = $1", uuid.UUID(user_id))


async def cart_db(pg, price_minor=100_000):
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=price_minor, stock=10, title="P1")
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)


async def checkout(pg, shown_balance, **req):
    """shown_balance: the balance on the caller's profile when the request was read."""
    user = {**buyer_1, "coin_balance": shown_balance}
    return await checkout_stub(CheckoutRequest(**req), None, context=ctx_zol, user=user, pg=pg)


@pytest.mark.asyncio
async def test_coins_beyond_the_balance_are_rejected(pg):
    await cart_db(pg)
    with pytest.raises(HTTPException) as exc:
        await checkout(pg, 1000, payment_method="coins", coins_to_use=10**9)
    assert exc.value.status_code == 400
    assert await order_store.find(pg) == [] and await balance(pg) == 1000


def test_negative_coins_are_rejected():
    with pytest.raises(ValueError):
        CheckoutRequest(payment_method="upi", coins_to_use=-5)


@pytest.mark.asyncio
async def test_coin_order_spends_exactly_the_order_total(pg):
    await cart_db(pg)
    await pg.execute("UPDATE user_profile SET coin_balance = 1000000 WHERE user_id = $1", uuid.UUID(BUYER_1))
    res = await checkout(pg, 1_000_000, payment_method="coins", coins_to_use=10**9)
    [order] = await order_store.find(pg)
    payable = 100_000 + 18_000  # subtotal + 18% tax, free delivery over ₹499
    assert res["type"] == "coins"
    assert order["coins_used"] == payable and order["grand_total"]["amount_minor"] == 0
    assert await balance(pg) == 1_000_000 - payable
    [tx] = await coins.history(pg, BUYER_1)
    assert (tx["amount"], tx["type"], tx["ref_id"]) == (-payable, "spent", order["id"])


@pytest.mark.asyncio
async def test_coins_are_not_spent_twice(pg):
    await cart_db(pg)
    # The profile was read before another order spent the balance: the atomic deduction refuses.
    await pg.execute("UPDATE user_profile SET coin_balance = 0 WHERE user_id = $1", uuid.UUID(BUYER_1))
    with pytest.raises(HTTPException):
        await checkout(pg, 50, payment_method="upi", coins_to_use=50)
    assert await order_store.find(pg) == [] and await coins.history(pg, BUYER_1) == []


@pytest.mark.asyncio
async def test_upi_reference_only_queues_the_order_for_verification(pg):
    await cart_db(pg)
    res = await checkout(pg, 0, payment_method="upi")
    order_id = res["order_id"]

    with pytest.raises(HTTPException):  # someone else's order
        await upi_paid_stub(UpiPaidRequest(order_id=order_id, upi_transaction_ref="123456789012"), context=ctx_zol, user=buyer_2, pg=pg)

    out = await upi_paid_stub(UpiPaidRequest(order_id=order_id, upi_transaction_ref="123456789012"), context=ctx_zol, user=buyer_1, pg=pg)
    assert out == {"status": "awaiting_verification"}
    assert (await order_store.find(pg))[0]["payment_status"] == "awaiting_verification"

    with pytest.raises(HTTPException):  # no second submission
        await upi_paid_stub(UpiPaidRequest(order_id=order_id, upi_transaction_ref="999999999999"), context=ctx_zol, user=buyer_1, pg=pg)


@pytest.mark.asyncio
async def test_razorpay_verification_requires_the_secret(pg, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")
    req = VerifyPaymentRequest(razorpay_order_id="order_1", razorpay_payment_id="pay_1", razorpay_signature="x")
    with pytest.raises(HTTPException) as exc:
        await verify_payment_stub(req, context=ctx_zol, user=buyer_1, pg=pg)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_razorpay_verification_only_marks_the_buyers_pending_order(pg, monkeypatch):
    import hashlib
    import hmac
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "secret")
    await seed_order(pg, ORDER_1, buyer=BUYER_2, razorpay_order_id="order_1")
    sig = hmac.new(b"secret", b"order_1|pay_1", hashlib.sha256).hexdigest()
    req = VerifyPaymentRequest(razorpay_order_id="order_1", razorpay_payment_id="pay_1", razorpay_signature=sig)
    with pytest.raises(HTTPException) as exc:
        await verify_payment_stub(req, context=ctx_zol, user=buyer_1, pg=pg)
    assert exc.value.status_code == 404
    assert (await order_store.get(pg, id=ORDER_1))["payment_status"] == "pending"
