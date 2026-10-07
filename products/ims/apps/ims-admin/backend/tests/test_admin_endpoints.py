import os
import sys
import pytest
from starlette.testclient import TestClient

# Clear cached modules from previous test suites
for mod in ["main", "db", "auth", "models", "d1_adapter"]:
    sys.modules.pop(mod, None)

admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if admin_dir not in sys.path:
    sys.path.insert(0, admin_dir)

import main

app = main.app


def test_admin_api_health():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ims-admin-api"


def test_unauthenticated_admin_endpoints_return_401():
    """Verify that protected admin endpoints cannot be accessed without valid credentials."""
    with TestClient(app) as client:
        resp = client.get("/api/v1/organizations")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "SuperAdmin authorization required"

        resp_sql = client.post("/api/v1/sql", json={"sql": "SELECT 1;"})
        assert resp_sql.status_code == 401


def test_non_superadmin_role_returns_403():
    """Verify that valid JWTs with non-administrative roles are forbidden."""
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../backend-shared")))
    from security import create_jwt_token, get_jwt_secret

    user_token = create_jwt_token({"sub": "USR_001", "role": "Cashier", "email": "cashier@test.com"})
    with TestClient(app) as client:
        resp = client.get(
            "/api/v1/organizations",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Insufficient administrative privileges"


def test_superadmin_access_allowed(monkeypatch):
    """Verify that cryptographically verified SuperAdmin JWTs are accepted."""
    from unittest.mock import AsyncMock
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../backend-shared")))
    from security import create_jwt_token

    monkeypatch.setattr(main.db, "query", AsyncMock(return_value=[{
        "id": "ORG_1",
        "name": "Test Org",
        "industry": "Retail",
        "owner_email": "owner@test.com",
        "currency": "₹",
        "status": "Active",
        "created_at": "2026-09-05T00:00:00Z"
    }]))
    admin_token = create_jwt_token({"sub": "ADM_SUPER", "role": "SuperAdmin", "email": "super@test.com"})
    with TestClient(app) as client:
        resp = client.get(
            "/api/v1/organizations",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == "ORG_1"
