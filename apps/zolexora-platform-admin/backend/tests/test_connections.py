import json
import httpx
import pytest
from unittest.mock import AsyncMock, patch
from app import connections
from app.clients import Probe
from app.connections import Connection, InfisicalStore
from tests.conftest import ADMIN_PATH

SECRET = "anon-secret-value"
KEYS = {"url": "SUPABASE_CORE_URL", "api_key": "SUPABASE_CORE_ANON_KEY"}


@pytest.fixture
def infisical_values(store):
    store.values[ADMIN_PATH].update({"SUPABASE_CORE_URL": "https://abc.supabase.co", "SUPABASE_CORE_ANON_KEY": SECRET})
    return store.values


def body(keys=KEYS, name="Core"):
    return {"provider": "supabase", "name": name, "keys": keys}


def test_providers_list_fields_with_example_key_names(client):
    providers = {p["provider"]: p for p in client.get("/api/connections/providers").json()}
    assert set(providers) == {"supabase", "mongodb", "r2", "resend", "brevo", "sendgrid", "cloudflare", "firebase"}
    url = next(f for f in providers["supabase"]["fields"] if f["name"] == "url")
    assert url["placeholder"] == "SUPABASE_CORE_URL"


def test_add_stores_key_names_only(client, store, infisical_values):
    res = client.post("/api/connections", json=body())
    assert res.status_code == 201
    conn_id = res.json()["id"]
    assert res.json()["keys"] == KEYS and "config" not in res.json()
    record = json.loads(json.dumps(store.items[conn_id].model_dump()))
    assert record["keys"] == KEYS and "config" not in record  # nothing but names is persisted
    everything = json.dumps([client.get("/api/connections").json(), client.get("/api/accounts").json(), res.json()])
    assert SECRET not in everything  # values never reach the browser


def test_add_fails_when_key_not_in_infisical(client, store, infisical_values):
    res = client.post("/api/connections", json=body({**KEYS, "api_key": "TYPO_KEY"}))
    assert res.status_code == 422
    assert "TYPO_KEY" in res.json()["detail"] and ADMIN_PATH in res.json()["detail"]
    assert store.items == {}


def test_add_rejects_missing_fields_and_bad_names(client, infisical_values):
    assert "API key" in client.post("/api/connections", json=body({"url": "SUPABASE_CORE_URL"})).json()["detail"]
    res = client.post("/api/connections", json=body({**KEYS, "api_key": "not a key!"}))
    assert res.status_code == 422 and "Not an Infisical key name" in res.json()["detail"]


def test_key_in_subfolder(client, store, infisical_values):
    store.values[f"{ADMIN_PATH}/supabase/core"] = {"ANON": SECRET}
    res = client.post("/api/connections", json=body({**KEYS, "api_key": "supabase/core/ANON"}))
    assert res.status_code == 201


@pytest.mark.asyncio
async def test_resolved_values_used_at_runtime_and_rotation_picked_up(client, store, infisical_values):
    conn_id = client.post("/api/connections", json=body()).json()["id"]
    assert (await connections.get_connection(conn_id)).config["api_key"] == SECRET
    store.values[ADMIN_PATH]["SUPABASE_CORE_ANON_KEY"] = "rotated"
    await connections.reload()  # "Reload from Infisical" (or wait for the 5-minute cache)
    assert (await connections.get_connection(conn_id)).config["api_key"] == "rotated"


def test_key_deleted_in_infisical_shows_disconnected(client, store, infisical_values):
    conn_id = client.post("/api/connections", json=body()).json()["id"]
    del store.values[ADMIN_PATH]["SUPABASE_CORE_ANON_KEY"]
    client.post("/api/accounts/sync")
    account = client.get("/api/accounts").json()["accounts"][0]
    assert account["status"] == "DISCONNECTED"
    listed = client.get("/api/connections").json()[0]
    assert listed["id"] == conn_id and "SUPABASE_CORE_ANON_KEY" in listed["error"]
    health = client.get("/api/health/databases").json()["targets"][conn_id]
    assert health["status"] == "degraded" and "SUPABASE_CORE_ANON_KEY" in health["error"]


def test_status_and_delete(client, store, infisical_values):
    conn_id = client.post("/api/connections", json=body()).json()["id"]
    assert client.put(f"/api/connections/{conn_id}/status", json={"status": "DRAINING"}).json()["status"] == "DRAINING"
    assert store.items[conn_id].status == "DRAINING"
    assert client.delete(f"/api/connections/{conn_id}").status_code == 204
    assert store.items == {}
    assert client.delete(f"/api/connections/{conn_id}").status_code == 404


def test_test_endpoint_resolves_and_probes_without_saving(client, store, infisical_values):
    with patch("app.routers.connections.clients.probe", AsyncMock(return_value=Probe(status="healthy", latency_ms=5, detail="ok"))) as probe:
        res = client.post("/api/connections/test", json=body())
    assert res.json()["status"] == "healthy"
    assert probe.call_args.args[0].config["api_key"] == SECRET
    assert store.items == {}
    assert client.post("/api/connections/test", json=body({**KEYS, "url": "NOPE"})).status_code == 422


def test_reload_picks_up_records_added_in_infisical(client, store, infisical_values):
    assert client.get("/api/accounts").json()["total_count"] == 0
    store.items["abc"] = Connection(id="abc", provider="supabase", name="Added in Infisical", keys=KEYS)
    assert client.post("/api/accounts/sync").json()["discovered_count"] == 1
    assert client.get("/api/accounts").json()["accounts"][0]["alias"] == "Added in Infisical"


def test_store_errors_are_502(client, store, monkeypatch):
    store.list = AsyncMock(side_effect=connections.InfisicalError("login failed"))
    monkeypatch.setattr(connections, "_cache", None)  # startup already loaded the (empty) list
    res = client.get("/api/connections")
    assert res.status_code == 502 and "login failed" in res.json()["detail"]


# --- InfisicalStore against a fake Infisical API --------------------------------------------

@pytest.fixture
def infisical(monkeypatch, tmp_path):
    cfg = tmp_path / "infisical.json"
    cfg.write_text(json.dumps({"workspaceId": "proj1", "defaultEnvironment": "dev", "secretsPath": "/Admin_Panel"}))
    monkeypatch.setenv("INFISICAL_CONFIG", str(cfg))
    monkeypatch.setenv("INFISICAL_CLIENT_ID", "cid")
    monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "csecret")
    state = {"folders": {"/Admin_Panel": {"SUPABASE_CORE_URL": "https://abc.supabase.co"}, "/Admin_Panel/connections": {}},
             "requests": [], "logins": 0, "expire_next": False}

    def handler(req: httpx.Request) -> httpx.Response:
        state["requests"].append((req.method, req.url.path))
        if req.url.path == "/api/v1/auth/universal-auth/login":
            state["logins"] += 1
            assert json.loads(req.content) == {"clientId": "cid", "clientSecret": "csecret"}
            return httpx.Response(200, json={"accessToken": f"tok{state['logins']}"})
        if state["expire_next"]:
            state["expire_next"] = False
            return httpx.Response(401)
        assert req.headers["authorization"].startswith("Bearer tok")
        if req.url.path == "/api/v1/folders":
            return httpx.Response(400, json={"message": "Folder already exists"})
        if req.url.path == "/api/v3/secrets/raw":
            folder = state["folders"].get(req.url.params["secretPath"])
            if folder is None:
                return httpx.Response(404)
            return httpx.Response(200, json={"secrets": [{"secretKey": k, "secretValue": v} for k, v in folder.items()]})
        name = req.url.path.rsplit("/", 1)[-1]
        conns = state["folders"]["/Admin_Panel/connections"]
        if req.method in ("POST", "PATCH"):
            conns[name] = json.loads(req.content)["secretValue"]
        elif req.method == "DELETE":
            conns.pop(name, None)
        return httpx.Response(200, json={})

    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr("app.connections.httpx.AsyncClient", lambda **kw: real(transport=transport, **kw))
    return state


@pytest.mark.asyncio
async def test_infisical_store_round_trip(infisical):
    s = InfisicalStore()
    assert await s.read_folder("/Admin_Panel") == {"SUPABASE_CORE_URL": "https://abc.supabase.co"}
    assert await s.read_folder("/Admin_Panel/missing") == {}
    conn = Connection(id="a1b2", provider="resend", name="Main", keys={"api_key": "RESEND_API_KEY"})
    await s.put(conn, create=True)
    saved = json.loads(infisical["folders"]["/Admin_Panel/connections"]["CONN_A1B2"])
    assert saved == {"provider": "resend", "name": "Main", "status": "ACTIVE", "keys": {"api_key": "RESEND_API_KEY"}}
    assert [c.model_dump() for c in await s.list()] == [conn.model_dump()]
    await s.put(conn.model_copy(update={"status": "DRAINING"}), create=False)
    assert ("PATCH", "/api/v3/secrets/raw/CONN_A1B2") in infisical["requests"]
    await s.delete("a1b2")
    assert await s.list() == []
    assert infisical["logins"] == 1  # token reused


@pytest.mark.asyncio
async def test_infisical_store_relogs_on_expired_token(infisical):
    s = InfisicalStore()
    await s.list()
    infisical["expire_next"] = True
    await s.list()
    assert infisical["logins"] == 2


@pytest.mark.asyncio
async def test_infisical_store_skips_non_connection_and_malformed_records(infisical):
    infisical["folders"]["/Admin_Panel/connections"].update({"OTHER_KEY": "x", "CONN_BAD": "{not json"})
    assert await InfisicalStore().list() == []


@pytest.mark.asyncio
async def test_infisical_store_needs_machine_identity(infisical, monkeypatch):
    monkeypatch.delenv("INFISICAL_CLIENT_SECRET")
    with pytest.raises(connections.InfisicalError, match="INFISICAL_CLIENT_ID"):
        await InfisicalStore().list()
