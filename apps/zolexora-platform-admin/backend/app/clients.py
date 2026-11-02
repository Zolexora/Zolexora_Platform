"""Clients and health probes for connections (cached per connection id)."""
import asyncio
import time
from typing import Any, Literal, Optional

import asyncpg
import boto3
import httpx
from botocore.config import Config as BotoConfig
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pydantic import BaseModel

from .connections import Connection

# connection id -> (fingerprint of resolved values, client). A changed value in Infisical
# (e.g. a rotated password) gives a new fingerprint, so the client is rebuilt.
_pg: dict[str, tuple[int, asyncpg.Pool]] = {}
_mongo: dict[str, tuple[int, AsyncIOMotorClient]] = {}
_r2: dict[str, tuple[int, Any]] = {}


def _fp(conn: Connection) -> int:
    return hash(tuple(sorted(conn.config.items())))


async def pg_pool(conn: Connection) -> Optional[asyncpg.Pool]:
    """Pool for a Supabase connection's Postgres URL; None if not set or unreachable."""
    dsn = conn.config.get("pg_url")
    if not dsn:
        return None
    if conn.id in _pg and _pg[conn.id][0] != _fp(conn):
        await close(conn.id)
    if conn.id not in _pg:
        try:
            _pg[conn.id] = (_fp(conn), await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=3, timeout=5.0))
        except Exception:
            return None
    return _pg[conn.id][1]


def mongo_db(conn: Connection) -> AsyncIOMotorDatabase:
    if conn.id in _mongo and _mongo[conn.id][0] != _fp(conn):
        _mongo.pop(conn.id)[1].close()
    if conn.id not in _mongo:
        _mongo[conn.id] = (_fp(conn), AsyncIOMotorClient(conn.config["uri"], serverSelectionTimeoutMS=5000))
    return _mongo[conn.id][1][conn.config["database"]]


def r2_client(conn: Connection) -> Any:
    if conn.id in _r2 and _r2[conn.id][0] != _fp(conn):
        _r2.pop(conn.id)
    if conn.id not in _r2:
        _r2[conn.id] = _fp(conn), boto3.client(
            "s3",
            endpoint_url=f"https://{conn.config['account_id']}.r2.cloudflarestorage.com",
            aws_access_key_id=conn.config["access_key_id"],
            aws_secret_access_key=conn.config["secret_access_key"],
            region_name="auto",
            config=BotoConfig(signature_version="s3v4", connect_timeout=5, read_timeout=5, retries={"max_attempts": 1}),
        )
    return _r2[conn.id][1]


async def close(conn_id: str) -> None:
    if (entry := _pg.pop(conn_id, None)) is not None:
        await entry[1].close()
    if (entry := _mongo.pop(conn_id, None)) is not None:
        entry[1].close()
    _r2.pop(conn_id, None)


async def close_all() -> None:
    for conn_id in {*_pg, *_mongo, *_r2}:
        await close(conn_id)


# --- Probes -----------------------------------------------------------------------------------

class Probe(BaseModel):
    status: Literal["healthy", "degraded"]
    latency_ms: Optional[int] = None
    detail: str


async def _http(method: str, url: str, **kw) -> httpx.Response:
    async with httpx.AsyncClient(timeout=6.0) as client:
        return await client.request(method, url, **kw)


def _by_status(res: httpx.Response, ok: str) -> tuple[bool, str]:
    if res.status_code == 200:
        return True, ok
    if res.status_code in (401, 403):
        return False, "key rejected"
    return False, f"HTTP {res.status_code}"


async def _check(conn: Connection) -> tuple[bool, str]:
    c = conn.config
    p = conn.provider
    if p == "supabase":
        res = await _http("GET", f"{c['url'].rstrip('/')}/auth/v1/health", headers={"apikey": c["api_key"]})
        return _by_status(res, "project reachable, key accepted")
    if p == "mongodb":
        await mongo_db(conn).command("ping")
        return True, "ping acknowledged"
    if p == "r2":
        await asyncio.to_thread(r2_client(conn).head_bucket, Bucket=c["bucket"])
        return True, f"bucket {c['bucket']} reachable"
    if p == "resend":
        res = await _http("GET", "https://api.resend.com/domains", headers={"Authorization": f"Bearer {c['api_key']}"})
        if res.status_code == 401 and "restricted" in res.text:
            return True, "send-only key accepted"
        return _by_status(res, "key accepted")
    if p == "brevo":
        return _by_status(await _http("GET", "https://api.brevo.com/v3/account", headers={"api-key": c["api_key"]}), "key accepted")
    if p == "sendgrid":
        res = await _http("GET", "https://api.sendgrid.com/v3/scopes", headers={"Authorization": f"Bearer {c['api_key']}"})
        return _by_status(res, "key accepted")
    if p == "cloudflare":
        headers = {"Authorization": f"Bearer {c['api_token']}"}
        res = await _http("GET", f"https://api.cloudflare.com/client/v4/accounts/{c['account_id']}/tokens/verify", headers=headers)
        if res.status_code != 200:  # user-owned tokens verify on a different endpoint
            res = await _http("GET", "https://api.cloudflare.com/client/v4/user/tokens/verify", headers=headers)
        return _by_status(res, "token active")
    if p == "firebase":
        res = await _http("GET", "https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig",
                          params={"key": c["web_api_key"]})
        ok, detail = _by_status(res, "project reachable")
        if ok and res.json().get("projectId") != c["project_id"]:
            return False, "API key belongs to a different project"
        return ok, detail if res.status_code != 400 else "key rejected"
    return False, "unknown provider"


async def probe(conn: Connection) -> Probe:
    if conn.error:
        return Probe(status="degraded", detail=conn.error)
    start = time.monotonic()
    try:
        ok, detail = await _check(conn)
    except Exception as e:
        return Probe(status="degraded", detail=f"unreachable: {type(e).__name__}: {e}"[:300])
    latency = max(1, int((time.monotonic() - start) * 1000))
    return Probe(status="healthy" if ok else "degraded", latency_ms=latency, detail=detail)


async def probe_all(conns: list[Connection]) -> list[Probe]:
    return list(await asyncio.gather(*(probe(c) for c in conns)))
