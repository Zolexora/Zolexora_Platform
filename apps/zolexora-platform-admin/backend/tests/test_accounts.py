from app.services.accounts import (
    sync_accounts_from_infisical,
    get_accounts_list,
)

def test_list_accounts_api(client):
    """GET /api/accounts returns structured list with summary counts."""
    response = client.get("/api/accounts")
    assert response.status_code == 200
    data = response.json()
    assert "accounts" in data
    assert "total_count" in data
    assert "active_count" in data
    assert "throttled_count" in data
    assert "alerts" in data
    assert isinstance(data["accounts"], list)

def test_dynamic_account_discovery(monkeypatch):
    """Verify live discovery of accounts from FIREBASE_ACTIVE_ACCOUNTS manifest."""
    monkeypatch.setenv("FIREBASE_ACTIVE_ACCOUNTS", "unit-alpha,unit-beta")
    monkeypatch.setenv("FIREBASE_ACCOUNT_UNIT_ALPHA_PROJECT_ID", "alpha-proj-id")
    monkeypatch.setenv("FIREBASE_ACCOUNT_UNIT_ALPHA_MONTHLY_QUOTA_TOTAL", "10000")
    monkeypatch.setenv("FIREBASE_ACCOUNT_UNIT_ALPHA_MONTHLY_QUOTA_USED", "1200")

    monkeypatch.setenv("FIREBASE_ACCOUNT_UNIT_BETA_PROJECT_ID", "beta-proj-id")
    monkeypatch.setenv("FIREBASE_ACCOUNT_UNIT_BETA_MONTHLY_QUOTA_TOTAL", "10000")
    monkeypatch.setenv("FIREBASE_ACCOUNT_UNIT_BETA_MONTHLY_QUOTA_USED", "3500")

    res = sync_accounts_from_infisical()
    assert res.discovered_count >= 2
    accounts = get_accounts_list().accounts
    alpha = next((a for a in accounts if a.id == "firebase-unit-alpha"), None)
    assert alpha is not None
    assert alpha.project_id_or_account_id == "alpha-proj-id"
    assert alpha.status == "ACTIVE"
    assert alpha.quota_percentage == 12.0

def test_missing_credential_diagnostics(monkeypatch):
    """
    R2 requirement: Missing credential diagnostics that log structured error events
    (ROUTER_CREDENTIAL_MISSING) without crashing services.
    """
    monkeypatch.setenv("FIREBASE_ACTIVE_ACCOUNTS", "broken-account")
    monkeypatch.delenv("FIREBASE_ACCOUNT_BROKEN_ACCOUNT_PROJECT_ID", raising=False)

    res = sync_accounts_from_infisical()
    assert res.disconnected_count >= 1
    accounts_info = get_accounts_list()

    broken = next((a for a in accounts_info.accounts if a.id == "firebase-broken-account"), None)
    assert broken is not None
    assert broken.status == "DISCONNECTED"

    # Verify diagnostic alert payload
    matching_alerts = [a for a in accounts_info.alerts if a.target_product == "broken-account"]
    assert len(matching_alerts) > 0
    alert = matching_alerts[0]
    assert alert.event == "ROUTER_CREDENTIAL_MISSING"
    assert alert.severity == "CRITICAL"
    assert "/shared/firebase-pool/broken-account" in alert.infisical_path

def test_90_percent_quota_throttling(monkeypatch):
    """
    R2 requirement: Dynamic failover and quota throttling when accounts approach limits (90% threshold).
    """
    monkeypatch.setenv("FIREBASE_ACTIVE_ACCOUNTS", "heavy-user")
    monkeypatch.setenv("FIREBASE_ACCOUNT_HEAVY_USER_PROJECT_ID", "heavy-proj-id")
    monkeypatch.setenv("FIREBASE_ACCOUNT_HEAVY_USER_MONTHLY_QUOTA_TOTAL", "10000")
    monkeypatch.setenv("FIREBASE_ACCOUNT_HEAVY_USER_MONTHLY_QUOTA_USED", "9100") # 91%

    sync_accounts_from_infisical()
    accounts = get_accounts_list().accounts
    heavy = next((a for a in accounts if a.id == "firebase-heavy-user"), None)
    assert heavy is not None
    assert heavy.status == "QUOTA_THROTTLED"
    assert heavy.quota_percentage == 91.0

def test_manual_status_update_endpoint(client, monkeypatch):
    """PUT /api/accounts/{account_id}/status allows toggling account status."""
    monkeypatch.setenv("FIREBASE_ACTIVE_ACCOUNTS", "tms-prod")
    monkeypatch.setenv("FIREBASE_ACCOUNT_TMS_PROD_PROJECT_ID", "tms-proj-id")
    sync_accounts_from_infisical()

    response = client.put("/api/accounts/firebase-tms-prod/status", json={"status": "DRAINING"})
    assert response.status_code == 200
    assert response.json()["status"] == "DRAINING"

    # Non-existent account returns 404
    bad_resp = client.put("/api/accounts/non-existent-account/status", json={"status": "DRAINING"})
    assert bad_resp.status_code == 404
