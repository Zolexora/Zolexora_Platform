"""Health, capacity and fleet telemetry built from the connections added in the panel."""
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import httpx

from .. import clients
from ..connections import PROVIDERS, Connection, list_connections
from ..schemas.health import DatabaseHealthReport, DatabaseTargetHealth
from ..schemas.telemetry import (
    ArchivePreviewResponse,
    CapacityTelemetryResponse,
    FleetResponse,
    FleetService,
    HotTableMetric,
    StorageQuotaMetric,
)

# Free-tier capacity limits
POSTGRES_FREE_LIMIT_BYTES = 500 * 1024 * 1024
MONGO_FREE_LIMIT_BYTES = 512 * 1024 * 1024
ARCHIVE_CUTOFF_DAYS = 90  # retention policy: rows older than this are archive candidates
DEFAULT_PINNED = ["platform_admin.global_settings"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def format_bytes(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    if num_bytes < 1024 ** 2:
        return f"{num_bytes / 1024:.1f} KB"
    if num_bytes < 1024 ** 3:
        return f"{num_bytes / 1024 ** 2:.1f} MB"
    return f"{num_bytes / 1024 ** 3:.2f} GB"


# --- Hot-storage pins (tables never auto-archived) -------------------------------------------

def _pins_file() -> Path:
    # ADMIN_DATA_DIR is a persistent volume in Docker; locally the file sits in the app folder.
    return Path(os.environ.get("ADMIN_DATA_DIR", Path(__file__).resolve().parents[1])) / "archive_exclusions.json"


def get_pinned_tables() -> List[str]:
    try:
        return json.loads(_pins_file().read_text()).get("pinned_tables", DEFAULT_PINNED)
    except (OSError, ValueError):
        return list(DEFAULT_PINNED)


def save_pinned_tables(pinned: List[str]) -> None:
    _pins_file().write_text(json.dumps({"pinned_tables": pinned}, indent=2))


def toggle_table_pin(table_name: str, pin: bool) -> List[str]:
    pinned = set(get_pinned_tables())
    (pinned.add if pin else pinned.discard)(table_name)
    save_pinned_tables(sorted(pinned))
    return sorted(pinned)


# --- Database health -------------------------------------------------------------------------

async def database_health() -> DatabaseHealthReport:
    targets = {}
    for conn in await list_connections(category="database"):
        p = await clients.probe(conn)
        targets[conn.id] = DatabaseTargetHealth(
            target=conn.id, name=conn.name, provider=conn.provider, status=p.status,
            latency_ms=p.latency_ms or -1,
            details=p.detail if p.status == "healthy" else None,
            error=None if p.status == "healthy" else p.detail,
        )
    statuses = [t.status for t in targets.values()]
    if all(s == "healthy" for s in statuses):
        overall = "healthy"  # also when nothing is connected yet: nothing is failing
    elif any(s == "healthy" for s in statuses):
        overall = "degraded"
    else:
        overall = "unhealthy"
    return DatabaseHealthReport(overall_status=overall, targets=targets, timestamp=now_iso())


# --- Capacity ----------------------------------------------------------------------------------

def _threshold_state(reachable: bool, usage_pct: float) -> str:
    if not reachable:
        return "UNREACHABLE"
    if usage_pct >= 90.0:
        return "CRITICAL"
    if usage_pct >= 80.0:
        return "WARNING"
    return "NORMAL"


async def _postgres_size(conn: Connection) -> Optional[int]:
    pool = await clients.pg_pool(conn)
    if pool is None:
        return None
    try:
        async with pool.acquire() as c:
            return int(await c.fetchval("SELECT pg_database_size(current_database());") or 0)
    except Exception:
        return None


async def _mongo_stats(conn: Connection) -> Optional[dict]:
    try:
        return await clients.mongo_db(conn).command("dbStats")
    except Exception:
        return None


async def capacity_metric(conn: Connection) -> Optional[StorageQuotaMetric]:
    """None for a Supabase connection without a Postgres URL (capacity not requested)."""
    if conn.provider == "supabase":
        if "pg_url" not in conn.keys:
            return None
        limit, service, used = POSTGRES_FREE_LIMIT_BYTES, "supabase_postgresql", await _postgres_size(conn)
    else:
        stats = await _mongo_stats(conn)
        limit, service = MONGO_FREE_LIMIT_BYTES, "mongodb_atlas"
        used = None if stats is None else int(stats.get("storageSize", 0) + stats.get("indexSize", 0))
    reachable = used is not None
    used = used or 0
    pct = round(used / limit * 100, 2)
    state = _threshold_state(reachable, pct)
    return StorageQuotaMetric(
        connection_id=conn.id, service=service, project_or_cluster=conn.name,
        free_tier_limit_bytes=limit, used_bytes=used,
        used_pretty=format_bytes(used) if reachable else state.title(),
        usage_percentage=pct, threshold_state=state, is_configured=True,
    )


async def hot_tables() -> List[HotTableMetric]:
    pinned = set(get_pinned_tables())
    metrics: List[HotTableMetric] = []
    for conn in await list_connections(provider="supabase"):
        pool = await clients.pg_pool(conn)
        if pool is None:
            continue
        try:
            async with pool.acquire() as c:
                rows = await c.fetch("""
                    SELECT schemaname, relname AS tablename, COALESCE(n_live_tup, 0) AS row_count,
                           pg_total_relation_size(relid) AS total_bytes
                    FROM pg_stat_user_tables
                    ORDER BY pg_total_relation_size(relid) DESC, relname ASC
                    LIMIT 50;
                """)
        except Exception:
            continue
        for r in rows:
            metrics.append(HotTableMetric(
                connection_id=conn.id, schema_name=r["schemaname"], table_name=r["tablename"],
                row_count_estimate=int(r["row_count"]), total_bytes=int(r["total_bytes"]),
                total_size_pretty=format_bytes(int(r["total_bytes"])), read_activity_score=0,
                is_pinned=f"{r['schemaname']}.{r['tablename']}" in pinned,
            ))
    return metrics


async def capacity() -> CapacityTelemetryResponse:
    databases = [m for c in await list_connections(category="database") if (m := await capacity_metric(c))]
    return CapacityTelemetryResponse(
        databases=databases,
        overall_threshold_alert=any(d.threshold_state == "CRITICAL" for d in databases),
        hot_tables=await hot_tables(),
        timestamp=now_iso(),
    )


async def archive_preview(conn: Connection, target_capacity_percent: float) -> ArchivePreviewResponse:
    """Rows to archive to shrink the database to the target % of its free tier (live size and row size)."""
    current, avg_row = 0, 0
    if conn.provider == "mongodb":
        limit = MONGO_FREE_LIMIT_BYTES
        if stats := await _mongo_stats(conn):
            current = int(stats.get("storageSize", 0) + stats.get("indexSize", 0))
            avg_row = int(stats.get("avgObjSize", 0))
    else:
        limit = POSTGRES_FREE_LIMIT_BYTES
        pool = await clients.pg_pool(conn)
        if pool is not None:
            try:
                async with pool.acquire() as c:
                    row = await c.fetchrow("""
                        SELECT pg_database_size(current_database()) AS db_bytes,
                               COALESCE(sum(pg_total_relation_size(relid)), 0) AS table_bytes,
                               COALESCE(sum(n_live_tup), 0) AS row_count
                        FROM pg_stat_user_tables
                    """)
                current = int(row["db_bytes"])
                if row["row_count"]:
                    avg_row = int(row["table_bytes"]) // int(row["row_count"])
            except Exception:
                pass
    target = int(limit * target_capacity_percent / 100.0)
    to_free = max(0, current - target)
    return ArchivePreviewResponse(
        database=conn.id, current_usage_bytes=current, target_usage_bytes=target,
        estimated_rows_to_archive=to_free // avg_row if avg_row else 0,
        cutoff_date=(datetime.now(timezone.utc) - timedelta(days=ARCHIVE_CUTOFF_DAYS)).strftime("%Y-%m-%d"),
        pinned_tables_skipped=get_pinned_tables(),
    )


# --- Fleet -----------------------------------------------------------------------------------

async def _probe_url(url: str) -> tuple[bool, Optional[int]]:
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=0.8) as client:
            res = await client.get(url)
        return res.status_code < 500, max(1, int((time.monotonic() - start) * 1000))
    except Exception:
        return False, None


async def _first_ok(*urls: str) -> tuple[bool, Optional[int]]:
    for url in urls:
        ok, latency = await _probe_url(url)
        if ok:
            return ok, latency
    return False, None


FLEET_CATEGORY = {"database": "database", "storage": "edge", "email": "worker", "edge": "edge"}


async def fleet() -> FleetResponse:
    ts = now_iso()
    services: List[FleetService] = []
    for sid, name, category, endpoint, urls, details in [
        ("fleet-platform-admin-nginx", "Platform Admin Gateway", "edge", "http://localhost:3095",
         ("http://platform-admin-nginx:80/healthz", "http://localhost:3095/healthz"), "nginx reverse proxy for /api and the UI"),
        ("fleet-platform-admin-frontend", "Platform Admin Frontend", "frontend", "http://localhost:3092",
         ("http://platform-admin-frontend:3000", "http://localhost:3092"), "Next.js admin console"),
        ("fleet-platform-admin-backend", "Platform Admin API", "backend", "http://localhost:4041/api",
         ("http://127.0.0.1:8000/api/health", "http://platform-admin-backend:8000/api/health"), "FastAPI control plane"),
    ]:
        ok, latency = await _first_ok(*urls)
        services.append(FleetService(id=sid, name=name, category=category, environment="Platform Control Plane",
                                     host=name, endpoint=endpoint, status="operational" if ok else "degraded",
                                     latency_ms=latency, last_checked=ts, details=details))

    conns = await list_connections()
    for conn, p in zip(conns, await clients.probe_all(conns)):
        spec = PROVIDERS[conn.provider]
        status = "stopped" if conn.status == "DRAINING" else ("operational" if p.status == "healthy" else "degraded")
        services.append(FleetService(
            id=f"fleet-{conn.id}", name=conn.name, category=FLEET_CATEGORY[spec.category],
            environment="Connections", host=spec.label, endpoint=identifier(conn),
            status=status, latency_ms=p.latency_ms, last_checked=ts, details=p.detail,
        ))

    return FleetResponse(
        services=services, total_count=len(services),
        operational_count=sum(s.status == "operational" for s in services),
        degraded_count=sum(s.status == "degraded" for s in services),
        stopped_count=sum(s.status == "stopped" for s in services),
        unconfigured_count=0, timestamp=ts,
    )


def identifier(conn: Connection) -> str:
    """Non-secret label for a connection: project ref, account, bucket or host."""
    if conn.error:
        return "keys missing in Infisical"
    c = conn.config
    if conn.provider == "supabase":
        return c["url"].split("//")[-1].split(".")[0]
    if conn.provider == "mongodb":
        rest = c["uri"].split("://", 1)[-1]  # drop scheme, then any user:password@
        host = rest.split("@")[-1].split("/")[0].split("?")[0]
        return f"{host} / {c['database']}"
    if conn.provider == "r2":
        return f"{c['account_id']} / {c['bucket']}"
    if conn.provider in ("cloudflare",):
        return c["account_id"]
    if conn.provider == "firebase":
        return c["project_id"]
    return c.get("sender_email") or conn.provider
