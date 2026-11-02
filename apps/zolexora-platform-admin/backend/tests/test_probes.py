from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest
from app import clients
from app.connections import Connection


def conn(provider, **config):
    """A resolved connection (values already read from Infisical)."""
    return Connection(id="c1", provider=provider, name="n", keys={k: k.upper() for k in config}, config=config)


def resp(code, body=None, text=""):
    r = MagicMock()
    r.status_code, r.text = code, text
    r.json.return_value = body or {}
    return r


@pytest.mark.asyncio
@pytest.mark.parametrize("code,status,detail", [(200, "healthy", "key accepted"), (401, "degraded", "key rejected"), (503, "degraded", "HTTP 503")])
async def test_supabase_status_mapping(code, status, detail):
    with patch("app.clients._http", AsyncMock(return_value=resp(code))) as http:
        p = await clients.probe(conn("supabase", url="https://abc.supabase.co/", api_key="anon"))
    assert p.status == status and detail in p.detail
    assert http.call_args.args[1] == "https://abc.supabase.co/auth/v1/health"
    assert http.call_args.kwargs["headers"] == {"apikey": "anon"}


@pytest.mark.asyncio
async def test_resend_send_only_key_is_healthy():
    with patch("app.clients._http", AsyncMock(return_value=resp(401, text='{"name":"restricted_api_key"}'))):
        assert (await clients.probe(conn("resend", api_key="re"))).status == "healthy"


@pytest.mark.asyncio
async def test_firebase_key_for_other_project_is_degraded():
    with patch("app.clients._http", AsyncMock(return_value=resp(200, {"projectId": "other"}))):
        p = await clients.probe(conn("firebase", project_id="mine", web_api_key="k"))
    assert p.status == "degraded" and "different project" in p.detail


@pytest.mark.asyncio
async def test_cloudflare_falls_back_to_user_token_verify():
    http = AsyncMock(side_effect=[resp(401), resp(200)])
    with patch("app.clients._http", http):
        assert (await clients.probe(conn("cloudflare", account_id="a", api_token="t"))).status == "healthy"
    assert http.call_args.args[1].endswith("/user/tokens/verify")


@pytest.mark.asyncio
async def test_network_error_is_degraded_with_reason():
    with patch("app.clients._http", AsyncMock(side_effect=httpx.ConnectError("refused"))):
        p = await clients.probe(conn("brevo", api_key="k"))
    assert p.status == "degraded" and "refused" in p.detail and p.latency_ms is None


@pytest.mark.asyncio
async def test_mongo_ping_and_r2_head_bucket():
    db = MagicMock()
    db.command = AsyncMock(return_value={"ok": 1})
    with patch("app.clients.mongo_db", return_value=db):
        assert (await clients.probe(conn("mongodb", uri="mongodb://h", database="d"))).status == "healthy"
    s3 = MagicMock()
    with patch("app.clients.r2_client", return_value=s3):
        assert (await clients.probe(conn("r2", account_id="a", bucket="b", access_key_id="x", secret_access_key="y"))).status == "healthy"
    s3.head_bucket.assert_called_once_with(Bucket="b")


@pytest.mark.asyncio
async def test_connection_with_missing_key_is_degraded_without_network():
    c = conn("brevo", api_key="k").model_copy(update={"config": {}, "error": "Not found in Infisical: BREVO_API_KEY"})
    with patch("app.clients._http", AsyncMock()) as http:
        p = await clients.probe(c)
    assert p.status == "degraded" and "BREVO_API_KEY" in p.detail
    http.assert_not_called()
