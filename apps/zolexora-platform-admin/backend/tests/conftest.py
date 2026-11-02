import re
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app import connections
from app.auth import require_platform_admin
from app.connections import Connection
from app.main import app
from app.services import email

TEST_ADMIN = {"uid": "admin-test", "email": "admin@example.com", "is_platform_admin": True}


ADMIN_PATH = "/Admin_Panel"


class FakeStore:
    """In-memory stand-in for Infisical values (per folder) and for the connection-records file."""

    parent = ADMIN_PATH

    def __init__(self):
        self.items: dict[str, Connection] = {}
        self.values: dict[str, dict[str, str]] = {ADMIN_PATH: {}}

    async def read_folder(self, path):
        return dict(self.values.get(path, {}))

    async def list(self):
        return list(self.items.values())

    async def put(self, conn, create):
        self.items[conn.id] = conn

    async def delete(self, conn_id):
        self.items.pop(conn_id, None)


@pytest.fixture(autouse=True)
def store(monkeypatch, tmp_path):
    """Fresh fake store, empty cache, temp data dir, zeroed email counters for every test."""
    fake = FakeStore()
    monkeypatch.setattr(connections, "_store", fake)         # Infisical values
    monkeypatch.setattr(connections, "_record_store", fake)  # connection records (RecordFile tested separately)
    monkeypatch.setattr(connections, "_cache", None)
    connections.forget_values()
    monkeypatch.setenv("ADMIN_DATA_DIR", str(tmp_path))
    email.reset_daily_usage()
    email._fallback_logs.clear()
    return fake


@pytest.fixture
def email_http_ok():
    """Every provider send succeeds (no real network). Patches httpx.AsyncClient.post globally,
    so only the email tests use it."""
    async def ok(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"id": "msg_test", "messageId": "msg_test"}
        return resp

    with patch("app.services.email.httpx.AsyncClient.post", side_effect=ok) as post:
        yield post


def seed_keys(store, name, values):
    """Puts values into fake Infisical under generated key names; returns {field: KEY_NAME}."""
    prefix = re.sub(r"[^A-Z0-9]+", "_", name.upper()).strip("_")
    keys = {}
    for field, value in values.items():
        keys[field] = f"{prefix}_{field.upper()}"
        store.values[ADMIN_PATH][keys[field]] = value
    return keys


@pytest.fixture
def post_conn(client, store):
    """POST /api/connections from a {"provider", "name", "config": {values}} body:
    the values go into (fake) Infisical first, the panel only gets the key names."""
    def _post(body):
        keys = seed_keys(store, body["name"], body.get("config", {}))
        return client.post("/api/connections", json={"provider": body["provider"], "name": body["name"], "keys": keys})
    return _post


@pytest.fixture
def client():
    """TestClient signed in as a platform admin (auth itself is covered in test_auth.py)."""
    app.dependency_overrides[require_platform_admin] = lambda: TEST_ADMIN
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
