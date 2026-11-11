import asyncio

import httpx
import pytest

import d1_adapter
from d1_adapter import D1Adapter, DatabaseError


def test_not_configured_is_an_error():
    db = D1Adapter(account_id="", database_id="", api_token="", sqlite_path="")
    with pytest.raises(DatabaseError, match="Database not configured"):
        asyncio.run(db.init())


def test_d1_errors_are_raised_not_hidden(monkeypatch, tmp_path):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"success": False, "errors": [{"message": "boom"}]})

    real = httpx.AsyncClient
    monkeypatch.setattr(d1_adapter.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    db = D1Adapter(account_id="acc", database_id="db", api_token="tok", sqlite_path="")
    with pytest.raises(DatabaseError, match="boom"):
        asyncio.run(db.execute("INSERT INTO settings (org_id, key) VALUES (?, ?);", ["o", "k"]))
    assert len(calls) == 1 and calls[0].headers["Authorization"] == "Bearer tok"
    assert not list(tmp_path.iterdir())  # nothing written locally
