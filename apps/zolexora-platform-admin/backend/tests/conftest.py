import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.auth import require_platform_admin
from app.main import app
from app.services import infisical
from app.services.email import reset_daily_usage

TEST_ADMIN = {"uid": "admin-test", "email": "admin@example.com", "is_platform_admin": True}


@pytest.fixture(autouse=True)
def clean_state():
    """Resets in-memory state before each test."""
    reset_daily_usage()
    infisical._secrets_cache.clear()
    yield
    reset_daily_usage()
    infisical._secrets_cache.clear()


@pytest.fixture(autouse=True)
def email_providers(monkeypatch):
    """All three providers have keys and every provider HTTP call succeeds (no real network)."""
    for name in ("RESEND", "BREVO", "SENDGRID"):
        monkeypatch.setenv(f"{name}_API_KEY", f"test-{name.lower()}-key")

    async def ok(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"id": "msg_test", "messageId": "msg_test"}
        return resp

    with patch("app.services.email.httpx.AsyncClient.post", side_effect=ok):
        yield


@pytest.fixture
def client():
    """TestClient signed in as a platform admin (auth itself is covered in test_auth.py)."""
    app.dependency_overrides[require_platform_admin] = lambda: TEST_ADMIN
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
