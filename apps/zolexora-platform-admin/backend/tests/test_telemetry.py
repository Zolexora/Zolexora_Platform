from unittest.mock import AsyncMock, patch
from app.db.config import POSTGRES_FREE_LIMIT_BYTES, MONGO_FREE_LIMIT_BYTES
from tests.fakes import fake_pg_pool
from app.db.telemetry import (
    format_bytes,
    get_pinned_tables,
    toggle_table_pin,
)

def test_capacity_telemetry_endpoint(client):
    """GET /api/telemetry/capacity returns complete capacity and hot table metrics."""
    response = client.get("/api/telemetry/capacity")
    assert response.status_code == 200
    data = response.json()
    assert "databases" in data
    assert "overall_threshold_alert" in data
    assert "hot_tables" in data
    assert isinstance(data["databases"], list)
    assert len(data["databases"]) >= 5 # 4 supabase + 1 mongo

    # Verify free tier limits
    for db in data["databases"]:
        if db["service"] == "supabase_postgresql":
            assert db["free_tier_limit_bytes"] == POSTGRES_FREE_LIMIT_BYTES
        elif db["service"] == "mongodb_atlas":
            assert db["free_tier_limit_bytes"] == MONGO_FREE_LIMIT_BYTES
        assert "used_pretty" in db
        assert "usage_percentage" in db
        assert db["threshold_state"] in ("NORMAL", "WARNING", "CRITICAL", "UNCONFIGURED", "UNREACHABLE")

def test_hot_tables_metrics_structure(client):
    """Hot tables come from pg_stat_user_tables of every reachable project."""
    table = {"schemaname": "tms", "tablename": "shipments", "row_count": 1200, "total_bytes": 4 * 1024 * 1024}
    with patch("app.db.telemetry.get_asyncpg_pool", AsyncMock(return_value=fake_pg_pool(10 * 1024 * 1024, [table]))):
        response = client.get("/api/telemetry/capacity")
    hot_tables = response.json()["hot_tables"]
    assert len(hot_tables) > 0

    first = hot_tables[0]
    assert first["schema_name"] == "tms"
    assert first["table_name"] == "shipments"
    assert first["row_count_estimate"] == 1200
    assert first["total_size_pretty"] == "4.0 MB"
    assert "is_pinned" in first

def test_unconfigured_database_is_not_reported_unreachable(client):
    data = client.get("/api/telemetry/capacity").json()
    pg = [d for d in data["databases"] if d["service"] == "supabase_postgresql"]
    assert all(d["threshold_state"] == "UNCONFIGURED" for d in pg)

def test_configured_but_down_database_is_unreachable(client):
    with patch("app.db.telemetry.get_pg_pool_dsn", return_value="postgresql://x"), \
         patch("app.db.telemetry.get_asyncpg_pool", AsyncMock(return_value=None)):
        data = client.get("/api/telemetry/capacity").json()
    pg = [d for d in data["databases"] if d["service"] == "supabase_postgresql"]
    assert all(d["threshold_state"] == "UNREACHABLE" and d["is_configured"] for d in pg)

def test_format_bytes():
    """Verify human readable byte formatting."""
    assert "KB" in format_bytes(500 * 1024)
    assert "MB" in format_bytes(45 * 1024 * 1024)
    assert "GB" in format_bytes(2 * 1024 * 1024 * 1024)

def test_archive_pinning_and_exclusions(client):
    """Test hot storage pinning: tables pinned are excluded from archiving."""
    table = "test_schema.test_table"
    toggle_table_pin(table, True)
    assert table in get_pinned_tables()

    # Via API
    resp = client.get("/api/telemetry/archive/exclusions")
    assert resp.status_code == 200
    assert table in resp.json()["pinned_tables"]

    # Toggle off
    resp_off = client.post("/api/telemetry/archive/exclusions/toggle", json={"table_name": table, "pinned": False})
    assert resp_off.status_code == 200
    assert table not in resp_off.json()["pinned_tables"]

def test_archive_preview_calculation(client):
    """Preview uses the live database size and average row size."""
    used = int(POSTGRES_FREE_LIMIT_BYTES * 0.6)
    table = {"schemaname": "tms", "tablename": "events", "row_count": 1000, "total_bytes": 2048 * 1000}
    with patch("app.db.telemetry.get_asyncpg_pool", AsyncMock(return_value=fake_pg_pool(used, [table]))):
        response = client.post("/api/telemetry/archive/preview", json={"database": "core", "target_capacity_percent": 40.0})
    assert response.status_code == 200
    data = response.json()
    assert data["database"] == "core"
    assert data["current_usage_bytes"] == used
    assert data["target_usage_bytes"] == int(POSTGRES_FREE_LIMIT_BYTES * 0.4)
    assert data["estimated_rows_to_archive"] == (used - data["target_usage_bytes"]) // 2048
    assert "cutoff_date" in data
    assert isinstance(data["pinned_tables_skipped"], list)

def test_archive_preview_unreachable_database_is_zero(client):
    data = client.post("/api/telemetry/archive/preview", json={"database": "core"}).json()
    assert data["current_usage_bytes"] == 0
    assert data["estimated_rows_to_archive"] == 0

def test_archive_preview_unknown_database_is_422(client):
    assert client.post("/api/telemetry/archive/preview", json={"database": "nope"}).status_code == 422

def test_archive_preview_accepts_capacity_card_names(client):
    """The UI passes project_or_cluster from the capacity cards."""
    assert client.post("/api/telemetry/archive/preview", json={"database": "supabase_core"}).status_code == 200
    assert client.post("/api/telemetry/archive/preview", json={"database": "cluster0"}).status_code == 200
