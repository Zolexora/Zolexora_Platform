"""Regression tests: shipping actions are limited to the order's seller (or an admin), and a
shipment can't be booked twice."""
import pytest
from fastapi import HTTPException

from shipping import router as r
from shipping import store
from tests.commerce_seed import BUYER_1, BUYER_2, ORDER_1, SEL_1, SEL_2, seed_order, seed_shipment
from shipping.schemas import CourierOption, PickupLocationCreate, ShipmentStatus
from shipping.service import ShippingService

seller = {"id": "seller-1", "seller_org_id": SEL_1}
other_seller = {"id": "seller-2", "seller_org_id": SEL_2}
buyer = {"id": BUYER_1}
stranger = {"id": BUYER_2}
admin = {"id": "admin-1", "is_admin": True}
PICKUP = PickupLocationCreate(label="Shop", contact_name="A", phone="9876543210", email="a@example.com",
                              address_line_1="1 Main St", city="Mumbai", state="MH", pincode="400001")


@pytest.fixture
async def shipment(pg):
    await seed_order(pg, ORDER_1, org=SEL_1, payment_status="paid")
    return await seed_shipment(pg, ORDER_1, awb="AWB1", selected_provider="none")


@pytest.mark.asyncio
async def test_other_sellers_cannot_touch_the_order_or_shipment(shipment, pg):
    sid = shipment["id"]
    svc = ShippingService(pg)
    with pytest.raises(HTTPException) as exc:
        await r.get_options(ORDER_1, user=other_seller, pg=pg)
    assert exc.value.status_code == 404
    for call in (r.cancel_shipment, r.request_pickup):
        with pytest.raises(HTTPException) as exc:
            await call(sid, user=other_seller, pg=pg)
        assert exc.value.status_code == 404
    with pytest.raises(HTTPException):
        await r.retry_booking(sid, user=other_seller, svc=svc, pg=pg)
    with pytest.raises(HTTPException):
        await r.sync_tracking(sid, user=other_seller, svc=svc, pg=pg)
    assert (await store.get(pg, id=sid))["awb"] == "AWB1"


@pytest.mark.asyncio
async def test_owner_and_admin_pass_the_ownership_check(shipment, pg):
    assert (await r._owned_order(pg, ORDER_1, seller))["id"] == ORDER_1
    assert (await r._owned_order(pg, ORDER_1, admin))["id"] == ORDER_1
    assert (await r._owned_shipment(pg, shipment["id"], seller))["id"] == shipment["id"]
    with pytest.raises(HTTPException):
        await r._owned_order(pg, ORDER_1, buyer)


@pytest.mark.asyncio
async def test_the_buyer_and_seller_see_the_shipment_strangers_do_not(shipment, pg):
    for user in (buyer, seller, admin):
        assert (await r.get_shipment(shipment["id"], user=user, pg=pg))["shipment"]["awb"] == "AWB1"
    for user in (stranger, other_seller):
        with pytest.raises(HTTPException) as exc:
            await r.track_by_awb("AWB1", user=user, pg=pg)
        assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_ready_to_ship_ignores_other_sellers_orders(shipment, pg):
    out = await ShippingService(pg).trigger_ready_to_ship(ORDER_1, seller_id=SEL_2)
    assert out == {"error": "Order not found"}


@pytest.mark.asyncio
async def test_a_booked_or_in_progress_shipment_is_not_booked_again(shipment, pg):
    svc = ShippingService(pg)
    option = [CourierOption(provider="delhivery", courier_name="D", service_code="x", serviceable=True)]
    assert await svc.auto_book(shipment["id"], ORDER_1, option, {}) is False  # already has an AWB

    await store.update(pg, shipment["id"], {"awb": None, "current_status": ShipmentStatus.BOOKING,
                                            "auto_booking_attempted_at": "9999"})
    assert await svc.auto_book(shipment["id"], ORDER_1, option, {}) is False  # another booking is running
    assert (await store.get(pg, id=shipment["id"])).get("booking_attempts") is None


@pytest.mark.asyncio
async def test_an_order_has_one_shipment(shipment, pg):
    svc = ShippingService(pg)
    assert (await svc.get_or_create_shipment(ORDER_1))["id"] == shipment["id"]
    assert await store.count(pg) == 1


@pytest.mark.asyncio
async def test_pickup_locations_belong_to_the_organisation_with_one_default(pg):
    first = await r.create_pickup_location(PICKUP.model_copy(update={"is_default": True}), user=seller, pg=pg)
    second = await r.create_pickup_location(PICKUP.model_copy(update={"label": "Store", "is_default": True}), user=seller, pg=pg)
    assert [p["is_default"] for p in await r.list_pickup_locations(user=seller, pg=pg)] == [False, True]
    assert await r.list_pickup_locations(user=other_seller, pg=pg) == []
    assert (await ShippingService(pg).get_default_pickup(SEL_1))["id"] == second["id"]

    with pytest.raises(HTTPException):  # another organisation's address
        await r.update_pickup_location(first["id"], {"city": "Pune"}, user=other_seller, pg=pg)
    await r.update_pickup_location(first["id"], {"is_default": True, "seller_id": SEL_2}, user=seller, pg=pg)
    assert (await ShippingService(pg).get_default_pickup(SEL_1))["id"] == first["id"]

    await r.delete_pickup_location(first["id"], user=other_seller, pg=pg)
    assert len(await r.list_pickup_locations(user=seller, pg=pg)) == 2
    await r.delete_pickup_location(first["id"], user=seller, pg=pg)
    assert [p["id"] for p in await r.list_pickup_locations(user=seller, pg=pg)] == [second["id"]]


class FakeCourier:
    name, display_name = "fake", "Fake Courier"

    def __init__(self):
        self.booked, self.fail = [], False

    async def check_serviceability(self, pickup, delivery, weight, cod=False):
        return [CourierOption(provider="fake", courier_name="Fake Express", service_code="EXP", serviceable=True,
                              estimated_cost=50.0, estimated_delivery_days=2)]

    async def book_shipment(self, **kw):
        from shipping.schemas import BookingResult
        self.booked.append(kw)
        return BookingResult(success=False, error_message="down") if self.fail else BookingResult(success=True, awb="FAKE1")


@pytest.mark.asyncio
async def test_ready_to_ship_books_to_the_buyers_address_and_retry_reuses_the_options(pg, monkeypatch):
    from shipping import service
    courier = FakeCourier()
    courier.fail = True
    monkeypatch.setattr(service, "ALL_PROVIDERS", [courier])
    address = {"full_name": "Alice", "phone": "9876543210", "email": "a@example.com", "address_line1": "1 Main St",
               "city": "Mumbai", "state": "MH", "postal_code": "400002", "country": "IN"}
    await seed_order(pg, ORDER_1, payment_status="paid", shipping_address=address)
    await r.create_pickup_location(PICKUP, user=seller, pg=pg)
    svc = ShippingService(pg)

    out = await r.ready_to_ship(ORDER_1, r.ReadyToShipRequest(), user=seller, svc=svc, pg=pg)
    assert out["status"] == "attention_required" and out["shipment"]["shipping_attention_required"] is True
    sent = courier.booked[0]
    assert (sent["delivery_name"], sent["delivery_pincode"], sent["service_code"]) == ("Alice", "400002", "EXP")
    assert sent["items"] == [{"name": "Product", "quantity": 1, "price": 10.0}]

    courier.fail = False
    out = await r.retry_booking(out["shipment"]["id"], user=seller, svc=svc, pg=pg)
    assert out["status"] == "booked" and out["shipment"]["awb"] == "FAKE1"
    assert out["shipment"]["fulfillment_status"] == "allocated"
    detail = await r.get_shipment(out["shipment"]["id"], user=buyer, pg=pg)
    assert [a["success"] for a in detail["booking_attempts"]] == [False, True]
    order = await r._owned_order(pg, ORDER_1, seller)
    assert (order["status"], order["fulfillment_status"]) == ("fulfilled", "shipped")
