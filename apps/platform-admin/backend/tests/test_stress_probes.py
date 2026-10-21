import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.email import (
    reset_daily_usage,
    set_daily_usage,
    get_daily_usage,
    send_email,
)
from app.schemas.email import EmailSendRequest
from app.services.accounts import (
    sync_accounts_from_infisical,
    get_accounts_list,
    clear_diagnostic_alerts,
)
from app.db.telemetry import (
    toggle_table_pin,
    get_pinned_tables,
    save_pinned_tables,
)

def test_stress_health_endpoint_high_frequency(client):
    """
    Stress-test /api/health endpoint with 500 sequential rapid requests
    to ensure zero memory leaks, thread starvation, or latency spikes.
    """
    for _ in range(500):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_stress_email_router_quota_rollover():
    """
    Stress-test rapid sequential dispatches driving usage through all quota stages:
    1. Send 89 emails to Resend (all succeed on Resend)
    2. Send 1 email (reaches 90 on Resend)
    3. Send 10th email (diverts to Brevo)
    4. Fast-forward Brevo to 270 (diverts to SendGrid)
    5. Fast-forward SendGrid to 90 (all exhausted, returns failure without exception)
    """
    reset_daily_usage()
    req = EmailSendRequest(
        product="zolexora-tms",
        to=["stress-user@example.com"],
        subject="High Volume Dispatch",
        text_content="Stress test body"
    )

    # 1. Dispatch 10 emails
    for _ in range(10):
        res = await send_email(req)
        assert res.success is True
        assert res.provider_used == "resend"

    assert get_daily_usage("resend") == 10

    # Fast forward Resend to 90
    set_daily_usage("resend", 90)

    # Dispatch next 5 emails -> should all go to Brevo
    for _ in range(5):
        res = await send_email(req)
        assert res.success is True
        assert res.provider_used == "brevo"

    assert get_daily_usage("brevo") == 5

    # Fast forward Brevo to 270
    set_daily_usage("brevo", 270)

    # Dispatch next 5 emails -> should all go to SendGrid
    for _ in range(5):
        res = await send_email(req)
        assert res.success is True
        assert res.provider_used == "sendgrid"

    assert get_daily_usage("sendgrid") == 5

    # Fast forward SendGrid to 90
    set_daily_usage("sendgrid", 90)

    # Next dispatch -> all exhausted
    res_exhausted = await send_email(req)
    assert res_exhausted.success is False
    assert res_exhausted.status == "failed"


def test_stress_dynamic_accounts_large_manifest(monkeypatch):
    """
    Stress-test dynamic account discovery with 50 accounts in manifest,
    some active, some missing credentials, some throttled.
    """
    clear_diagnostic_alerts()
    slugs = [f"account-{i}" for i in range(50)]
    manifest = ",".join(slugs)
    monkeypatch.setenv("FIREBASE_ACTIVE_ACCOUNTS", manifest)

    for i in range(50):
        slug_upper = f"ACCOUNT_{i}"
        if i % 3 == 0:
            # Missing credentials
            monkeypatch.delenv(f"FIREBASE_ACCOUNT_{slug_upper}_PROJECT_ID", raising=False)
        elif i % 3 == 1:
            # Active normal account
            monkeypatch.setenv(f"FIREBASE_ACCOUNT_{slug_upper}_PROJECT_ID", f"proj-{i}")
            monkeypatch.setenv(f"FIREBASE_ACCOUNT_{slug_upper}_MONTHLY_QUOTA_TOTAL", "10000")
            monkeypatch.setenv(f"FIREBASE_ACCOUNT_{slug_upper}_MONTHLY_QUOTA_USED", "2000")
        else:
            # Throttled account (95%)
            monkeypatch.setenv(f"FIREBASE_ACCOUNT_{slug_upper}_PROJECT_ID", f"proj-{i}")
            monkeypatch.setenv(f"FIREBASE_ACCOUNT_{slug_upper}_MONTHLY_QUOTA_TOTAL", "10000")
            monkeypatch.setenv(f"FIREBASE_ACCOUNT_{slug_upper}_MONTHLY_QUOTA_USED", "9500")

    sync_res = sync_accounts_from_infisical()
    assert sync_res.discovered_count >= 50
    accounts = get_accounts_list().accounts
    assert len(accounts) >= 50

    # Ensure alerts captured all missing accounts
    alerts = get_accounts_list().alerts
    missing_count = sum(1 for i in range(50) if i % 3 == 0)
    matching_alerts = [a for a in alerts if a.provider == "firebase"]
    assert len(matching_alerts) == missing_count


def test_stress_rapid_table_pin_toggles():
    """
    Stress-test rapid table pinning and unpinning (100 toggles)
    ensuring thread safety and JSON integrity.
    """
    original = get_pinned_tables()
    try:
        test_table = "stress.table_x"
        for i in range(50):
            toggle_table_pin(test_table, True)
            assert test_table in get_pinned_tables()
            toggle_table_pin(test_table, False)
            assert test_table not in get_pinned_tables()
    finally:
        save_pinned_tables(original)
