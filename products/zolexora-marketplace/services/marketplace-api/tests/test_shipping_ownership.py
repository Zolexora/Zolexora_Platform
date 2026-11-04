"""Regression tests: shipping actions are limited to the order's seller (or an admin), and a
shipment can't be booked twice."""
import pytest
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient

from shipping import router as r
from tests.commerce_seed import BUYER_1, ORDER_1, SEL_1, SEL_2, seed_order
from shipping.schemas import CourierOption, ShipmentStatus
from shipping.service import ShippingService

seller = {"id": "seller-1", "role": "seller", "seller_org_id": SEL_1}
other_seller = {"id": "seller-2", "role": "seller", "seller_org_id": SEL_2}
buyer = {"id": BUYER_1, "role": "buyer"}
admin = {"id": "admin-1", "is_admin": True}


@pytest.fixture
async def db(pg):
    """Shipments in MongoDB (until they move), the order in PostgreSQL."""
    await seed_order(pg, ORDER_1, org=SEL_1, payment_status="paid")
    db = AsyncMongoMockClient()["test"]
    await db.shipments.insert_one({"id": "s1", "order_id": ORDER_1, "seller_id": SEL_1, "buyer_id": BUYER_1,
                                   "awb": "AWB1", "selected_provider": "none"})
    return db


@pytest.mark.asyncio
async def test_other_sellers_cannot_touch_the_order_or_shipment(db, pg):
    svc = ShippingService(db, pg)
    with pytest.raises(HTTPException) as exc:
        await r.get_options(ORDER_1, user=other_seller, db=db, pg=pg)
    assert exc.value.status_code == 404
    for call in (r.cancel_shipment, r.request_pickup):
        with pytest.raises(HTTPException) as exc:
            await call("s1", user=other_seller, db=db)
        assert exc.value.status_code == 404
    with pytest.raises(HTTPException):
        await r.retry_booking("s1", user=other_seller, svc=svc, db=db)
    with pytest.raises(HTTPException):
        await r.sync_tracking("s1", user=other_seller, svc=svc, db=db)
    assert (await db.shipments.find_one({"id": "s1"}))["awb"] == "AWB1"


@pytest.mark.asyncio
async def test_owner_and_admin_pass_the_ownership_check(db, pg):
    assert (await r._owned_order(pg, ORDER_1, seller))["id"] == ORDER_1
    assert (await r._owned_order(pg, ORDER_1, admin))["id"] == ORDER_1
    assert (await r._owned_shipment(db, "s1", seller))["id"] == "s1"
    with pytest.raises(HTTPException):
        await r._owned_order(pg, ORDER_1, buyer)


@pytest.mark.asyncio
async def test_strangers_cannot_track_someone_elses_awb(db):
    with pytest.raises(HTTPException) as exc:
        await r.track_by_awb("AWB1", user=other_seller, db=db)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_ready_to_ship_ignores_other_sellers_orders(db, pg):
    out = await ShippingService(db, pg).trigger_ready_to_ship(ORDER_1, seller_id=SEL_2)
    assert out == {"error": "Order not found"}


@pytest.mark.asyncio
async def test_a_booked_or_in_progress_shipment_is_not_booked_again(db, pg):
    svc = ShippingService(db, pg)
    option = [CourierOption(provider="delhivery", courier_name="D", service_code="x", serviceable=True)]
    assert await svc.auto_book("s1", ORDER_1, option, {}) is False  # already has an AWB

    await db.shipments.insert_one({"id": "s2", "order_id": ORDER_1, "seller_id": SEL_1, "awb": None,
                                   "current_status": ShipmentStatus.BOOKING, "auto_booking_attempted_at": "9999"})
    assert await svc.auto_book("s2", ORDER_1, option, {}) is False  # another booking is running
    assert await db.shipment_booking_attempts.count_documents({}) == 0
