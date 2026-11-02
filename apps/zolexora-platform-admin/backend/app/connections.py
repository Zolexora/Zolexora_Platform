"""Connections: provider accounts the admin registers in the panel by Infisical KEY NAME.

You put the values in Infisical (admin folder, or a subfolder of it) the usual way. In the panel
you only say which key holds what, e.g. url -> SUPABASE_CORE_URL. The panel never receives or
stores a secret value: it reads values from Infisical when it needs them (cached 5 minutes).

Each connection record is one Infisical secret `CONN_<ID>` in `<admin secretsPath>/connections`,
whose value is JSON: {"provider", "name", "status", "keys": {field: KEY_NAME}}.
"""
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Literal, Optional

import httpx
from pydantic import BaseModel, Field

# --- Provider catalogue: drives validation and the "add connection" form -------------------

class FieldSpec(BaseModel):
    name: str
    label: str
    required: bool = True
    placeholder: str = ""  # example Infisical key name

class ProviderSpec(BaseModel):
    provider: str
    label: str
    category: Literal["database", "storage", "email", "edge"]
    fields: list[FieldSpec]
    hint: str = ""

def _f(name, label, placeholder, required=True):
    return FieldSpec(name=name, label=label, required=required, placeholder=placeholder)

def _email(prefix: str, default_limit: int) -> list[FieldSpec]:
    return [
        _f("api_key", "API key", f"{prefix}_API_KEY"),
        _f("sender_email", "Sender email", f"{prefix}_SENDER_EMAIL", required=False),
        _f("daily_limit", f"Daily limit (default {default_limit})", f"{prefix}_DAILY_LIMIT", required=False),
    ]

PROVIDERS: dict[str, ProviderSpec] = {p.provider: p for p in [
    ProviderSpec(provider="supabase", label="Supabase", category="database", fields=[
        _f("url", "Project URL", "SUPABASE_CORE_URL"),
        _f("api_key", "API key", "SUPABASE_CORE_ANON_KEY"),
        _f("pg_url", "Postgres URL (for capacity)", "SUPABASE_CORE_PG_URL", required=False),
    ], hint="The anon key is enough for health checks. For capacity, use a read-only role with pg_monitor."),
    ProviderSpec(provider="mongodb", label="MongoDB", category="database", fields=[
        _f("uri", "Connection URI", "MONGO_URI"),
        _f("database", "Database name", "MONGO_DB_NAME"),
        _f("email_log_collection", "Email-log collection", "MONGO_EMAIL_LOG_COLLECTION", required=False),
    ], hint="A user with clusterMonitor (plus write on the email-log collection, if set) is enough."),
    ProviderSpec(provider="r2", label="Cloudflare R2", category="storage", fields=[
        _f("account_id", "Account ID", "R2_ACCOUNT_ID"),
        _f("bucket", "Bucket", "R2_BUCKET_IMS"),
        _f("access_key_id", "Access key ID", "R2_ACCESS_KEY_ID"),
        _f("secret_access_key", "Secret access key", "R2_SECRET_ACCESS_KEY"),
    ], hint="Use an R2 token scoped to this bucket."),
    ProviderSpec(provider="resend", label="Resend", category="email", fields=_email("RESEND", 100)),
    ProviderSpec(provider="brevo", label="Brevo", category="email", fields=_email("BREVO", 300)),
    ProviderSpec(provider="sendgrid", label="SendGrid", category="email", fields=_email("SENDGRID", 100)),
    ProviderSpec(provider="cloudflare", label="Cloudflare", category="edge", fields=[
        _f("account_id", "Account ID", "CF_ACCOUNT_ID"),
        _f("api_token", "API token (read-only is enough)", "CF_API_TOKEN"),
    ]),
    ProviderSpec(provider="firebase", label="Firebase", category="edge", fields=[
        _f("project_id", "Project ID", "FIREBASE_PROJECT_ID"),
        _f("web_api_key", "Web API key", "FIREBASE_WEB_API_KEY"),
    ]),
]}

ProviderName = Literal["supabase", "mongodb", "r2", "resend", "brevo", "sendgrid", "cloudflare", "firebase"]
ConnectionStatus = Literal["ACTIVE", "DRAINING"]
KEY_REF = re.compile(r"^(?:[A-Za-z0-9_\-]+/)*[A-Za-z0-9_\-.]+$")  # KEY or sub/folder/KEY

class Connection(BaseModel):
    id: str
    provider: ProviderName
    name: str
    status: ConnectionStatus = "ACTIVE"
    keys: dict[str, str]                                     # stored: field -> Infisical key name
    config: dict[str, str] = Field(default_factory=dict, exclude=True)  # runtime: resolved values
    error: Optional[str] = Field(default=None, exclude=True)            # runtime: e.g. key not found

class ConnectionInput(BaseModel):
    provider: ProviderName
    name: str = Field(min_length=1, max_length=80)
    keys: dict[str, str]

def validate_input(data: ConnectionInput) -> dict[str, str]:
    """Keeps only known fields, trims key names, checks required ones and the name format."""
    spec = PROVIDERS[data.provider]
    keys = {f.name: (data.keys.get(f.name) or "").strip().strip("/") for f in spec.fields}
    missing = [f.label for f in spec.fields if f.required and not keys[f.name]]
    if missing:
        raise ValueError(f"Missing: {', '.join(missing)}")
    bad = [k for k in keys.values() if k and not KEY_REF.match(k)]
    if bad:
        raise ValueError(f"Not an Infisical key name: {', '.join(bad)} (use KEY or sub/folder/KEY)")
    return {k: v for k, v in keys.items() if v}

def public_view(conn: Connection) -> dict:
    """What the browser sees: key names only (never values), plus any resolve error."""
    return {**conn.model_dump(), "error": conn.error}

# --- Infisical store ------------------------------------------------------------------------

class InfisicalError(RuntimeError):
    pass

def _project_config() -> dict:
    path = Path(os.environ.get("INFISICAL_CONFIG", Path(__file__).resolve().parents[2] / ".infisical.json"))
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError) as e:
        raise InfisicalError(f"Cannot read {path}: {e}")

class InfisicalStore:
    """Reads key values and reads/writes CONN_* records with a machine identity (Universal Auth)."""

    def __init__(self):
        cfg = _project_config()
        self.site = os.environ.get("INFISICAL_SITE_URL", "https://app.infisical.com").rstrip("/")
        self.project = cfg.get("workspaceId", "")
        self.env = os.environ.get("INFISICAL_ENV") or cfg.get("defaultEnvironment", "dev")
        self.parent = "/" + (cfg.get("secretsPath") or "/").strip("/")
        self.path = f"{self.parent.rstrip('/')}/connections"
        self._token: Optional[str] = None

    async def _auth(self, client: httpx.AsyncClient) -> dict:
        if not self._token:
            cid, secret = os.environ.get("INFISICAL_CLIENT_ID"), os.environ.get("INFISICAL_CLIENT_SECRET")
            if not (cid and secret and self.project):
                raise InfisicalError("INFISICAL_CLIENT_ID / INFISICAL_CLIENT_SECRET are not set (machine identity)")
            res = await client.post(f"{self.site}/api/v1/auth/universal-auth/login",
                                    json={"clientId": cid, "clientSecret": secret})
            if res.status_code != 200:
                raise InfisicalError(f"Infisical login failed (HTTP {res.status_code})")
            self._token = res.json()["accessToken"]
        return {"Authorization": f"Bearer {self._token}"}

    async def _call(self, method: str, url: str, **kw) -> httpx.Response:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for attempt in (1, 2):
                res = await client.request(method, f"{self.site}{url}", headers=await self._auth(client), **kw)
                if res.status_code == 401 and attempt == 1:
                    self._token = None  # token expired: log in again once
                    continue
                return res
        return res

    def _scope(self, path: str) -> dict:
        return {"workspaceId": self.project, "environment": self.env, "secretPath": path}

    async def read_folder(self, path: str) -> dict[str, str]:
        """All secrets directly in one folder, as {KEY: value}. Missing folder -> {}."""
        res = await self._call("GET", "/api/v3/secrets/raw", params=self._scope(path))
        if res.status_code == 404:
            return {}
        if res.status_code != 200:
            raise InfisicalError(f"Infisical read of {path} failed (HTTP {res.status_code})")
        return {s["secretKey"]: s.get("secretValue", "") for s in res.json().get("secrets", []) if s.get("secretKey")}

    async def list(self) -> list[Connection]:
        out = []
        for key, value in (await self.read_folder(self.path)).items():
            if key.startswith("CONN_"):
                try:
                    out.append(Connection(id=key[5:].lower(), **json.loads(value)))
                except Exception:
                    pass  # a hand-edited, malformed record is skipped rather than breaking the panel
        return out

    async def put(self, conn: Connection, create: bool) -> None:
        if create:
            # Create the folder on first use; "already exists" is fine.
            await self._call("POST", "/api/v1/folders", json={
                "workspaceId": self.project, "environment": self.env, "name": "connections", "path": self.parent})
        body = {**self._scope(self.path), "type": "shared",
                "secretValue": json.dumps(conn.model_dump(exclude={"id"}))}
        res = await self._call("POST" if create else "PATCH", f"/api/v3/secrets/raw/CONN_{conn.id.upper()}", json=body)
        if res.status_code != 200:
            raise InfisicalError(f"Infisical write failed (HTTP {res.status_code})")

    async def delete(self, conn_id: str) -> None:
        res = await self._call("DELETE", f"/api/v3/secrets/raw/CONN_{conn_id.upper()}",
                               json={**self._scope(self.path), "type": "shared"})
        if res.status_code not in (200, 404):
            raise InfisicalError(f"Infisical delete failed (HTTP {res.status_code})")

# --- Resolving key names to values ------------------------------------------------------------

VALUES_TTL_SECONDS = 300
_values: dict[str, tuple[float, dict[str, str]]] = {}  # folder path -> (fetched_at, {KEY: value})

def _split(ref: str) -> tuple[str, str]:
    """'KEY' -> (admin folder, KEY); 'sub/dir/KEY' -> (admin folder/sub/dir, KEY)."""
    parent = store().parent.rstrip("/")
    folder, _, key = ref.rpartition("/")
    return (f"{parent}/{folder}" if folder else (parent or "/")), key

async def _folder_values(path: str) -> dict[str, str]:
    hit = _values.get(path)
    if hit and time.monotonic() - hit[0] < VALUES_TTL_SECONDS:
        return hit[1]
    values = await store().read_folder(path)
    _values[path] = (time.monotonic(), values)
    return values

async def resolve(conn: Connection) -> Connection:
    """Fills conn.config from Infisical; sets conn.error (and leaves config empty) if a key is missing."""
    config, missing = {}, []
    for field, ref in conn.keys.items():
        path, key = _split(ref)
        value = (await _folder_values(path)).get(key)
        if value:
            config[field] = value
        else:
            missing.append(ref)
    if missing:
        return conn.model_copy(update={"config": {}, "error": f"Not found in Infisical: {', '.join(missing)}"})
    return conn.model_copy(update={"config": config, "error": None})

def forget_values() -> None:
    _values.clear()

# --- Cached registry used by the rest of the app --------------------------------------------

_store: Optional[InfisicalStore] = None
_cache: Optional[dict[str, Connection]] = None  # records (key names only)

def store() -> InfisicalStore:
    global _store
    if _store is None:
        _store = InfisicalStore()
    return _store

async def reload() -> list[Connection]:
    """Re-reads records and drops cached values (picks up edits made directly in Infisical)."""
    global _cache
    forget_values()
    _cache = {c.id: c for c in await store().list()}
    return [await resolve(c) for c in _cache.values()]

async def _records() -> dict[str, Connection]:
    if _cache is None:
        await reload()
    return _cache

async def list_connections(provider: Optional[str] = None, category: Optional[str] = None) -> list[Connection]:
    """Resolved connections (config filled, or error set)."""
    conns = sorted((await _records()).values(), key=lambda c: (c.provider, c.name.lower()))
    return [await resolve(c) for c in conns
            if (provider is None or c.provider == provider)
            and (category is None or PROVIDERS[c.provider].category == category)]

async def get_connection(conn_id: str) -> Optional[Connection]:
    conn = (await _records()).get(conn_id)
    return await resolve(conn) if conn else None

async def check_input(data: ConnectionInput) -> Connection:
    """Validated, freshly resolved candidate (raises ValueError if a key name is missing in Infisical)."""
    forget_values()  # the admin may have just added the keys in Infisical
    conn = await resolve(Connection(id="candidate", provider=data.provider, name=data.name.strip(),
                                    keys=validate_input(data)))
    if conn.error:
        raise ValueError(f"{conn.error} (folder {store().parent})")
    return conn

async def add_connection(data: ConnectionInput) -> Connection:
    candidate = await check_input(data)
    records = await _records()
    conn = candidate.model_copy(update={"id": uuid.uuid4().hex[:12]})
    await store().put(conn, create=True)
    records[conn.id] = conn.model_copy(update={"config": {}, "error": None})
    return conn

async def set_status(conn_id: str, status: ConnectionStatus) -> Optional[Connection]:
    records = await _records()
    if conn_id not in records:
        return None
    updated = records[conn_id].model_copy(update={"status": status})
    await store().put(updated, create=False)
    records[conn_id] = updated
    return await resolve(updated)

async def delete_connection(conn_id: str) -> bool:
    records = await _records()
    if conn_id not in records:
        return False
    await store().delete(conn_id)
    records.pop(conn_id, None)
    return True
