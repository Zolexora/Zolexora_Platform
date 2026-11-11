import asyncio
import json
import re

import httpx
import pytest
from fastapi.routing import APIRoute
from starlette.testclient import TestClient

import auth
import catalog
from main import app

ORG = "ZX-ORG-TEST-0001-AAAA"


def me(product="ims", permissions=("ims:items:view",), org_status="active"):
    return {
        "authenticated": True,
        "user": {"member_id": "mem_1", "kind": "person", "zolexora_id": "ZX-1", "email": "a@b.co", "phone_number": None, "display_name": "Asha"},
        "org": {"zolexora_org_id": ORG, "name": "Acme", "status": org_status, "business_kind": "company"},
        "role": "manager",
        "product": product,
        "permissions": list(permissions),
    }


@pytest.fixture
def auth_service(monkeypatch):
    """Fakes the auth service's /api/v1/auth/me; set .response to (status, body)."""
    monkeypatch.setenv("AUTH_SERVICE_URL", "http://auth.test")
    auth._cache.clear()
    state = type("S", (), {"response": (200, me()), "calls": []})()

    def handler(request: httpx.Request):
        state.calls.append(request)
        status, body = state.response
        return httpx.Response(status, json=body)

    real = httpx.AsyncClient
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    yield state
    auth._cache.clear()


def get_items(token="tok"):
    with TestClient(app) as client:
        return client.get("/api/v1/items", headers={"Authorization": f"Bearer {token}"})


def test_ims_session_with_permission_is_accepted(auth_service, monkeypatch):
    from db import db
    from unittest.mock import AsyncMock

    query = AsyncMock(return_value=[])
    monkeypatch.setattr(db, "query", query)
    assert get_items().status_code == 200
    assert query.call_args.args[1][0] == ORG
    assert auth_service.calls[0].headers["Authorization"] == "Bearer tok"


def test_token_check_is_cached(auth_service, monkeypatch):
    from db import db
    from unittest.mock import AsyncMock

    monkeypatch.setattr(db, "query", AsyncMock(return_value=[]))
    get_items()
    get_items()
    assert len(auth_service.calls) == 1


@pytest.mark.parametrize(
    "response",
    [
        (401, {"success": False, "code": "AUTH_UNAUTHORIZED"}),
        (200, {"authenticated": True, "user": {"uid": "u1", "email": "a@b.co"}}),  # personal token
        (200, me(product="tms")),  # another product's session
        (200, me(product=None)),  # business session without a product
    ],
)
def test_rejected_tokens_get_401(auth_service, response):
    auth_service.response = response
    assert get_items().status_code == 401


def test_missing_permission_gets_403(auth_service):
    auth_service.response = (200, me(permissions=["ims:pos:sell"]))
    res = get_items()
    assert res.status_code == 403
    assert "ims:items:view" in res.json()["detail"]


def test_inactive_business_gets_403(auth_service):
    auth_service.response = (200, me(org_status="suspended"))
    assert get_items().status_code == 403


def test_auth_service_down_gets_503(auth_service):
    auth_service.response = (502, {})
    assert get_items().status_code == 503


def test_auth_service_not_configured_gets_503(auth_service, monkeypatch):
    monkeypatch.delenv("AUTH_SERVICE_URL")
    assert get_items().status_code == 503


PUBLIC = {"/health", "/api/v1/health", "/api/v1/aggregator/webhook/{channel}/{org_id}", "/api/v1/payment/razorpay/webhook/{org_id}", "/api/v1/payment/cashfree/webhook/{org_id}"}


def test_every_route_except_health_and_webhooks_needs_sign_in():
    app.dependency_overrides.clear()
    routes = [(r.path, m) for r in app.routes if isinstance(r, APIRoute) and r.path not in PUBLIC for m in r.methods]
    assert len(routes) > 40
    with TestClient(app) as client:
        for path, method in routes:
            url = re.sub(r"\{[^}]+\}", "x", path)
            res = client.request(method, url, json={})
            assert res.status_code == 401, f"{method} {path} answered {res.status_code} without a token"


def test_catalog_keys_are_ims_keys():
    for key in catalog.PERMISSIONS:
        assert re.fullmatch(r"ims:[a-z0-9_]+:[a-z0-9_]+", key), key


def test_catalog_registration(monkeypatch):
    monkeypatch.setenv("AUTH_SERVICE_URL", "http://auth.test/")
    monkeypatch.setenv("IMS_PRODUCT_KEY", "k")
    seen = []

    def handler(request: httpx.Request):
        seen.append(request)
        return httpx.Response(200, json={"success": True, "version": 1, "status": "applied", "added": [], "pending_removal": []})

    real = httpx.AsyncClient
    monkeypatch.setattr(catalog.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    asyncio.run(catalog.register_catalog())
    assert str(seen[0].url) == "http://auth.test/api/v1/catalog/ims"
    assert seen[0].method == "PUT"
    assert seen[0].headers["X-Product-Key"] == "k"
    assert {p["key"] for p in json.loads(seen[0].content)["permissions"]} == set(catalog.PERMISSIONS)


def test_catalog_registration_skips_without_key(monkeypatch):
    monkeypatch.setenv("AUTH_SERVICE_URL", "http://auth.test")
    monkeypatch.delenv("IMS_PRODUCT_KEY", raising=False)
    asyncio.run(catalog.register_catalog())  # logs a warning, never raises
