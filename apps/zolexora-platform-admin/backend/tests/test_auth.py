from unittest.mock import MagicMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient
from app import auth
from app.main import app


def me_response(status: int, user: dict | None = None):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = {"user": user, "authenticated": status == 200}
    return resp


@pytest.fixture
def raw_client(monkeypatch):
    """TestClient with the real auth dependency."""
    monkeypatch.setattr(auth, "AUTH_SERVICE_URL", "http://auth.test")
    with TestClient(app) as c:
        yield c


def test_liveness_needs_no_token(raw_client):
    assert raw_client.get("/api/health").status_code == 200


@pytest.mark.parametrize("path", ["/api/accounts", "/api/health/databases", "/api/telemetry/fleet", "/api/email/logs"])
def test_protected_routes_reject_missing_token(raw_client, path):
    assert raw_client.get(path).status_code == 401


def test_send_and_presign_reject_missing_token(raw_client):
    assert raw_client.post("/api/email/send", json={"product": "x", "to": ["a@b.c"], "subject": "s"}).status_code == 401
    assert raw_client.post("/api/storage/presigned-url", json={"product": "x", "file_key": "k"}).status_code == 401


def test_invalid_token_is_401(raw_client):
    with patch("app.auth.httpx.AsyncClient.get", return_value=me_response(401)) as get:
        r = raw_client.get("/api/accounts", headers={"Authorization": "Bearer bad"})
    assert r.status_code == 401
    assert get.call_args.kwargs["headers"] == {"Authorization": "Bearer bad"}


def test_non_admin_token_is_403(raw_client):
    with patch("app.auth.httpx.AsyncClient.get", return_value=me_response(200, {"uid": "u1", "is_platform_admin": False})):
        r = raw_client.get("/api/accounts", headers={"Authorization": "Bearer user"})
    assert r.status_code == 403


def test_platform_admin_token_is_allowed(raw_client):
    with patch("app.auth.httpx.AsyncClient.get", return_value=me_response(200, {"uid": "a1", "is_platform_admin": True})) as get:
        r = raw_client.get("/api/accounts", headers={"Authorization": "Bearer admin"})
    assert r.status_code == 200
    assert get.call_args.args[0] == "http://auth.test/api/v1/auth/me"


def test_auth_service_down_is_503(raw_client):
    with patch("app.auth.httpx.AsyncClient.get", side_effect=httpx.ConnectError("down")):
        r = raw_client.get("/api/accounts", headers={"Authorization": "Bearer admin"})
    assert r.status_code == 503


def test_missing_auth_service_url_is_503(raw_client, monkeypatch):
    monkeypatch.setattr(auth, "AUTH_SERVICE_URL", "")
    assert raw_client.get("/api/accounts", headers={"Authorization": "Bearer admin"}).status_code == 503


def test_cors_is_off_by_default(raw_client):
    r = raw_client.options("/api/accounts", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers
