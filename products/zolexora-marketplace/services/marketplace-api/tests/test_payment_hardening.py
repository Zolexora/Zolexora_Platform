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


class FakeDB(CartDB):
    def __init__(self):
        super().__init__()
        self.orders = self.Collection()
        self.coin_transactions = self.Collection()


class FakeUserRepo:
    def __init__(self, balance: int):
        self.balance = balance

    async def adjust_coin_balance(self, user_id, delta):
        if self.balance + delta < 0:
            raise HTTPException(400, "Insufficient coin balance")
        self.balance += delta
        return self.balance


async def cart_db(price_minor=100_000):
    db = FakeDB()
    await db.storefront_listings.insert_one({"id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "storefront_id": "zolexora-shop",
                                             "price": {"amount_minor": price_minor, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "P1", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 10, "reserved_quantity": 0})
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    return db


async def checkout(db, repo, balance, **req):
    user = {**buyer_1, "coin_balance": balance}
    return await checkout_stub(CheckoutRequest(**req), None, context=ctx_zol, user=user, db=db, user_repo=repo)


@pytest.mark.asyncio
async def test_coins_beyond_the_balance_are_rejected():
    db = await cart_db()
    with pytest.raises(HTTPException) as exc:
        await checkout(db, FakeUserRepo(100), 100, payment_method="coins", coins_to_use=10**9)
    assert exc.value.status_code == 400
    assert db.orders.docs == []


def test_negative_coins_are_rejected():
    with pytest.raises(ValueError):
        CheckoutRequest(payment_method="upi", coins_to_use=-5)


@pytest.mark.asyncio
async def test_coin_order_spends_exactly_the_order_total():
    db = await cart_db()
    repo = FakeUserRepo(10**9)
    res = await checkout(db, repo, repo.balance, payment_method="coins", coins_to_use=10**9)
    [order] = db.orders.docs
    payable = 100_000 + 18_000  # subtotal + 18% tax, free delivery over ₹499
    assert res["type"] == "coins"
    assert order["coins_used"] == payable and order["grand_total"]["amount_minor"] == 0
    assert repo.balance == 10**9 - payable
    assert db.coin_transactions.docs[0]["amount"] == -payable


@pytest.mark.asyncio
async def test_coins_are_not_spent_twice():
    db = await cart_db()
    repo = FakeUserRepo(50)
    # The profile was read before another order spent the balance: the atomic deduction refuses.
    repo.balance = 0
    with pytest.raises(HTTPException):
        await checkout(db, repo, 50, payment_method="upi", coins_to_use=50)
    assert db.orders.docs == []


@pytest.mark.asyncio
async def test_upi_reference_only_queues_the_order_for_verification():
    db = await cart_db()
    res = await checkout(db, FakeUserRepo(0), 0, payment_method="upi")
    order_id = res["order_id"]

    with pytest.raises(HTTPException):  # someone else's order
        await upi_paid_stub(UpiPaidRequest(order_id=order_id, upi_transaction_ref="123456789012"), context=ctx_zol, user=buyer_2, db=db)

    out = await upi_paid_stub(UpiPaidRequest(order_id=order_id, upi_transaction_ref="123456789012"), context=ctx_zol, user=buyer_1, db=db)
    assert out == {"status": "awaiting_verification"}
    assert db.orders.docs[0]["payment_status"] == "awaiting_verification"

    with pytest.raises(HTTPException):  # no second submission
        await upi_paid_stub(UpiPaidRequest(order_id=order_id, upi_transaction_ref="999999999999"), context=ctx_zol, user=buyer_1, db=db)


@pytest.mark.asyncio
async def test_razorpay_verification_requires_the_secret(monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")
    req = VerifyPaymentRequest(razorpay_order_id="order_1", razorpay_payment_id="pay_1", razorpay_signature="x")
    with pytest.raises(HTTPException) as exc:
        await verify_payment_stub(req, context=ctx_zol, user=buyer_1, db=FakeDB())
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_razorpay_verification_only_marks_the_buyers_pending_order(monkeypatch):
    import hashlib
    import hmac
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "secret")
    db = FakeDB()
    await db.orders.insert_one({"id": "o1", "razorpay_order_id": "order_1", "buyer_id": buyer_2["id"],
                                "storefront_id": "zolexora-shop", "payment_status": "pending"})
    sig = hmac.new(b"secret", b"order_1|pay_1", hashlib.sha256).hexdigest()
    req = VerifyPaymentRequest(razorpay_order_id="order_1", razorpay_payment_id="pay_1", razorpay_signature=sig)
    with pytest.raises(HTTPException) as exc:
        await verify_payment_stub(req, context=ctx_zol, user=buyer_1, db=db)
    assert exc.value.status_code == 404
    assert db.orders.docs[0]["payment_status"] == "pending"
