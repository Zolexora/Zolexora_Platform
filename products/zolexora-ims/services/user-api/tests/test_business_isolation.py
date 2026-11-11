"""Two businesses on one IMS: neither can see or overwrite the other's data."""
import asyncio
import hashlib
import hmac
import json

import pytest
from starlette.testclient import TestClient

from auth import get_current_user
from catalog import PERMISSIONS
from conftest import member
from d1_adapter import D1Adapter
from main import app

A, B = "ZX-ORG-AAAA-0000-0001", "ZX-ORG-BBBB-0000-0002"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def act_as(org_id):
    user = member(*PERMISSIONS, org_id=org_id)
    app.dependency_overrides[get_current_user] = lambda: user


ITEM = {"item_code": "ISO-1", "description": "Tea", "category": "Bev", "uom": "Kg", "rate": 10, "central_stock": 5}


def test_items_are_per_business(client):
    act_as(A)
    assert client.post("/api/v1/items", json=ITEM).status_code == 201
    act_as(B)
    assert all(i["item_code"] != "ISO-1" for i in client.get("/api/v1/items").json())
    assert client.get("/api/v1/items/ISO-1").status_code == 404
    # Same code is free in another business, and B's writes never touch A's row
    assert client.post("/api/v1/items", json={**ITEM, "description": "Coffee"}).status_code == 201
    client.delete("/api/v1/items/ISO-1")
    act_as(A)
    assert client.get("/api/v1/items/ISO-1").json()["description"] == "Tea"


def test_payment_settings_are_per_business(client):
    act_as(A)
    res = client.post("/api/v1/payment/handle", json={"upi_handle": "shop-a@icici", "merchant_name": "Shop A"})
    assert res.status_code == 200
    act_as(B)
    cfg = client.get("/api/v1/payment/handle").json()
    assert cfg["upi_handle"] == "" and cfg["merchant_name"] == "Test Business"
    # No handle: no QR (never a fallback account)
    assert client.post("/api/v1/payment/generate-dynamic-qr", json={"amount": 10, "bill_no": "B1"}).status_code == 400
    act_as(A)
    assert client.post("/api/v1/payment/generate-dynamic-qr", json={"amount": 10, "bill_no": "A1"}).json()["upi_handle"] == "shop-a@icici"


def test_customers_and_tables_are_per_business(client):
    act_as(A)
    client.post("/api/v1/customers", json={"phone": "+919800000001", "name": "Asha"})
    client.post("/api/v1/tables", json={"id": "t1", "number": "T-01", "section": "Hall", "capacity": 4, "status": "Vacant"})
    act_as(B)
    client.post("/api/v1/customers", json={"phone": "+919800000001", "name": "Bala"})
    client.post("/api/v1/tables", json={"id": "t1", "number": "B-01", "section": "Patio", "capacity": 2, "status": "Vacant"})
    assert [c["name"] for c in client.get("/api/v1/customers").json()] == ["Bala"]
    act_as(A)
    assert [c["name"] for c in client.get("/api/v1/customers").json()] == ["Asha"]
    assert [t["number"] for t in client.get("/api/v1/tables").json()] == ["T-01"]


def test_cash_drawer_and_reports_are_per_business(client):
    act_as(A)
    client.post("/api/v1/cash-drawer/logs", json={"type": "Pay In", "amount": 500, "reason": "float", "cashier": "A"})
    act_as(B)
    assert client.get("/api/v1/cash-drawer/logs").json() == []
    assert client.get("/api/v1/reports/sales?range=All").json()["grossSales"] == 0


def test_aggregator_webhook_goes_to_the_named_business_only(client):
    act_as(A)
    res = client.post("/api/v1/aggregator/config/swiggy", json={"platform": "swiggy", "outlet_id": "OUT-A"})
    assert res.status_code == 200
    app.dependency_overrides.clear()
    body = json.dumps({"order_id": "SW-1", "customer": {"name": "C"}, "items": [{"name": "Dosa", "qty": 1, "price": 100}]}).encode()
    sig = {"X-Zolexora-Signature": "sha256=" + hmac.new(res.json()["webhook_secret"].encode(), body, hashlib.sha256).hexdigest()}
    assert client.post(f"/api/v1/aggregator/webhook/swiggy/{A}", content=body, headers=sig).status_code == 200
    # B never connected Swiggy
    assert client.post(f"/api/v1/aggregator/webhook/swiggy/{B}", content=body, headers=sig).status_code == 404
    act_as(B)
    assert client.get("/api/v1/aggregator/orders").json() == []
    assert client.delete("/api/v1/aggregator/orders").status_code == 200
    act_as(A)
    assert [o["id"] for o in client.get("/api/v1/aggregator/orders").json()] == ["SW-1"]


def test_refuses_to_start_on_old_demo_schema(tmp_path):
    import aiosqlite

    path = str(tmp_path / "old.db")

    async def run():
        async with aiosqlite.connect(path) as conn:
            await conn.execute("CREATE TABLE organizations (id TEXT PRIMARY KEY);")
            await conn.commit()
        await D1Adapter(account_id="", database_id="", api_token="", sqlite_path=path).init()

    with pytest.raises(RuntimeError, match="0002_drop_demo_schema"):
        asyncio.run(run())
