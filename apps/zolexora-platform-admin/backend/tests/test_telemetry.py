from unittest.mock import AsyncMock, MagicMock, patch
from app.clients import Probe
from app.services.telemetry import (
    MONGO_FREE_LIMIT_BYTES, POSTGRES_FREE_LIMIT_BYTES, format_bytes, get_pinned_tables, toggle_table_pin,
)
from tests.fakes import fake_pg_pool

PG = {"provider": "supabase", "name": "Core", "config": {"url": "https://abc.supabase.co", "api_key": "k", "pg_url": "postgresql://m@h/db"}}
MONGO = {"provider": "mongodb", "name": "Atlas", "config": {"uri": "mongodb+srv://u:p@cluster0.x.mongodb.net/?a=1", "database": "db_ai"}}


def add(post_conn, body):
    return post_conn(body).json()["id"]


def test_capacity_empty_without_connections(client):
    data = client.get("/api/telemetry/capacity").json()
    assert data["databases"] == [] and data["hot_tables"] == [] and data["overall_threshold_alert"] is False


def test_capacity_states_from_live_size(client, post_conn):
    conn_id = add(post_conn, PG)
    for pct, state in ((0.79, "NORMAL"), (0.85, "WARNING"), (0.92, "CRITICAL")):
        with patch("app.services.telemetry.clients.pg_pool", AsyncMock(return_value=fake_pg_pool(int(POSTGRES_FREE_LIMIT_BYTES * pct)))):
            db = client.get("/api/telemetry/capacity").json()["databases"][0]
        assert db["connection_id"] == conn_id and db["threshold_state"] == state
        assert db["usage_percentage"] == round(pct * 100, 2)


def test_supabase_without_pg_url_has_no_capacity_card(client, post_conn):
    add(post_conn, {**PG, "config": {"url": "https://abc.supabase.co", "api_key": "k"}})
    assert client.get("/api/telemetry/capacity").json()["databases"] == []


def test_unreachable_postgres(client, post_conn):
    add(post_conn, PG)
    with patch("app.services.telemetry.clients.pg_pool", AsyncMock(return_value=None)):
        db = client.get("/api/telemetry/capacity").json()["databases"][0]
    assert db["threshold_state"] == "UNREACHABLE" and db["used_pretty"] == "Unreachable"


def test_mongo_capacity_and_overall_alert(client, post_conn):
    add(post_conn, MONGO)
    db = MagicMock()
    db.command = AsyncMock(return_value={"storageSize": int(MONGO_FREE_LIMIT_BYTES * 0.95), "indexSize": 0})
    with patch("app.services.telemetry.clients.mongo_db", return_value=db):
        data = client.get("/api/telemetry/capacity").json()
    assert data["overall_threshold_alert"] is True
    assert data["databases"][0]["service"] == "mongodb_atlas"


def test_hot_tables(client, post_conn):
    conn_id = add(post_conn, PG)
    table = {"schemaname": "tms", "tablename": "shipments", "row_count": 1200, "total_bytes": 4 * 1024 * 1024}
    toggle_table_pin("tms.shipments", True)
    with patch("app.services.telemetry.clients.pg_pool", AsyncMock(return_value=fake_pg_pool(10, [table]))):
        t = client.get("/api/telemetry/capacity").json()["hot_tables"][0]
    assert t["connection_id"] == conn_id and t["total_size_pretty"] == "4.0 MB" and t["is_pinned"] is True


def test_archive_preview(client, post_conn):
    conn_id = add(post_conn, PG)
    used = int(POSTGRES_FREE_LIMIT_BYTES * 0.6)
    table = {"schemaname": "tms", "tablename": "events", "row_count": 1000, "total_bytes": 2048 * 1000}
    with patch("app.services.telemetry.clients.pg_pool", AsyncMock(return_value=fake_pg_pool(used, [table]))):
        data = client.post("/api/telemetry/archive/preview", json={"database": conn_id, "target_capacity_percent": 40}).json()
    assert data["current_usage_bytes"] == used
    assert data["estimated_rows_to_archive"] == (used - int(POSTGRES_FREE_LIMIT_BYTES * 0.4)) // 2048


def test_archive_preview_rejects_non_database(client, post_conn):
    conn_id = add(post_conn, {"provider": "resend", "name": "r", "config": {"api_key": "k"}})
    assert client.post("/api/telemetry/archive/preview", json={"database": conn_id}).status_code == 422
    assert client.post("/api/telemetry/archive/preview", json={"database": "nope"}).status_code == 422


def test_pins_persist_in_data_dir(client, tmp_path):
    toggle_table_pin("a.b", True)
    assert "a.b" in get_pinned_tables()
    assert (tmp_path / "archive_exclusions.json").exists()
    assert "a.b" not in client.post("/api/telemetry/archive/exclusions/toggle", json={"table_name": "a.b", "pinned": False}).json()["pinned_tables"]


def test_database_health_and_fleet_use_probes(client, post_conn):
    pg, mongo = add(post_conn, PG), add(post_conn, MONGO)
    client.put(f"/api/connections/{mongo}/status", json={"status": "DRAINING"})

    async def probe(conn):
        return Probe(status="healthy", latency_ms=7, detail="ok") if conn.id == pg else Probe(status="degraded", detail="timeout")

    with patch("app.services.telemetry.clients.probe", side_effect=probe):
        health = client.get("/api/health/databases").json()
    assert health["overall_status"] == "degraded"
    assert health["targets"][pg]["status"] == "healthy" and health["targets"][mongo]["error"] == "timeout"

    with patch("app.services.telemetry.clients.probe_all", AsyncMock(return_value=[Probe(status="healthy", latency_ms=7, detail="ok"), Probe(status="degraded", detail="x")])), \
         patch("app.services.telemetry._first_ok", AsyncMock(return_value=(True, 1))):
        services = {s["id"]: s for s in client.get("/api/telemetry/fleet").json()["services"]}
    assert services[f"fleet-{mongo}"]["status"] == "stopped"  # draining
    assert services[f"fleet-{pg}"]["endpoint"] == "abc"
    assert "u:p" not in services[f"fleet-{mongo}"]["endpoint"]  # no credentials shown


def test_no_connections_is_healthy_not_failing(client):
    assert client.get("/api/health/databases").json()["overall_status"] == "healthy"


def test_format_bytes():
    assert format_bytes(500 * 1024) == "500.0 KB"
    assert format_bytes(2 * 1024 ** 3) == "2.00 GB"
