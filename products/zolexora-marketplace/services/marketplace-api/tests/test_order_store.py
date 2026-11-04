"""Orders in PostgreSQL keep the API's order document; lines are order_item rows tied to the listing sold."""

import pytest
from fastapi import HTTPException

from commerce import orders as order_store
from routers.orders import update_order_status
from tests.commerce_seed import BUYER_1, ORDER_1, ORDER_2, SEL_1, SEL_2, seed_order, stock_of
from tests.test_cart import ctx_zol

SELLER = {"id": "staff", "seller_org_id": SEL_1}


@pytest.mark.asyncio
async def test_an_order_reads_back_as_it_was_written(pg):
    written = await seed_order(pg, ORDER_1, checkout_id=ORDER_2, coins_used=5, cancellations=[], payment_method="upi")
    doc = await order_store.get(pg, id=ORDER_1)
    assert (doc["id"], doc["buyer_id"], doc["seller_id"], doc["storefront_id"]) == (ORDER_1, BUYER_1, SEL_1, "zolexora-shop")
    assert doc["seller_name"] == "Seller One" and doc["checkout_id"] == ORDER_2 and doc["payment_method"] == "upi"
    assert doc["coins_used"] == 5 and doc["cancellations"] == []
    assert doc["grand_total"] == {"amount_minor": 1000, "currency": "INR"}
    [line] = doc["lines"]
    assert line["product_id"] == written["lines"][0]["product_id"] and line["line_id"]
    assert await order_store.count(pg, checkout_id=ORDER_2) == 1


@pytest.mark.asyncio
async def test_updates_reach_columns_lines_and_details(pg):
    await seed_order(pg, ORDER_1)
    doc = await order_store.get(pg, id=ORDER_1)
    line = {**doc["lines"][0], "cancellation_status": "requested"}
    await order_store.update(pg, ORDER_1, {"status": "processing", "lines": [line], "cancellations": [{"id": "c1"}]})
    doc = await order_store.get(pg, id=ORDER_1)
    assert doc["status"] == "processing" and doc["lines"][0]["cancellation_status"] == "requested"
    assert doc["cancellations"] == [{"id": "c1"}]
    assert await pg.fetchval("SELECT version FROM marketplace_order WHERE id = $1::uuid", ORDER_1) == 2


@pytest.mark.asyncio
async def test_a_line_must_be_sold_by_the_orders_seller(pg):
    other = await seed_order(pg, ORDER_1, org=SEL_2)
    with pytest.raises(HTTPException) as exc:  # SEL_2's listing on an order of SEL_1
        await order_store.insert(pg, {**other, "id": ORDER_2, "order_number": "ORD-X", "seller_id": SEL_1})
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_portal_statuses_map_to_order_and_fulfilment_status(pg):
    await seed_order(pg, ORDER_1)
    await update_order_status(ORDER_1, "shipped", user=SELLER, context=ctx_zol, pg=pg)
    doc = await order_store.get(pg, id=ORDER_1)
    assert (doc["status"], doc["fulfillment_status"]) == ("fulfilled", "shipped")
    with pytest.raises(HTTPException) as exc:  # another organisation's order
        await update_order_status(ORDER_1, "cancelled", user={"id": "x", "seller_org_id": SEL_2}, context=ctx_zol, pg=pg)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_cancelling_from_the_portal_puts_paid_stock_back(pg):
    from routers.cart import settle
    from commerce import stock

    order = await seed_order(pg, ORDER_1)
    listing = order["lines"][0]["product_id"]
    async with pg.transaction():
        await stock.reserve(pg, ORDER_1, [(listing, 1, "Product")])
    await settle(pg, [ORDER_1], paid=True)
    assert await stock_of(pg, listing) == (99, 0)
    await update_order_status(ORDER_1, "cancelled", user=SELLER, context=ctx_zol, pg=pg)
    assert await stock_of(pg, listing) == (100, 0)
