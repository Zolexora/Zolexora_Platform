"""Gateway secrets live in the Infisical folder, never in the database."""
import asyncio
import json
import sqlite3

import httpx
import pytest
from fastapi.testclient import TestClient

import main
from auth import get_current_user
from catalog import PERMISSIONS
from conftest import member
import vault as vault_mod
from vault import GatewayVault, VaultError

ORG = "ZX-ORG-TEST-0001-AAAA"


@pytest.fixture
def client():
    main.app.dependency_overrides[get_current_user] = lambda: member(*PERMISSIONS, org_id=ORG)
    with TestClient(main.app) as c:
        yield c
    main.app.dependency_overrides.clear()


def test_secrets_saved_to_vault_not_database(client):
    res = client.post("/api/v1/payment/handle", json={
        "upi_handle": "shop@okhdfcbank", "razorpay_key_id": "rzp_k", "razorpay_key_secret": "rzp_s",
        "razorpay_webhook_secret": "rzp_h", "cashfree_app_id": "cf_a", "cashfree_secret_key": "cf_s"})
    assert res.status_code == 200
    assert main.vault.data[ORG] == {"razorpay_key_secret": "rzp_s", "razorpay_webhook_secret": "rzp_h", "cashfree_secret_key": "cf_s"}
    row = sqlite3.connect(main.db.path).execute(
        "SELECT value FROM settings WHERE org_id = ? AND key = 'PAYMENT_HANDLE_CONFIG'", [ORG]).fetchone()[0]
    assert "rzp_s" not in row and "rzp_h" not in row and "cf_s" not in row
    assert json.loads(row)["razorpay_key_id"] == "rzp_k"


@pytest.fixture
def infisical(monkeypatch):
    """A fake Infisical API; returns its stored secrets and the calls it saw."""
    store, calls = {}, []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(f"{req.method} {req.url.path}")
        if req.url.path.endswith("/universal-auth/login"):
            return httpx.Response(200, json={"accessToken": "t"})
        name = req.url.path.rsplit("/", 1)[1]
        if req.method == "GET":
            assert req.url.params["secretPath"] == "/Zolexora_IMS_Gateways"
            return httpx.Response(200, json={"secret": {"secretValue": store[name]}}) if name in store else httpx.Response(404)
        body = json.loads(req.content)
        if req.method == "PATCH" and name not in store:
            return httpx.Response(404)
        store[name] = body["secretValue"]
        return httpx.Response(200, json={})

    real = httpx.AsyncClient
    monkeypatch.setattr(vault_mod.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    for k, v in {"IMS_VAULT_CLIENT_ID": "id", "IMS_VAULT_CLIENT_SECRET": "s", "IMS_VAULT_PROJECT_ID": "p", "IMS_VAULT_ENV": "prod"}.items():
        monkeypatch.setenv(k, v)
    return store, calls


def test_client_creates_then_reads_one_secret_per_business(infisical):
    store, calls = infisical
    v = GatewayVault()
    assert asyncio.run(v.get(ORG)) == {}
    asyncio.run(v.put(ORG, {"razorpay_key_secret": "s1", "unknown": "x"}))
    assert json.loads(store["ORG_ZX_ORG_TEST_0001_AAAA"]) == {"razorpay_key_secret": "s1"}
    assert "PATCH /api/v3/secrets/raw/ORG_ZX_ORG_TEST_0001_AAAA" in calls and calls[-1].startswith("POST")
    assert asyncio.run(GatewayVault().get(ORG)) == {"razorpay_key_secret": "s1"}


def test_unconfigured_vault_and_bad_ids_refuse(monkeypatch):
    for k in ("IMS_VAULT_CLIENT_ID", "IMS_VAULT_CLIENT_SECRET", "IMS_VAULT_PROJECT_ID", "IMS_VAULT_ENV"):
        monkeypatch.delenv(k, raising=False)
    assert not GatewayVault().configured
    with pytest.raises(VaultError):
        GatewayVault.key("../x")
