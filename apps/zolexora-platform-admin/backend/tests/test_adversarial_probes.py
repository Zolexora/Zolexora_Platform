import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.db.config import (
    POSTGRES_FREE_LIMIT_BYTES,
    MONGO_FREE_LIMIT_BYTES,
    SUPABASE_PROJECTS,
)
from app.db.health import get_system_health, check_supabase_health, check_mongo_health
from app.services.accounts import (
    sync_accounts_from_infisical,
    get_accounts_list,
    clear_diagnostic_alerts,
)
from app.services.email import (
    send_email,
    set_daily_usage,
    reset_daily_usage,
    get_daily_usage,
)
from app.schemas.email import EmailSendRequest
from app.db.telemetry import (
    collect_postgres_capacity,
    collect_mongo_capacity,
    get_capacity_telemetry,
    toggle_table_pin,
    get_pinned_tables,
    calculate_archive_preview,
    save_pinned_tables,
)

# ============================================================================
# ADVERSARIAL PROBE SUITE — CHALLENGER_M4_1
# ============================================================================

# ----------------------------------------------------------------------------
# 1. Adversarial Probing: /api/health/databases under Complete Environmental Chaos
# ----------------------------------------------------------------------------

def test_probe_health_databases_completely_empty_env(client):
    """
    Probe /api/health/databases when ALL environment variables are stripped.
    Must return HTTP 200 with overall_status 'degraded' or 'unhealthy',
    and never crash with an unhandled HTTP 500.
    """
    with patch.dict(os.environ, {}, clear=True):
        response = client.get("/api/health/databases")
        assert response.status_code == 200, f"Expected HTTP 200 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data["overall_status"] in ("degraded", "unhealthy")
        assert "targets" in data
        assert len(data["targets"]) == 5  # 4 Supabase + 1 Mongo

        for target_name, target in data["targets"].items():
            assert target["status"] in ("unconfigured", "degraded")
            assert target["latency_ms"] == -1
            assert target["details"] or target["error"]


def test_probe_health_databases_malformed_credentials(client):
    """
    Probe /api/health/databases when credentials are set to garbage strings,
    non-URL values, and non-resolving endpoints.
    Must return HTTP 200 without throwing 500.
    """
    garbage_env = {
        "SUPABASE_CORE_URL": "not_a_valid_url://nonsense:99999",
        "SUPABASE_CORE_SERVICE_KEY": "garbage_token_value",
        "SUPABASE_COMMERCE_URL": "http://127.0.0.1:59999/unreachable",
        "SUPABASE_COMMERCE_SERVICE_KEY": "dummy_key",
        "MONGO_URI": "mongodb://invalid-host-that-never-resolves.zolexora.internal:27017",
    }
    with patch.dict(os.environ, garbage_env, clear=True):
        response = client.get("/api/health/databases")
        assert response.status_code == 200, f"Expected HTTP 200 but got {response.status_code}"
        data = response.json()
        assert data["overall_status"] in ("degraded", "unhealthy")
        assert "targets" in data


@pytest.mark.asyncio
async def test_probe_health_databases_direct_exception_injection():
    """
    Stress-test check_supabase_health and check_mongo_health directly with
    injected arbitrary OS/network exceptions (e.g. MemoryError, ConnectionResetError).
    """
    with patch("app.db.health.get_supabase_url", return_value="https://test.supabase.co"), \
         patch("app.db.health.get_supabase_key", return_value="service_key"), \
         patch("app.db.health.get_supabase") as mock_get_client:
        mock_client = MagicMock()
        mock_client.table.side_effect = RuntimeError("Kernel TCP stack abort")
        mock_get_client.return_value = mock_client

        res = await check_supabase_health("core")
        assert res.status == "degraded"
        assert res.latency_ms == -1
        assert "Kernel TCP stack abort" in res.error

    with patch("os.getenv", return_value="mongodb://localhost:27017"), \
         patch("app.db.health.get_mongo") as mock_get_mongo:
        mock_db = MagicMock()
        mock_db.command = AsyncMock(side_effect=ConnectionResetError("Peer reset"))
        mock_get_mongo.return_value = mock_db

        m_res = await check_mongo_health()
        assert m_res.status == "degraded"
        assert m_res.latency_ms == -1
        assert "Peer reset" in m_res.error


# ----------------------------------------------------------------------------
# 2. Adversarial Probing: /api/email/send Quota Exhaustion & Dynamic Rollover
# ----------------------------------------------------------------------------

def test_probe_email_send_boundary_thresholds(client):
    """
    Boundary probe:
    Resend daily limit = 100.
    At 89 emails (89.0%): below 90% threshold -> uses Resend.
    At 90 emails (90.0%): reaches 90% threshold -> must rollover to Brevo.
    """
    reset_daily_usage()
    set_daily_usage("resend", 89)

    req_payload = {
        "product": "zolexora-tms",
        "to": ["boundary-test@example.com"],
        "subject": "Boundary Test 89%",
        "text_content": "Testing 89% threshold"
    }
    resp89 = client.post("/api/email/send", json=req_payload)
    assert resp89.status_code == 200
    assert resp89.json()["provider_used"] == "resend"
    assert resp89.json()["success"] is True
    assert get_daily_usage("resend") == 90  # Now at 90

    # Next send: Resend is at 90 (90.0%), should rollover to Brevo
    resp90 = client.post("/api/email/send", json=req_payload)
    assert resp90.status_code == 200
    assert resp90.json()["provider_used"] == "brevo"
    assert resp90.json()["success"] is True
    assert get_daily_usage("brevo") == 1


def test_probe_email_send_cascade_failover_to_sendgrid(client):
    """
    Probe full cascade rollover:
    Resend: 90/100 (90%) -> exhausted
    Brevo: 270/300 (90%) -> exhausted
    SendGrid: 10/100 (10%) -> should take the traffic!
    """
    reset_daily_usage()
    set_daily_usage("resend", 90)
    set_daily_usage("brevo", 270)
    set_daily_usage("sendgrid", 10)

    req_payload = {
        "product": "zolexora-engage",
        "to": ["cascade-test@example.com"],
        "subject": "Cascade Rollover Test",
        "html_content": "<h1>Testing rollover</h1>"
    }
    resp = client.post("/api/email/send", json=req_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["provider_used"] == "sendgrid"
    assert data["attempt_count"] == 3
    assert get_daily_usage("sendgrid") == 11


@pytest.mark.asyncio
async def test_probe_email_send_network_failure_failover(monkeypatch):
    """
    Simulate live provider HTTP calls where Resend times out, triggering
    automatic runtime failover to Brevo without throwing an exception.
    """
    reset_daily_usage()
    monkeypatch.setenv("RESEND_API_KEY", "live-resend-key-12345")
    monkeypatch.setenv("BREVO_API_KEY", "mock-brevo-key")

    async def mock_post(url, *args, **kwargs):
        if "resend.com" in str(url):
            raise httpx.ConnectTimeout("Connection to api.resend.com timed out")
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"messageId": "brevo_mock_id_999"}
        return resp

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        req = EmailSendRequest(
            product="zolexora-tms",
            to=["timeout-test@example.com"],
            subject="Timeout Failover",
            text_content="Testing HTTP failure failover"
        )
        res = await send_email(req)
        assert res.success is True
        assert res.provider_used == "brevo"
        assert res.attempt_count == 2



def test_probe_email_send_total_exhaustion_graceful_response(client):
    """
    All providers over limit (Resend=100, Brevo=300, SendGrid=100).
    Must return 200 with success=False, status='failed', attempt_count=3, no crash.
    """
    reset_daily_usage()
    set_daily_usage("resend", 100)
    set_daily_usage("brevo", 300)
    set_daily_usage("sendgrid", 100)

    req_payload = {
        "product": "zolexora-marketplace",
        "to": ["all-exhausted@example.com"],
        "subject": "All Providers Exhausted",
        "text_content": "No providers left"
    }
    resp = client.post("/api/email/send", json=req_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert data["status"] == "failed"


# ----------------------------------------------------------------------------
# 3. Adversarial Probing: Dynamic Account Discovery & Malformed Manifests
# ----------------------------------------------------------------------------

def test_probe_account_discovery_malformed_manifests(monkeypatch):
    """
    Probe dynamic discovery with malformed manifests:
    - Empty commas, whitespace padding, duplicate entries, unusual casing
    """
    clear_diagnostic_alerts()
    # Manifest with empty items, trailing commas, spaces
    monkeypatch.setenv("FIREBASE_ACTIVE_ACCOUNTS", "  ,,  tms-prod , , , engage-prod,  ,,")
    monkeypatch.setenv("FIREBASE_ACCOUNT_TMS_PROD_PROJECT_ID", "proj-tms-123")
    monkeypatch.setenv("FIREBASE_ACCOUNT_TMS_PROD_MONTHLY_QUOTA_TOTAL", "50000")
    monkeypatch.setenv("FIREBASE_ACCOUNT_TMS_PROD_MONTHLY_QUOTA_USED", "5000")

    # engage-prod has no credentials configured -> should trigger ROUTER_CREDENTIAL_MISSING
    monkeypatch.delenv("FIREBASE_ACCOUNT_ENGAGE_PROD_PROJECT_ID", raising=False)

    sync_res = sync_accounts_from_infisical()
    assert sync_res.discovered_count >= 2
    assert sync_res.status == "partial"  # Because engage-prod is DISCONNECTED

    accounts_info = get_accounts_list()
    discovered_ids = [a.id for a in accounts_info.accounts]
    assert "firebase-tms-prod" in discovered_ids
    assert "firebase-engage-prod" in discovered_ids

    # Verify diagnostic alert for engage-prod
    engage_alert = next((a for a in accounts_info.alerts if a.target_product == "engage-prod"), None)
    assert engage_alert is not None
    assert engage_alert.event == "ROUTER_CREDENTIAL_MISSING"
    assert engage_alert.severity == "CRITICAL"
    assert "/shared/firebase-pool/engage-prod" in engage_alert.infisical_path


def test_probe_account_discovery_missing_cloudflare_credentials(monkeypatch):
    """
    When CF_ACCOUNT_ID is completely absent, verify that a ROUTER_CREDENTIAL_MISSING
    alert is raised for Cloudflare.
    """
    clear_diagnostic_alerts()
    monkeypatch.delenv("CF_ACCOUNT_ID", raising=False)
    monkeypatch.setenv("FIREBASE_ACTIVE_ACCOUNTS", "tms-prod")
    monkeypatch.setenv("FIREBASE_ACCOUNT_TMS_PROD_PROJECT_ID", "proj-tms-123")

    sync_accounts_from_infisical()
    accounts_info = get_accounts_list()
    cf_alert = next((a for a in accounts_info.alerts if a.provider == "cloudflare"), None)
    assert cf_alert is not None
    assert cf_alert.event == "ROUTER_CREDENTIAL_MISSING"
    assert cf_alert.expected_secret == "CF_ACCOUNT_ID"


def test_probe_account_quota_division_by_zero_safety(monkeypatch):
    """
    Adversarial test: Quota total is 0. Verify no ZeroDivisionError occurs.
    """
    monkeypatch.setenv("FIREBASE_ACTIVE_ACCOUNTS", "zero-quota")
    monkeypatch.setenv("FIREBASE_ACCOUNT_ZERO_QUOTA_PROJECT_ID", "proj-zero")
    monkeypatch.setenv("FIREBASE_ACCOUNT_ZERO_QUOTA_MONTHLY_QUOTA_TOTAL", "0")
    monkeypatch.setenv("FIREBASE_ACCOUNT_ZERO_QUOTA_MONTHLY_QUOTA_USED", "0")

    sync_res = sync_accounts_from_infisical()
    assert sync_res.discovered_count >= 1
    accounts_info = get_accounts_list()
    zero_acc = next((a for a in accounts_info.accounts if a.id == "firebase-zero-quota"), None)
    assert zero_acc is not None
    assert zero_acc.quota_percentage == 0.0


# ----------------------------------------------------------------------------
# 4. Adversarial Probing: Capacity Thresholds (500MB / 512MB) & Pinning Exclusions
# ----------------------------------------------------------------------------

def test_probe_capacity_threshold_constants():
    """
    Verify exact byte constants for free-tier limits:
    Postgres free limit: exactly 500 MB (500 * 1024 * 1024 = 524,288,000 bytes)
    Mongo free limit: exactly 512 MB (512 * 1024 * 1024 = 536,870,912 bytes)
    """
    assert POSTGRES_FREE_LIMIT_BYTES == 524288000
    assert MONGO_FREE_LIMIT_BYTES == 536870912


@pytest.mark.asyncio
async def test_probe_capacity_threshold_states_warning_and_critical():
    """
    Adversarial simulation of Postgres capacity states:
    - 79% -> NORMAL
    - 80% to 89.9% -> WARNING
    - >= 90% -> CRITICAL
    """
    # 79% of 500MB
    with patch("app.db.telemetry.SIMULATED_PG_SIZES", {"core": int(POSTGRES_FREE_LIMIT_BYTES * 0.79)}):
        m79 = await collect_postgres_capacity("core")
        assert m79.threshold_state == "NORMAL"
        assert m79.usage_percentage == 79.0

    # 85% of 500MB
    with patch("app.db.telemetry.SIMULATED_PG_SIZES", {"core": int(POSTGRES_FREE_LIMIT_BYTES * 0.85)}):
        m85 = await collect_postgres_capacity("core")
        assert m85.threshold_state == "WARNING"
        assert m85.usage_percentage == 85.0

    # 92% of 500MB
    with patch("app.db.telemetry.SIMULATED_PG_SIZES", {"core": int(POSTGRES_FREE_LIMIT_BYTES * 0.92)}):
        m92 = await collect_postgres_capacity("core")
        assert m92.threshold_state == "CRITICAL"
        assert m92.usage_percentage == 92.0


@pytest.mark.asyncio
async def test_probe_capacity_overall_alert_aggregation():
    """
    If any single database (e.g. MongoDB Atlas) reaches >= 90%, overall_threshold_alert must be True.
    """
    critical_size = int(MONGO_FREE_LIMIT_BYTES * 0.95)
    with patch("app.db.telemetry.SIMULATED_MONGO_SIZE", critical_size):
        telemetry = await get_capacity_telemetry()
        assert telemetry.overall_threshold_alert is True
        mongo_metric = next((d for d in telemetry.databases if d.service == "mongodb_atlas"), None)
        assert mongo_metric is not None
        assert mongo_metric.threshold_state == "CRITICAL"
        assert mongo_metric.usage_percentage >= 90.0


def test_probe_table_pinning_and_archive_exclusion(client):
    """
    Stress-test table pinning logic and archive preview exclusions:
    1. Pin a sensitive table 'clarity_fi.audit_log' and 'tms.critical_events'.
    2. Request /api/telemetry/archive/preview for a database.
    3. Ensure pinned tables are strictly listed in 'pinned_tables_skipped'.
    4. Unpin and verify state reflects updated exclusion list.
    """
    original_pinned = get_pinned_tables()

    try:
        table_to_pin = "tms.critical_events"
        toggle_table_pin(table_to_pin, True)
        assert table_to_pin in get_pinned_tables()

        # Archive preview must list this table in skipped
        preview_resp = client.post("/api/telemetry/archive/preview", json={
            "database": "core",
            "target_capacity_percent": 30.0
        })
        assert preview_resp.status_code == 200
        preview_data = preview_resp.json()
        assert table_to_pin in preview_data["pinned_tables_skipped"]
        assert preview_data["estimated_rows_to_archive"] > 0
        assert preview_data["cutoff_date"] != ""

        # Toggle off
        toggle_table_pin(table_to_pin, False)
        assert table_to_pin not in get_pinned_tables()

    finally:
        # Restore original pinned tables
        save_pinned_tables(original_pinned)
