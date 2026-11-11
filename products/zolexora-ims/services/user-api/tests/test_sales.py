"""Sales: prices, tax and totals come from the item master; a UPI sale needs a confirmed payment."""
import pytest
from starlette.testclient import TestClient

from main import app

ORG = "ZX-ORG-SALE-0000-0001"


@pytest.fixture
def client(as_owner, as_member):
    as_member(*__import__("catalog").PERMISSIONS, org_id=ORG)
    with TestClient(app) as c:
        assert c.post("/api/v1/stores", json={"code": "S_001", "name": "Main"}).status_code == 201
        assert c.post("/api/v1/selling-points", json={"code": "sp_1", "name": "Till 1", "assigned_store_code": "S_001"}).status_code == 201
        for code, rate, tax in (("TEA", 100, 5), ("CAKE", 200, 18)):
            c.post("/api/v1/items", json={"item_code": code, "description": code, "category": "Food", "uom": "Pcs", "rate": rate, "tax_percent": tax})
            c.post(f"/api/v1/items/{code}/adjust", json={"store_code": "S_001", "adjustment": 10})
        yield c


def sale(client, bill, **kw):
    body = {"selling_point_code": "SP_1", "bill_no": bill, "items": [{"item_code": "TEA", "quantity": 2}, {"item_code": "CAKE", "quantity": 1}], **kw}
    return client.post("/api/v1/sales", json=body)


def tea(client):
    return client.get("/api/v1/items/TEA").json()["stock_s_001"]


def test_total_uses_item_master_tax_and_discount(client):
    before = tea(client)
    # 2×100×1.05 + 200×1.18 = 446; with ₹40 off (10%): 401.4 → 401
    res = sale(client, "B-T1", discount_amount=40, items=[{"item_code": "TEA", "quantity": 2, "rate": 1}, {"item_code": "CAKE", "quantity": 1}])
    assert res.status_code == 201, res.text
    assert res.json()["total_amount"] == 401
    assert tea(client) == before - 2


def test_bad_sales_are_refused(client):
    before = tea(client)
    assert sale(client, "B-X1", selling_point_code="NOPE").status_code == 400
    assert sale(client, "B-X2", items=[{"item_code": "GHOST", "quantity": 1}]).status_code == 400
    assert sale(client, "B-X3", items=[{"item_code": "TEA", "quantity": 0}]).status_code == 422
    assert sale(client, "B-X4", discount_amount=9999).status_code == 400
    assert sale(client, "B-X5").status_code == 201
    assert sale(client, "B-X5").status_code == 409  # same bill twice
    assert tea(client) == before - 2  # only B-X5 took stock


def test_upi_sale_needs_a_confirmed_payment_for_this_bill_and_amount(client):
    assert sale(client, "B-U1", payment_mode="UPI").status_code == 402
    pay = client.post("/api/v1/payment/verify", json={"bill_no": "B-U1", "amount": 446, "payment_mode": "UPI", "transaction_ref": "UTR123456789"}).json()
    assert sale(client, "B-U2", payment_mode="UPI", payment_id=pay["payment_id"]).status_code == 409  # other bill
    assert sale(client, "B-U1", payment_mode="UPI", payment_id=pay["payment_id"], discount_amount=10).status_code == 409  # other amount
    res = sale(client, "B-U1", payment_mode="UPI", payment_id=pay["payment_id"])
    assert res.status_code == 201 and res.json()["payment_status"] == "Confirmed by cashier"


def test_selling_needs_no_stock_adjust_permission(as_member):
    as_member("ims:pos:sell", org_id=ORG)
    with TestClient(app) as c:
        assert c.post("/api/v1/items/TEA/adjust", json={"store_code": "S_001", "adjustment": 100}).status_code == 403
        assert c.post("/api/v1/stores", json={"code": "S_002", "name": "x"}).status_code == 403


def test_store_codes_match_the_stock_columns(client):
    assert client.post("/api/v1/stores", json={"code": "S_009", "name": "x"}).status_code == 422
    assert client.post("/api/v1/selling-points", json={"code": "SP_9", "name": "x", "assigned_store_code": "S_002"}).status_code == 400
