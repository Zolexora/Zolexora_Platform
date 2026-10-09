import hashlib
import hmac
import json

import pytest
from fastapi import HTTPException

from core.config import settings
from shipping.webhooks import shiprocket_webhook


class Collection:
    def __init__(self, docs=None):
        self.docs = docs or []
        self.inserted = []
        self.updated = []

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return {k: v for k, v in doc.items() if k != "_id"}
        return None

    async def insert_one(self, doc):
        self.inserted.append(doc)

    async def update_one(self, query, update):
        self.updated.append((query, update))


class FakeDB:
    def __init__(self):
        self.shipments = Collection([{"id": "shipment-1", "awb": "AWB123"}])
        self.shipment_tracking_events = Collection()


@pytest.fixture
def fake_db(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(settings, "SHIPPING_WEBHOOK_SECRET", "webhook-secret")
    return db


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
async def test_shipping_webhook_accepts_valid_signature(fake_db):
    db = fake_db
    body, signature = _signed_body({"awb": "AWB123", "status": "Delivered"})
    request = FakeRequest(body, {"x-shipping-signature": signature})

    response = await shiprocket_webhook(request, db)

    assert response == {"status": "ok"}
    assert db.shipment_tracking_events.inserted
    assert db.shipments.updated


@pytest.mark.asyncio
async def test_shipping_webhook_uses_raw_body_and_accepts_prefixed_signature(fake_db):
    db = fake_db
    raw_body = b'{\n  "status": "Delivered",\n  "awb": "AWB123"\n}'
    signature = hmac.new(b"webhook-secret", raw_body, hashlib.sha256).hexdigest()
    request = FakeRequest(raw_body, {"x-shiprocket-signature": f"sha256={signature}"})

    response = await shiprocket_webhook(request, db)

    assert response == {"status": "ok"}
    assert db.shipment_tracking_events.inserted
    assert db.shipments.updated


@pytest.mark.asyncio
async def test_shipping_webhook_rejects_missing_signature(fake_db):
    db = fake_db
    body, _ = _signed_body({"awb": "AWB123", "status": "Delivered"})
    request = FakeRequest(body)

    with pytest.raises(HTTPException) as exc:
        await shiprocket_webhook(request, db)

    assert exc.value.status_code == 401
    assert db.shipment_tracking_events.inserted == []
    assert db.shipments.updated == []


@pytest.mark.asyncio
async def test_shipping_webhook_rejects_invalid_signature(fake_db):
    db = fake_db
    body, _ = _signed_body({"awb": "AWB123", "status": "Delivered"})
    request = FakeRequest(body, {"x-shipping-signature": "bad"})

    with pytest.raises(HTTPException) as exc:
        await shiprocket_webhook(request, db)

    assert exc.value.status_code == 401
    assert db.shipment_tracking_events.inserted == []
    assert db.shipments.updated == []


@pytest.mark.asyncio
async def test_shipping_webhook_rejects_when_secret_unconfigured(fake_db, monkeypatch):
    db = fake_db
    monkeypatch.setattr(settings, "SHIPPING_WEBHOOK_SECRET", "")
    body, signature = _signed_body({"awb": "AWB123", "status": "Delivered"})
    request = FakeRequest(body, {"x-shipping-signature": signature})

    with pytest.raises(HTTPException) as exc:
        await shiprocket_webhook(request, db)

    assert exc.value.status_code == 503
    assert db.shipment_tracking_events.inserted == []
    assert db.shipments.updated == []
