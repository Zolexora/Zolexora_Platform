"""Regression tests: a UPI reference isn't proof of payment, and Razorpay verification needs its secret and the buyer's own pending order."""
import pytest
from fastapi import HTTPException

from core.config import settings
from routers.cart import (
    CartItemCreate, CheckoutRequest, UpiPaidRequest, VerifyPaymentRequest,
    add_to_cart, checkout_stub, upi_paid_stub, verify_payment_stub,
)
from tests.test_cart import buyer_1, buyer_2, ctx_zol
from tests.commerce_seed import SEL_1, PROD_1, seed_listing, BUYER_2, ORDER_1, seed_order
from commerce import orders as order_store


async def cart_db(pg, price_minor=100_000):
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=price_minor, stock=10, title="P1")
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)


async def checkout(pg, **req):
    return await checkout_stub(CheckoutRequest(**req), None, context=ctx_zol, user=buyer_1, pg=pg)


@pytest.mark.asyncio
async def test_upi_reference_only_queues_the_order_for_verification(pg):
    await cart_db(pg)
    res = await checkout(pg, payment_method="upi")
    order_id = res["order_id"]
    # What the buyer pays: the merchant's id and the order's total, as a link and a scannable QR.
    assert (res["upi_id"], res["amount"]) == ("zolexora@testbank", 1180.0)
    assert res["upi_link"].startswith("upi://pay?pa=zolexora%40testbank&pn=") and "&am=1180.00&cu=INR" in res["upi_link"]
    assert res["upi_qr"].startswith("data:image/svg+xml")

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


@pytest.mark.asyncio
async def test_upi_checkout_needs_a_configured_upi_id(pg, monkeypatch):
    monkeypatch.setattr(settings, "UPI_ID", "")
    await cart_db(pg)
    with pytest.raises(HTTPException) as exc:
        await checkout(pg, payment_method="upi")
    assert exc.value.status_code == 503 and await order_store.find(pg) == []
