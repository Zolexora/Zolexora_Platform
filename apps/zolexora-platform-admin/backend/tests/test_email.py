from app.services.email import (
    set_daily_usage,
    get_daily_usage,
    reset_daily_usage,
)

def test_email_quotas_endpoint(client):
    """GET /api/email/quotas returns real-time limits and usage for Resend, Brevo, SendGrid."""
    response = client.get("/api/email/quotas")
    assert response.status_code == 200
    data = response.json()
    assert "providers" in data
    assert len(data["providers"]) == 3

    providers = {p["provider"]: p for p in data["providers"]}
    assert providers["resend"]["daily_limit"] == 100
    assert providers["brevo"]["daily_limit"] == 300
    assert providers["sendgrid"]["daily_limit"] == 100

def test_primary_dispatch_to_resend(client):
    """When all providers are below threshold, primary router dispatches via Resend."""
    reset_daily_usage()
    payload = {
        "product": "zolexora-tms",
        "to": ["carrier@example.com"],
        "subject": "Shipment #1049 Confirmed",
        "html_content": "<p>Your shipment is scheduled.</p>"
    }
    response = client.post("/api/email/send", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["provider_used"] == "resend"
    assert data["status"] == "sent"
    assert data["attempt_count"] == 1
    assert get_daily_usage("resend") == 1

def test_failover_to_brevo_when_resend_at_90_percent(client):
    """
    R3 requirement: Intelligent failover when account reaches 90% capacity.
    Resend daily limit is 100. At 90 emails, it must failover to Brevo.
    """
    reset_daily_usage()
    set_daily_usage("resend", 90) # 90% threshold reached

    payload = {
        "product": "zolexora-ims",
        "to": ["warehouse@example.com"],
        "subject": "Inventory Stock Alert",
        "text_content": "SKU #882 is running low."
    }
    response = client.post("/api/email/send", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["provider_used"] == "brevo"
    assert data["status"] == "sent"
    assert get_daily_usage("brevo") == 1

def test_failover_to_sendgrid_when_resend_and_brevo_throttled(client):
    """
    When Resend (>=90) and Brevo (>=270) are both at 90% quota, route to SendGrid.
    """
    reset_daily_usage()
    set_daily_usage("resend", 95)  # 95%
    set_daily_usage("brevo", 275)   # 91.6%

    payload = {
        "product": "clarity-fi",
        "to": ["accounting@example.com"],
        "subject": "Monthly Statement",
        "text_content": "Your statement is ready."
    }
    response = client.post("/api/email/send", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["provider_used"] == "sendgrid"
    assert data["status"] == "sent"
    assert get_daily_usage("sendgrid") == 1

def test_all_providers_throttled_graceful_handling(client):
    """When all providers are exhausted, router returns failure response without crashing."""
    reset_daily_usage()
    set_daily_usage("resend", 100)
    set_daily_usage("brevo", 300)
    set_daily_usage("sendgrid", 100)

    payload = {
        "product": "zolexora-engage",
        "to": ["user@example.com"],
        "subject": "Campaign Newsletter",
        "text_content": "Welcome!"
    }
    response = client.post("/api/email/send", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["status"] == "failed"

def test_email_logs_ingestion_and_query(client):
    """Sent emails are archived into email_logs and searchable via GET /api/email/logs."""
    reset_daily_usage()
    subject = "Audited Shipment Delivery"
    recipient = "recipient-audit@example.com"

    client.post("/api/email/send", json={
        "product": "zolexora-tms",
        "to": [recipient],
        "subject": subject,
        "text_content": "Delivered successfully."
    })

    # Query logs
    response = client.get("/api/email/logs?product=zolexora-tms")
    assert response.status_code == 200
    data = response.json()
    assert "logs" in data
    assert data["total"] > 0

    matching = next((entry for entry in data["logs"] if entry["subject"] == subject), None)
    assert matching is not None
    assert matching["recipient"] == recipient
    assert matching["status"] == "sent"
