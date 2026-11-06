"""The identity proxy forwards only allow-listed admin calls to the auth service, with the caller's own token."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app import auth

UUID = "3f1c2a6e-8a3b-4c1d-9e2f-0a1b2c3d4e5f"


def reply(status=200, body=None):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body if body is not None else {"success": True}
    return r


@pytest.fixture(autouse=True)
def auth_url(monkeypatch):
    monkeypatch.setattr(auth, "AUTH_SERVICE_URL", "http://auth.test")


def test_forwards_queue_with_token_and_filters(client):
    with patch("app.routers.identity.httpx.AsyncClient.request", new=AsyncMock(return_value=reply(body={"verifications": []}))) as req:
        r = client.get("/api/identity/verifications?status=pending&evil=1", headers={"Authorization": "Bearer t"})
    assert r.status_code == 200
    method, url = req.call_args.args
    assert (method, url) == ("GET", "http://auth.test/api/v1/admin/verifications")
    assert req.call_args.kwargs["params"] == {"status": "pending"}
    assert req.call_args.kwargs["headers"] == {"Authorization": "Bearer t"}


def test_decision_body_is_forwarded_and_errors_keep_their_status(client):
    with patch("app.routers.identity.httpx.AsyncClient.request",
               new=AsyncMock(return_value=reply(400, {"code": "BAD_REQUEST", "message": "Give a reason"}))) as req:
        r = client.post(f"/api/identity/verifications/{UUID}/decision", json={"status": "rejected"}, headers={"Authorization": "Bearer t"})
    assert r.status_code == 400
    assert r.json()["detail"] == "Give a reason"
    assert req.call_args.kwargs["json"] == {"status": "rejected"}


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/identity/../auth/me"),
    ("POST", "/api/identity/verifications"),
    ("GET", "/api/identity/organizations"),
    ("POST", f"/api/identity/catalog/versions/{UUID}/delete"),
])
def test_only_listed_paths_pass(client, method, path):
    with patch("app.routers.identity.httpx.AsyncClient.request", new=AsyncMock()) as req:
        r = client.request(method, path, headers={"Authorization": "Bearer t"})
    assert r.status_code == 404
    req.assert_not_called()


def test_document_link_is_short_lived(client):
    with patch("app.routers.identity.httpx.AsyncClient.request", new=AsyncMock(return_value=reply(body={"url": "https://s3/x"}))) as req:
        r = client.post(f"/api/identity/documents/{UUID}/url", headers={"Authorization": "Bearer t"})
    assert r.json()["url"] == "https://s3/x"
    assert req.call_args.kwargs["json"] == {"document_id": UUID, "expiry_seconds": 900}


def test_requires_platform_admin_session():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        assert c.get("/api/identity/verifications").status_code == 401
