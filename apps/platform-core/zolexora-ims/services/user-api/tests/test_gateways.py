"""Gateway connections: connect, use, refresh, disconnect, against fake Razorpay/Cashfree OAuth servers."""
import base64
import json
import sqlite3
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

import gateways
import main
import payments
from auth import get_current_user
from catalog import PERMISSIONS
from conftest import member

ORG = "ZX-ORG-CONN-0000-0001"
WEB = "https://ims.example.com"


@pytest.fixture
def env(monkeypatch):
    for k, v in {"IMS_RAZORPAY_CLIENT_ID": "rzp_client", "IMS_RAZORPAY_CLIENT_SECRET": "rzp_client_secret",
                 "IMS_RAZORPAY_WEBHOOK_SECRET": "rzp_hook", "IMS_RAZORPAY_MODE": "test",
                 "IMS_CASHFREE_PARTNER_API_KEY": "cf_partner", "IMS_CASHFREE_CLIENT_ID": "cf_client",
                 "IMS_ENCRYPTION_KEY": base64.b64encode(b"k" * 32).decode(), "IMS_PUBLIC_URL": WEB}.items():
        monkeypatch.setenv(k, v)


@pytest.fixture
def providers(monkeypatch):
    """Fake OAuth servers; each token exchange/refresh issues new numbered tokens."""
    st = type("S", (), {"calls": [], "n": 0, "expires_in": 7862400, "refuse": False})()

    def handler(req: httpx.Request):
        st.calls.append(req)
        body = json.loads(req.content) if req.content else {}
        if st.refuse:
            return httpx.Response(400, json={"error": "invalid_grant"})
        if req.url.path.endswith("/auth_link"):
            return httpx.Response(200, json={"auth_link": f"https://merchant.cashfree.com/consent?state={body['state']}"})
        if req.url.path.endswith("/token"):
            st.n += 1
            return httpx.Response(200, json={"access_token": f"access{st.n}", "refresh_token": f"refresh{st.n}",
                                             "public_token": f"rzp_test_oauth_pub{st.n}", "expires_in": st.expires_in,
                                             "razorpay_account_id": "acc_RZP1", "merchant_id": "CFM1"})
        if "revoke" in req.url.path:
            return httpx.Response(200, json={"message": "Token Revoked"})
        if req.url.host == "api.razorpay.com":
            return httpx.Response(200, json={"id": "order_conn1", "amount": json.loads(req.content)["amount"]})
        return httpx.Response(404)

    real = httpx.AsyncClient
    fake = lambda **kw: real(transport=httpx.MockTransport(handler), **kw)
    monkeypatch.setattr(gateways.httpx, "AsyncClient", fake)
    monkeypatch.setattr(payments.httpx, "AsyncClient", fake)
    return st


@pytest.fixture
def client():
    db = sqlite3.connect(main.db.path) if __import__("os").path.exists(main.db.path) else None
    if db:  # each test starts with this business unconnected
        db.execute("DELETE FROM gateway_connections WHERE org_id = ?", [ORG]); db.commit(); db.close()
    main.app.dependency_overrides[get_current_user] = lambda: member(*PERMISSIONS, org_id=ORG)
    with TestClient(main.app, follow_redirects=False) as c:
        yield c
    main.app.dependency_overrides.clear()


def connect(client, provider, **extra):
    url = client.post(f"/api/v1/payment/connections/{provider}/start").json()["url"]
    state = parse_qs(urlparse(url).query)["state"][0]
    return client.get(f"/api/v1/payment/connections/{provider}/callback", params={"code": "c0de", "state": state, **extra})


def stored(provider):
    return sqlite3.connect(main.db.path).execute(
        "SELECT tokens, expires_at FROM gateway_connections WHERE org_id = ? AND provider = ?", [ORG, provider]).fetchone()


def test_not_offered_until_zolexora_is_a_partner(client, monkeypatch):
    for k in ("IMS_RAZORPAY_CLIENT_ID", "IMS_CASHFREE_PARTNER_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    listed = client.get("/api/v1/payment/connections").json()
    assert [(c["provider"], c["available"], c["connected"]) for c in listed] == [("razorpay", False, False), ("cashfree", False, False)]
    assert client.post("/api/v1/payment/connections/razorpay/start").status_code == 400


def test_razorpay_connect_stores_encrypted_tokens_and_pays_with_them(client, env, providers):
    url = client.post("/api/v1/payment/connections/razorpay/start").json()["url"]
    q = parse_qs(urlparse(url).query)
    assert url.startswith("https://auth.razorpay.com/authorize?") and q["client_id"] == ["rzp_client"]
    assert q["redirect_uri"] == [f"{WEB}/api/v1/payment/connections/razorpay/callback"] and q["scope"] == ["read_write"]

    res = client.get("/api/v1/payment/connections/razorpay/callback", params={"code": "c0de", "state": q["state"][0]})
    assert res.status_code == 302 and res.headers["location"] == f"{WEB}/cmd-panal/payments?connected=razorpay"
    exchange = json.loads(providers.calls[-1].content)
    assert exchange["grant_type"] == "authorization_code" and exchange["code"] == "c0de" and exchange["mode"] == "test"

    tokens, _ = stored("razorpay")
    assert "access1" not in tokens and "refresh1" not in tokens  # encrypted at rest
    listed = {c["provider"]: c for c in client.get("/api/v1/payment/connections").json()}
    assert listed["razorpay"]["connected"] and listed["razorpay"]["account_id"] == "acc_RZP1"

    order = client.post("/api/v1/payment/razorpay/create-order", json={"amount": 100, "bill_no": "B-C1"}).json()
    assert order["key_id"] == "rzp_test_oauth_pub1"
    assert providers.calls[-1].headers["Authorization"] == "Bearer access1"
    # The state is single use
    assert "connect_error" in client.get("/api/v1/payment/connections/razorpay/callback",
                                         params={"code": "c0de", "state": q["state"][0]}).headers["location"]


def test_cashfree_connect_and_refresh_keeps_only_the_newest_token(client, env, providers):
    providers.expires_in = 60  # access token about to expire: refreshed before use
    assert connect(client, "cashfree", merchant_id="CFM1").headers["location"].endswith("connected=cashfree")
    assert providers.calls[0].headers["x-partner-apikey"] == "cf_partner"

    import asyncio
    providers.expires_in = 86400  # what the refresh hands back
    creds = asyncio.run(main._gateway_credentials(ORG))
    refresh = json.loads(providers.calls[-1].content)
    assert refresh == {"grant_type": "refresh_token", "refresh_token": "refresh1"}
    assert creds["cashfree_access_token"] == "access2"
    assert asyncio.run(main._gateway_credentials(ORG))["cashfree_access_token"] == "access2"  # still fresh: no refresh
    tokens, _ = stored("cashfree")
    assert gateways.unseal(tokens, ORG, "cashfree")["refresh_token"] == "refresh2"


def test_refused_refresh_removes_the_connection(client, env, providers):
    providers.expires_in = 60
    connect(client, "cashfree")
    providers.refuse = True
    import asyncio
    assert "cashfree_access_token" not in asyncio.run(main._gateway_credentials(ORG))
    assert stored("cashfree") is None


def test_declined_consent_and_forged_state(client, env, providers):
    url = client.post("/api/v1/payment/connections/razorpay/start").json()["url"]
    state = parse_qs(urlparse(url).query)["state"][0]
    declined = client.get("/api/v1/payment/connections/razorpay/callback", params={"state": state, "error": "access_denied"})
    assert "connect_error" in declined.headers["location"] and stored("razorpay") is None
    forged = client.get("/api/v1/payment/connections/razorpay/callback", params={"state": "f" * 32, "code": "c"})
    assert "expired" in forged.headers["location"].replace("+", " ")


def test_tokens_are_bound_to_their_business():
    import os
    os.environ.setdefault("IMS_ENCRYPTION_KEY", base64.b64encode(b"k" * 32).decode())
    sealed = gateways.seal({"access_token": "a"}, ORG, "razorpay")
    assert gateways.unseal(sealed, ORG, "razorpay") == {"access_token": "a"}
    with pytest.raises(Exception):
        gateways.unseal(sealed, "ZX-ORG-OTHER", "razorpay")


def test_disconnect_revokes_and_returns_checkout_to_upi(client, env, providers):
    connect(client, "razorpay")
    assert client.post("/api/v1/payment/handle", json={"upi_handle": "shop@icici", "payment_gateway": "razorpay"}).status_code == 200
    res = client.delete("/api/v1/payment/connections/razorpay").json()
    assert res["revoked_at_provider"] is True
    assert {json.loads(c.content)["token_type_hint"] for c in providers.calls if "revoke" in c.url.path} == {"access_token", "refresh_token"}
    assert stored("razorpay") is None
    assert client.get("/api/v1/payment/handle").json()["payment_gateway"] == "upi_qr"


def test_provider_side_revocation_webhook_removes_the_connection(client, env, providers):
    import hashlib
    import hmac
    connect(client, "razorpay")
    main.app.dependency_overrides.clear()
    event = json.dumps({"event": "account.app.authorization_revoked", "account_id": "acc_RZP1", "contains": []}).encode()
    sig = hmac.new(b"rzp_hook", event, hashlib.sha256).hexdigest()
    assert client.post("/api/v1/payment/razorpay/webhook", content=event, headers={"X-Razorpay-Signature": sig}).status_code == 200
    assert stored("razorpay") is None
