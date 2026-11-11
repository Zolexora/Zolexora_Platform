"""Payments: a bill is paid only when the gateway proves it, for the amount we recorded."""
import base64
import hashlib
import hmac
import json
import uuid

import httpx
import pytest
from starlette.testclient import TestClient

import main
import payments
from auth import get_current_user
from catalog import PERMISSIONS
from conftest import member
from main import app

ORG = "ZX-ORG-PAYS-0000-0001"
HANDLE = {"upi_handle": "shop@icici", "merchant_name": "Shop"}
# What a gateway connection will provide; injected through main._gateway_credentials.
KEYS = {
    "razorpay_key_id": "rzp_test_k", "razorpay_key_secret": "rzp_secret", "razorpay_webhook_secret": "rzp_hook",
    "cashfree_app_id": "cf_app", "cashfree_secret_key": "cf_secret", "cashfree_env": "TEST",
}


@pytest.fixture
def client():
    user = member(*PERMISSIONS, org_id=ORG)
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def connected(monkeypatch):
    """This business has Razorpay and Cashfree connected (others have nothing)."""
    async def creds(org_id):
        return dict(KEYS) if org_id == ORG else {}
    monkeypatch.setattr(main, "_gateway_credentials", creds)


@pytest.fixture
def gateway(monkeypatch):
    """Fake Razorpay/Cashfree APIs. Set gateway.cashfree_status / .cashfree_amount per test."""
    state = type("G", (), {"calls": [], "cashfree_status": "ACTIVE", "cashfree_amount": 250.0})()

    def handler(req: httpx.Request):
        state.calls.append(req)
        if req.url.host == "api.razorpay.com":
            body = json.loads(req.content)
            return httpx.Response(200, json={"id": f"order_{uuid.uuid4().hex[:12]}", "amount": body["amount"]})
        if req.method == "POST":
            return httpx.Response(200, json={"order_id": json.loads(req.content)["order_id"], "payment_session_id": "sess_1"})
        return httpx.Response(200, json={"order_status": state.cashfree_status, "order_amount": state.cashfree_amount, "cf_order_id": 99})

    real = httpx.AsyncClient
    monkeypatch.setattr(payments.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    return state


def setup_keys(client, **overrides):
    res = client.post("/api/v1/payment/handle", json={**HANDLE, **overrides})
    assert res.status_code == 200, res.text
    return res


def test_handle_never_takes_gateway_keys_and_validates(client):
    cfg = setup_keys(client, razorpay_key_id="rzp_x", razorpay_key_secret="pasted", cashfree_secret_key="pasted").json()["config"]
    assert not {"razorpay_key_id", "razorpay_key_secret", "cashfree_secret_key"} & set(cfg)
    assert client.post("/api/v1/payment/handle", json={"upi_handle": "nobank"}).status_code == 400
    # A business without a gateway connection cannot pick Razorpay/Cashfree for checkout
    app.dependency_overrides[get_current_user] = lambda: member(*PERMISSIONS, org_id="ZX-ORG-NOKEYS-0000-0002")
    assert client.post("/api/v1/payment/handle", json={**HANDLE, "payment_gateway": "razorpay"}).status_code == 400


def test_dynamic_qr_uses_the_business_handle(client):
    setup_keys(client)
    data = client.post("/api/v1/payment/generate-dynamic-qr", json={"amount": 499.5, "bill_no": "B-1"}).json()
    assert data["upi_handle"] == "shop@icici"
    assert "pa=shop@icici" in data["upi_intent_url"] and "am=499.50" in data["upi_intent_url"]
    assert data["qr_code_url"].startswith("data:image/svg+xml")  # made here, not by a third-party QR service


def test_gateways_refuse_without_a_connection(client):
    other = member(*PERMISSIONS, org_id="ZX-ORG-NOKEYS-0000-0002")
    app.dependency_overrides[get_current_user] = lambda: other
    assert client.post("/api/v1/payment/razorpay/create-order", json={"amount": 10, "bill_no": "B"}).status_code == 400
    assert client.post("/api/v1/payment/cashfree/create-order", json={"amount": 10, "bill_no": "B", "customer_phone": "9800000001"}).status_code == 400


def test_razorpay_paid_only_with_a_valid_signature(client, gateway):
    setup_keys(client)
    order = client.post("/api/v1/payment/razorpay/create-order", json={"amount": 250, "bill_no": "B-2"}).json()
    oid = order["order_id"]
    assert order["amount_in_paise"] == 25000 and order["key_id"] == "rzp_test_k"
    assert gateway.calls[0].headers["Authorization"].startswith("Basic ")

    bad = {"razorpay_order_id": oid, "razorpay_payment_id": "pay_1", "razorpay_signature": "simulated_sig"}
    assert client.post("/api/v1/payment/razorpay/verify-payment", json=bad).status_code == 400

    sig = hmac.new(b"rzp_secret", f"{oid}|pay_1".encode(), hashlib.sha256).hexdigest()
    res = client.post("/api/v1/payment/razorpay/verify-payment", json={**bad, "razorpay_signature": sig})
    assert res.status_code == 200 and res.json()["settled"] is True and res.json()["amount"] == 250

    # Unknown order (or another business's) is not found
    assert client.post("/api/v1/payment/razorpay/verify-payment", json={**bad, "razorpay_order_id": "order_X", "razorpay_signature": sig}).status_code == 404


def test_cashfree_paid_only_when_cashfree_says_paid_for_our_amount(client, gateway):
    setup_keys(client)
    order = client.post("/api/v1/payment/cashfree/create-order", json={"amount": 250, "bill_no": "B-3", "customer_phone": "+91 98000 00001"}).json()
    assert order["payment_session_id"] == "sess_1"
    sent = json.loads(gateway.calls[0].content)
    assert sent["customer_details"]["customer_phone"] == "9800000001"
    assert gateway.calls[0].headers["x-client-id"] == "cf_app"
    verify = lambda: client.post("/api/v1/payment/cashfree/verify-payment", json={"order_id": order["order_id"]}).json()

    assert verify()["settled"] is False  # still ACTIVE
    gateway.cashfree_status, gateway.cashfree_amount = "PAID", 1.0
    assert verify()["settled"] is False  # wrong amount
    gateway.cashfree_amount = 250.0
    assert verify()["settled"] is True


def test_cashfree_needs_a_phone(client, gateway):
    setup_keys(client)
    assert client.post("/api/v1/payment/cashfree/create-order", json={"amount": 5, "bill_no": "B"}).status_code == 400


def test_manual_upi_is_recorded_not_claimed_as_settled(client):
    body = {"bill_no": "B-4", "amount": 120, "transaction_ref": "4123 5678 9012"}
    res = client.post("/api/v1/payment/verify", json=body).json()
    assert res["settled"] is False and res["confirmed_manually"] is True and res["transaction_ref"] == "412356789012"
    # The same UTR cannot settle a second bill; a missing/short one is refused
    assert client.post("/api/v1/payment/verify", json={**body, "bill_no": "B-5"}).status_code == 409
    assert client.post("/api/v1/payment/verify", json={**body, "transaction_ref": "12"}).status_code == 400
    assert client.post("/api/v1/payment/verify", json={"bill_no": "B-6", "amount": 1}).status_code == 422


def test_razorpay_webhook_needs_signature_and_matching_amount(client, gateway):
    setup_keys(client)
    oid = client.post("/api/v1/payment/razorpay/create-order", json={"amount": 250, "bill_no": "B-7"}).json()["order_id"]
    app.dependency_overrides.clear()
    event = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_9", "order_id": oid, "amount": 25000}}}}).encode()
    url = f"/api/v1/payment/razorpay/webhook/{ORG}"
    assert client.post(url, content=event, headers={"X-Razorpay-Signature": "nope"}).status_code == 401
    sig = hmac.new(b"rzp_hook", event, hashlib.sha256).hexdigest()
    assert client.post(url, content=event, headers={"X-Razorpay-Signature": sig}).status_code == 200


def test_cashfree_webhook_signature(client):
    setup_keys(client)
    app.dependency_overrides.clear()
    body = json.dumps({"data": {"order": {"order_id": "CF_X", "order_amount": 1}, "payment": {"payment_status": "SUCCESS"}}}).encode()
    ts = "1700000000"
    sig = base64.b64encode(hmac.new(b"cf_secret", ts.encode() + body, hashlib.sha256).digest()).decode()
    url = f"/api/v1/payment/cashfree/webhook/{ORG}"
    assert client.post(url, content=body, headers={"x-webhook-timestamp": ts, "x-webhook-signature": "bad"}).status_code == 401
    assert client.post(url, content=body, headers={"x-webhook-timestamp": ts, "x-webhook-signature": sig}).status_code == 200


def test_aggregator_webhook_needs_the_channel_signature(client):
    secret = client.post("/api/v1/aggregator/config/zomato", json={"platform": "zomato", "outlet_id": "Z-1"}).json()["webhook_secret"]
    app.dependency_overrides.clear()
    body = json.dumps({"order_id": "ZO-1", "items": [{"name": "Thali", "qty": 1, "price": 200}]}).encode()
    url = f"/api/v1/aggregator/webhook/zomato/{ORG}"
    assert client.post(url, content=body).status_code == 401
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert client.post(url, content=body, headers={"X-Zolexora-Signature": sig}).status_code == 200
