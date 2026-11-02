from datetime import date
from unittest.mock import MagicMock, patch
import pytest
from app.services import email
from app.services.email import get_daily_usage, set_daily_usage

pytestmark = pytest.mark.usefixtures("email_http_ok")

MSG = {"product": "zolexora-tms", "to": ["a@example.com"], "subject": "Hi", "text_content": "x"}


def add(post_conn, provider, name=None, **config):
    config.setdefault("api_key", f"{provider}-key")
    return post_conn({"provider": provider, "name": name or provider, "config": config}).json()["id"]


def test_no_email_connections_means_failed(client):
    data = client.post("/api/email/send", json=MSG).json()
    assert data["success"] is False and data["status"] == "failed" and data["provider_used"] is None


def test_routes_resend_first_then_brevo_then_sendgrid(client, post_conn):
    sg, br, rs = add(post_conn, "sendgrid"), add(post_conn, "brevo"), add(post_conn, "resend")
    assert client.post("/api/email/send", json=MSG).json()["account_used"] == rs
    set_daily_usage(rs, 90)  # 90% of 100
    assert client.post("/api/email/send", json=MSG).json()["account_used"] == br
    set_daily_usage(br, 270)  # 90% of 300
    data = client.post("/api/email/send", json=MSG).json()
    assert data["account_used"] == sg and data["provider_used"] == "sendgrid"
    assert get_daily_usage(sg) == 1


def test_custom_daily_limit_per_connection(client, post_conn):
    small = add(post_conn, "resend", "small", daily_limit="10")
    big = add(post_conn, "resend", "zbig")
    set_daily_usage(small, 9)
    assert client.post("/api/email/send", json=MSG).json()["account_used"] == big
    quotas = {q["account_id"]: q for q in client.get("/api/email/quotas").json()["providers"]}
    assert quotas[small]["daily_limit"] == 10 and quotas[small]["is_throttled"] is True


def test_draining_connection_is_skipped(client, post_conn):
    rs, br = add(post_conn, "resend"), add(post_conn, "brevo")
    client.put(f"/api/connections/{rs}/status", json={"status": "DRAINING"})
    assert client.post("/api/email/send", json=MSG).json()["account_used"] == br


def test_provider_error_fails_over_without_counting(client, post_conn):
    rs, br = add(post_conn, "resend"), add(post_conn, "brevo")

    async def post(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 500 if "resend.com" in url else 201
        resp.json.return_value = {"messageId": "b1"}
        return resp

    with patch("app.services.email.httpx.AsyncClient.post", side_effect=post):
        data = client.post("/api/email/send", json=MSG).json()
    assert data["account_used"] == br and data["attempt_count"] == 2
    assert get_daily_usage(rs) == 0


def test_sender_from_connection_used_by_default(client, email_http_ok, post_conn):
    add(post_conn, "resend", sender_email="ops@zolexora.com")
    client.post("/api/email/send", json=MSG)
    assert email_http_ok.call_args.kwargs["json"]["from"] == "ops@zolexora.com"


def test_usage_resets_on_new_utc_day():
    set_daily_usage("x", 95)
    email._usage_day = date(2000, 1, 1)
    assert get_daily_usage("x") == 0


def test_logs_kept_in_memory_without_mongo(client, post_conn):
    add(post_conn, "resend")
    client.post("/api/email/send", json={**MSG, "subject": "Audit"})
    logs = client.get("/api/email/logs?product=zolexora-tms").json()
    assert logs["total"] == 1 and logs["logs"][0]["subject"] == "Audit"


def test_empty_recipients_rejected(client):
    assert client.post("/api/email/send", json={**MSG, "to": []}).status_code == 422
