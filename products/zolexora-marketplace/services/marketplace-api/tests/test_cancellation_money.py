"""A cancelled order gives back what it took: stock, coins, and the payment (voided, or refund due
until an admin records it). Orders are cancelled whole; returns never exceed what was bought."""

import pytest
from fastapi import HTTPException

from commerce import orders as order_store
from models.orders import CancellationRequest, ReturnRequest, SellerCancellationActionRequest
from routers.admin_orders import RefundRecorded, record_refund
from routers.orders import action_seller_cancellation, request_buyer_cancellation, request_buyer_return
from tests.commerce_seed import BUYER_1, ORDER_1, seed_order
from tests.test_orders_fulfillment_contracts import buyer_1, ctx_zol, seller_1

ADMIN = {"id": "00000000-0000-4000-8000-00000000ad01", "is_admin": True, "permissions": ["orders:write"]}


async def coins_of(pg):
    return await pg.fetchval("SELECT coin_balance FROM user_profile WHERE user_id = $1::uuid", BUYER_1)


async def cancel(pg):
    await request_buyer_cancellation(ORDER_1, CancellationRequest(reason="Changed my mind"), context=ctx_zol, user=buyer_1, pg=pg)
    await action_seller_cancellation(ORDER_1, SellerCancellationActionRequest(action="approve"), context=ctx_zol, user=seller_1, pg=pg)
    return await order_store.get(pg, id=ORDER_1)


@pytest.mark.asyncio
async def test_a_paid_cancellation_returns_coins_and_owes_a_refund(pg):
    await seed_order(pg, ORDER_1, payment_status="paid", coins_used=50)
    before = await coins_of(pg)
    order = await cancel(pg)
    assert order["status"] == "cancelled" and order["refund_due"] is True and order["payment_status"] == "paid"
    assert await coins_of(pg) == before + 50

    out = await record_refund(ORDER_1, RefundRecorded(reference="UTR123456"), context=ctx_zol, admin=ADMIN, pg=pg)
    assert out["payment_status"] == "refunded"
    with pytest.raises(HTTPException):  # once
        await record_refund(ORDER_1, RefundRecorded(reference="UTR123456"), context=ctx_zol, admin=ADMIN, pg=pg)


@pytest.mark.asyncio
async def test_an_unpaid_cancellation_voids_the_payment(pg):
    await seed_order(pg, ORDER_1)
    order = await cancel(pg)
    assert order["payment_status"] == "voided" and not order.get("refund_due")


@pytest.mark.asyncio
async def test_single_items_cannot_be_cancelled(pg):
    await seed_order(pg, ORDER_1)
    with pytest.raises(HTTPException) as exc:
        await request_buyer_cancellation(ORDER_1, CancellationRequest(reason="One only", line_item_ids=[ORDER_1]),
                                         context=ctx_zol, user=buyer_1, pg=pg)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_returns_never_exceed_what_was_bought(pg):
    await seed_order(pg, ORDER_1, fulfillment_status="delivered")
    line = (await order_store.get(pg, id=ORDER_1))["lines"][0]["line_id"]
    ask = ReturnRequest(line_item_id=line, quantity=1, reason="Damaged")
    await request_buyer_return(ORDER_1, ask, context=ctx_zol, user=buyer_1, pg=pg)
    with pytest.raises(HTTPException) as exc:
        await request_buyer_return(ORDER_1, ask, context=ctx_zol, user=buyer_1, pg=pg)
    assert exc.value.status_code == 400
