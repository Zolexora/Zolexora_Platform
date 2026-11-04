"""Regression tests: coins can't fund free orders, a UPI reference isn't proof of payment,
and Razorpay verification needs its secret and the buyer's own pending order."""
import pytest
from fastapi import HTTPException

from core.config import settings
from routers.cart import (
    CartItemCreate, CheckoutRequest, UpiPaidRequest, VerifyPaymentRequest,
    add_to_cart, checkout_stub, upi_paid_stub, verify_payment_stub,
)
from tests.test_cart import FakeDB as CartDB, buyer_1, buyer_2, ctx_zol
from tests.commerce_seed import SEL_1, PROD_1, seed_listing, BUYER_2, ORDER_1, seed_order
from commerce import orders as order_store


class FakeDB(CartDB):
    def __init__(self):
        super().__init__()
        self.orders = self.Collection()
        self.coin_transactions = self.Collection()


class FakeUserRepo:
    def __init__(self, balance: int):
        self.balance = balance

    async def adjust_coin_balance(self, user_id, delta, conn=None):
        if self.balance + delta < 0:
            raise HTTPException(400, "Insufficient coin balance")
        self.balance += delta
        return self.balance


async def cart_db(pg, price_minor=100_000):
    db = FakeDB()
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=price_minor, stock=10, title="P1")
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    return db


async def checkout(pg, db, repo, balance, **req):
    user = {**buyer_1, "coin_balance": balance}
    return await checkout_stub(CheckoutRequest(**req), None, context=ctx_zol, user=user, db=db, pg=pg, user_repo=repo)


@pytest.mark.asyncio
async def test_coins_beyond_the_balance_are_rejected(pg):
    db = await cart_db(pg)
    with pytest.raises(HTTPException) as exc:
        await checkout(pg, db, FakeUserRepo(100), 100, payment_method="coins", coins_to_use=10**9)
    assert exc.value.status_code == 400
    assert await order_store.find(pg) == []


def test_negative_coins_are_rejected():
    with pytest.raises(ValueError):
        CheckoutRequest(payment_method="upi", coins_to_use=-5)


@pytest.mark.asyncio
async def test_coin_order_spends_exactly_the_order_total(pg):
    db = await cart_db(pg)
    repo = FakeUserRepo(10**9)
    res = await checkout(pg, db, repo, repo.balance, payment_method="coins", coins_to_use=10**9)
    [order] = await order_store.find(pg)
    payable = 100_000 + 18_000  # subtotal + 18% tax, free delivery over ₹499
    assert res["type"] == "coins"
    assert order["coins_used"] == payable and order["grand_total"]["amount_minor"] == 0
    assert repo.balance == 10**9 - payable
    assert db.coin_transactions.docs[0]["amount"] == -payable


@pytest.mark.asyncio
async def test_coins_are_not_spent_twice(pg):
    db = await cart_db(pg)
    repo = FakeUserRepo(50)
    # The profile was read before another order spent the balance: the atomic deduction refuses.
    repo.balance = 0
    with pytest.raises(HTTPException):
        await checkout(pg, db, repo, 50, payment_method="upi", coins_to_use=50)
    assert await order_store.find(pg) == []


@pytest.mark.asyncio
async def test_upi_reference_only_queues_the_order_for_verification(pg):
    db = await cart_db(pg)
    res = await checkout(pg, db, FakeUserRepo(0), 0, payment_method="upi")
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
