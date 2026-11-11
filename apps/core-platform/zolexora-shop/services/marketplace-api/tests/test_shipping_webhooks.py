import hashlib
import hmac
import json

import pytest
from fastapi import HTTPException

from core.config import settings
from shipping import store
from shipping.webhooks import shiprocket_webhook
from tests.commerce_seed import ORDER_1, seed_order, seed_shipment


@pytest.fixture
async def shipment(pg, monkeypatch):
    monkeypatch.setattr(settings, "SHIPPING_WEBHOOK_SECRET", "webhook-secret")
    await seed_order(pg, ORDER_1)
    return await seed_shipment(pg, ORDER_1, awb="AWB123", current_status="booked")


async def events(pg, shipment):
    return (await store.get(pg, id=shipment["id"])).get("tracking_events", [])


class FakeRequest:
    def __init__(self, body: bytes, headers: dict[str, str] | None = None):
        self._body = body
        self.headers = headers or {}

    async def body(self):
        return self._body


def _signed_body(payload: dict, secret: str = "webhook-secret") -> tuple[bytes, str]:
    body = json.dumps(payload, separators=(",", ":")).encode()
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return body, signature


@pytest.mark.asyncio
async def test_shipping_webhook_accepts_valid_signature(shipment, pg):
    body, signature = _signed_body({"awb": "AWB123", "status": "Delivered"})
    request = FakeRequest(body, {"x-shipping-signature": signature})

    response = await shiprocket_webhook(request, pg)

    assert response == {"status": "ok"}
    assert len(await events(pg, shipment)) == 1
    assert (await store.get(pg, id=shipment["id"]))["current_status"] == "delivered"


@pytest.mark.asyncio
async def test_shipping_webhook_uses_raw_body_and_accepts_prefixed_signature(shipment, pg):
    raw_body = b'{\n  "status": "Delivered",\n  "awb": "AWB123"\n}'
    signature = hmac.new(b"webhook-secret", raw_body, hashlib.sha256).hexdigest()
    request = FakeRequest(raw_body, {"x-shiprocket-signature": f"sha256={signature}"})

    response = await shiprocket_webhook(request, pg)

    assert response == {"status": "ok"}
    assert len(await events(pg, shipment)) == 1
    assert (await store.get(pg, id=shipment["id"]))["current_status"] == "delivered"


@pytest.mark.asyncio
async def test_shipping_webhook_rejects_missing_signature(shipment, pg):
    body, _ = _signed_body({"awb": "AWB123", "status": "Delivered"})
    request = FakeRequest(body)

    with pytest.raises(HTTPException) as exc:
        await shiprocket_webhook(request, pg)

    assert exc.value.status_code == 401
    assert await events(pg, shipment) == []


@pytest.mark.asyncio
async def test_shipping_webhook_rejects_invalid_signature(shipment, pg):
    body, _ = _signed_body({"awb": "AWB123", "status": "Delivered"})
    request = FakeRequest(body, {"x-shipping-signature": "bad"})

    with pytest.raises(HTTPException) as exc:
        await shiprocket_webhook(request, pg)

    assert exc.value.status_code == 401
    assert await events(pg, shipment) == []


@pytest.mark.asyncio
async def test_shipping_webhook_rejects_when_secret_unconfigured(shipment, pg, monkeypatch):
    monkeypatch.setattr(settings, "SHIPPING_WEBHOOK_SECRET", "")
    body, signature = _signed_body({"awb": "AWB123", "status": "Delivered"})
    request = FakeRequest(body, {"x-shipping-signature": signature})

    with pytest.raises(HTTPException) as exc:
        await shiprocket_webhook(request, pg)

    assert exc.value.status_code == 503
    assert await events(pg, shipment) == []


def test_courier_words_map_to_the_right_status():
    from shipping.schemas import ShipmentStatus as S, courier_status
    cases = {"Delivered": S.DELIVERED, "DLV": S.DELIVERED, "Undelivered": S.ATTENTION_REQUIRED,
             "RTO Delivered": S.ATTENTION_REQUIRED, "Delivery failed - customer not available": S.ATTENTION_REQUIRED,
             "Out For Delivery": S.OUT_FOR_DELIVERY, "In Transit": S.IN_TRANSIT, "Picked Up": S.IN_TRANSIT,
             "Pickup Scheduled": S.PICKUP_REQUESTED, "Cancelled": S.CANCELLED, "Manifest generated": None}
    assert {text: courier_status(text) for text in cases} == cases


@pytest.mark.asyncio
async def test_replays_and_late_events_do_not_move_a_delivered_shipment(shipment, pg):
    async def send(payload):
        body, signature = _signed_body(payload)
        await shiprocket_webhook(FakeRequest(body, {"x-shipping-signature": signature}), pg)

    await send({"awb": "AWB123", "status": "Delivered"})
    await send({"awb": "AWB123", "status": "Delivered"})  # replayed
    await send({"awb": "AWB123", "status": "In Transit", "scan": 2})  # late
    after = await store.get(pg, id=shipment["id"])
    assert len(after["tracking_events"]) == 2
    assert after["current_status"] == "delivered"


@pytest.mark.asyncio
async def test_an_undelivered_shipment_needs_attention(shipment, pg):
    body, signature = _signed_body({"awb": "AWB123", "status": "Undelivered"})
    await shiprocket_webhook(FakeRequest(body, {"x-shipping-signature": signature}), pg)
    after = await store.get(pg, id=shipment["id"])
    assert after["current_status"] == "booked" and after["shipping_attention_required"] is True
