import os
import sys
import pytest
from unittest.mock import AsyncMock
from starlette.testclient import TestClient

# Add app backend to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import app
from db import db


from models import UserProfile
from auth import get_current_user


def test_user_api_health():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ims-user-api"
        assert data["database"] == "Cloudflare D1"


def test_unauthenticated_items_access_denied():
    """Verify that requests without credentials cannot bypass authentication and receive HTTP 401."""
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        resp = client.get("/api/v1/items")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Authentication credentials required"


def test_list_items(monkeypatch):
    mock_items = [
        {
            "item_code": "ITM_001",
            "org_id": "ORG_ZOLEXORA_001",
            "description": "Special Assam Orthodox Tea Leaves",
            "category": "Tea & Beverages",
            "category_code": "CAT_TEA",
            "uom": "Kg",
            "rate": 650.0,
            "tax_percent": 5.0,
            "min_stock": 10.0,
            "stock_s_001": 25.0,
            "stock_s_002": 15.0,
            "central_stock": 40.0,
            "total_stock": 80.0,
            "total_valuation": 52000.0,
            "preferred_supplier_code": "SUP_021",
            "status": "Active",
            "last_updated": "2026-09-04T00:00:00.000Z"
        }
    ]
    monkeypatch.setattr(db, "query", AsyncMock(return_value=mock_items))
    
    mock_user = UserProfile(
        id="USR_TEST_001",
        org_id="ORG_ZOLEXORA_001",
        email="test@zolexora.com",
        name="Test User",
        role="Store Incharge",
        scope_type="ALL",
        assigned_location="ALL",
        status="Active"
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user

    try:
        with TestClient(app) as client:
            resp = client.get("/api/v1/items")
            assert resp.status_code == 200
            items = resp.json()
            assert isinstance(items, list)
            assert len(items) == 1
            assert items[0]["item_code"] == "ITM_001"
    finally:
        app.dependency_overrides.clear()
