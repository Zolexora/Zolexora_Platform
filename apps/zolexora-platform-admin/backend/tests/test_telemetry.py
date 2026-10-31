from app.db.config import POSTGRES_FREE_LIMIT_BYTES, MONGO_FREE_LIMIT_BYTES
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
        assert db["threshold_state"] in ("NORMAL", "WARNING", "CRITICAL")

def test_hot_tables_metrics_structure(client):
    """Verify hot tables contain schema, name, row estimate, and pretty size."""
    response = client.get("/api/telemetry/capacity")
    hot_tables = response.json()["hot_tables"]
    assert len(hot_tables) > 0

    first = hot_tables[0]
    assert "schema_name" in first
    assert "table_name" in first
    assert "row_count_estimate" in first
    assert "total_bytes" in first
    assert "total_size_pretty" in first
    assert "is_pinned" in first

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
    """POST /api/telemetry/archive/preview calculates required cutoff and skips pinned tables."""
    payload = {"database": "core", "target_capacity_percent": 40.0}
    response = client.post("/api/telemetry/archive/preview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["database"] == "core"
    assert data["current_usage_bytes"] > 0
    assert data["target_usage_bytes"] > 0
    assert data["estimated_rows_to_archive"] >= 0
    assert "cutoff_date" in data
    assert isinstance(data["pinned_tables_skipped"], list)
