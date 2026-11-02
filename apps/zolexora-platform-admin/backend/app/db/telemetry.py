import os
import json
import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import httpx
from .config import (
    SUPABASE_PROJECTS,
    POSTGRES_FREE_LIMIT_BYTES,
    MONGO_FREE_LIMIT_BYTES,
)
from .config import get_pg_pool_dsn
from .connections import get_asyncpg_pool, get_mongo
from .health import check_supabase_health, check_mongo_health
from ..services.infisical import get_secret, sync_secrets_from_infisical
from ..schemas.telemetry import (
    HotTableMetric,
    StorageQuotaMetric,
    CapacityTelemetryResponse,
    ArchivePreviewResponse,
    FleetService,
    FleetResponse,
)

# ADMIN_DATA_DIR is a persistent volume in Docker; locally the file sits next to this module.
EXCLUSIONS_FILE = os.path.join(os.environ.get("ADMIN_DATA_DIR", os.path.dirname(__file__)), "archive_exclusions.json")

def format_bytes(num_bytes: int) -> str:
    """Formats bytes into human readable KB/MB/GB string."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    elif num_bytes < 1024 * 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{num_bytes / (1024 * 1024 * 1024):.2f} GB"

def _threshold_state(is_configured: bool, reachable: bool, usage_pct: float) -> str:
    if not is_configured:
        return "UNCONFIGURED"
    if not reachable:
        return "UNREACHABLE"
    if usage_pct >= 90.0:
        return "CRITICAL"
    if usage_pct >= 80.0:
        return "WARNING"
    return "NORMAL"

def get_pinned_tables() -> List[str]:
    """Reads list of pinned tables that must never be auto-archived."""
    if not os.path.exists(EXCLUSIONS_FILE):
        default_pinned = ["platform_admin.global_settings"]
        save_pinned_tables(default_pinned)
        return default_pinned
    try:
        with open(EXCLUSIONS_FILE, "r") as f:
            data = json.load(f)
            return data.get("pinned_tables", ["platform_admin.global_settings"])
    except Exception:
        return ["platform_admin.global_settings"]

def save_pinned_tables(pinned_tables: List[str]) -> None:
    """Saves list of pinned tables."""
    try:
        with open(EXCLUSIONS_FILE, "w") as f:
            json.dump({"pinned_tables": pinned_tables}, f, indent=2)
    except Exception:
        pass

def toggle_table_pin(table_name: str, pin: bool) -> List[str]:
    """Toggles pinning status for a hot table."""
    pinned = set(get_pinned_tables())
    if pin:
        pinned.add(table_name)
    else:
        pinned.discard(table_name)
    pinned_list = sorted(list(pinned))
    save_pinned_tables(pinned_list)
    return pinned_list

async def collect_postgres_capacity(project_name: str) -> StorageQuotaMetric:
    """
    Measures PostgreSQL cloud project capacity against the 500MB free tier limit.
    Credentials must be provided by Infisical.
    If credentials are not yet configured in Infisical, reports 0 B with unconfigured status.
    """
    free_limit = POSTGRES_FREE_LIMIT_BYTES
    used_bytes = 0
    reachable = False
    is_configured = get_pg_pool_dsn(project_name) is not None

    pool = await get_asyncpg_pool(project_name) if is_configured else None
    if pool:
        try:
            async with pool.acquire() as conn:
                used_bytes = int(await conn.fetchval("SELECT pg_database_size(current_database());") or 0)
                reachable = True
        except Exception:
            pass

    usage_pct = round((used_bytes / free_limit) * 100, 2)
    threshold_state = _threshold_state(is_configured, reachable, usage_pct)

    return StorageQuotaMetric(
        service="supabase_postgresql",
        project_or_cluster=f"supabase_{project_name}",
        free_tier_limit_bytes=free_limit,
        used_bytes=used_bytes,
        used_pretty=format_bytes(used_bytes) if reachable else threshold_state.title(),
        usage_percentage=usage_pct,
        threshold_state=threshold_state,
        is_configured=is_configured,
        infisical_path=f"/shared/database-pool/SUPABASE_{project_name.upper()}_URL"
    )

async def collect_mongo_capacity() -> StorageQuotaMetric:
    """
    Measures MongoDB Atlas cloud cluster capacity against 512MB free tier limit.
    Credentials must be provided by Infisical (MONGO_URI).
    """
    free_limit = MONGO_FREE_LIMIT_BYTES
    used_bytes = 0
    mongo_uri = get_secret("MONGO_URI")
    is_configured = bool(mongo_uri)

    reachable = False

    if mongo_uri:
        try:
            db = await get_mongo("zolexora-ai", raise_on_missing=False)
            if db is not None:
                stats = await db.command("dbStats")
                used_bytes = int(stats.get("storageSize", 0) + stats.get("indexSize", 0))
                reachable = True
        except Exception:
            pass

    usage_pct = round((used_bytes / free_limit) * 100, 2)
    threshold_state = _threshold_state(is_configured, reachable, usage_pct)

    return StorageQuotaMetric(
        service="mongodb_atlas",
        project_or_cluster="cluster0",
        free_tier_limit_bytes=free_limit,
        used_bytes=used_bytes,
        used_pretty=format_bytes(used_bytes) if reachable else threshold_state.title(),
        usage_percentage=usage_pct,
        threshold_state=threshold_state,
        is_configured=is_configured,
        infisical_path="/shared/MONGO_URI"
    )

async def get_hot_tables_metrics() -> List[HotTableMetric]:
    """
    Collects real hot table metrics from connected cloud Supabase databases.
    Only queries live cloud database instances. Returns empty list if cloud credentials
    have not yet been provided in Infisical.
    """
    pinned = set(get_pinned_tables())
    metrics: List[HotTableMetric] = []

    for proj in SUPABASE_PROJECTS:
        pool = await get_asyncpg_pool(proj)
        if pool:
            try:
                async with pool.acquire() as conn:
                    rows = await conn.fetch("""
                        SELECT 
                            schemaname, 
                            relname as tablename, 
                            COALESCE(n_live_tup, 0) as row_count,
                            pg_total_relation_size(relid) as total_bytes
                        FROM pg_stat_user_tables
                        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                        ORDER BY pg_total_relation_size(relid) DESC, relname ASC;
                    """)
                    for r in rows:
                        full_name = f"{r['schemaname']}.{r['tablename']}"
                        is_pinned = full_name in pinned
                        metrics.append(
                            HotTableMetric(
                                schema_name=r["schemaname"],
                                table_name=r["tablename"],
                                row_count_estimate=int(r["row_count"]),
                                total_bytes=int(r["total_bytes"]),
                                total_size_pretty=format_bytes(int(r["total_bytes"])),
                                read_activity_score=0,
                                is_pinned=is_pinned
                            )
                        )
            except Exception:
                pass

    return metrics

async def get_capacity_telemetry() -> CapacityTelemetryResponse:
    """
    Aggregates real capacity metrics across the 4 cloud Supabase PostgreSQL clusters
    and MongoDB Atlas document cluster.
    """
    # Sync latest secrets if Infisical or environment variables changed
    try:
        await sync_secrets_from_infisical()
    except Exception:
        pass

    databases: List[StorageQuotaMetric] = []

    # 1. Cloud Supabase project clusters (Core, Commerce, Business, AI/ERP)
    for project in SUPABASE_PROJECTS:
        metric = await collect_postgres_capacity(project)
        databases.append(metric)

    # 2. MongoDB Atlas shared cloud cluster
    mongo_metric = await collect_mongo_capacity()
    databases.append(mongo_metric)

    overall_alert = any(db.threshold_state == "CRITICAL" for db in databases)
    hot_tables = await get_hot_tables_metrics()

    return CapacityTelemetryResponse(
        databases=databases,
        overall_threshold_alert=overall_alert,
        hot_tables=hot_tables,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

ARCHIVE_TARGETS = [*SUPABASE_PROJECTS, "mongodb_atlas"]
ARCHIVE_CUTOFF_DAYS = 90  # retention policy: rows older than this are archive candidates

async def calculate_archive_preview(database: str, target_capacity_percent: float = 40.0) -> ArchivePreviewResponse:
    """
    Estimates how many rows must be archived to shrink a database to the target % of its free tier.
    Uses the live database size and its average row size; 0 rows when the database is not reachable.
    """
    # The UI sends the capacity card's project_or_cluster ("supabase_core", "cluster0").
    target = "mongodb_atlas" if database == "cluster0" else database.removeprefix("supabase_")
    if target not in ARCHIVE_TARGETS:
        raise ValueError(f"Unknown database '{database}'. Expected one of {ARCHIVE_TARGETS}.")

    current_used = 0
    avg_row_bytes = 0
    if target == "mongodb_atlas":
        free_limit = MONGO_FREE_LIMIT_BYTES
        try:
            db = await get_mongo("zolexora-ai", raise_on_missing=False)
            if db is not None:
                stats = await db.command("dbStats")
                current_used = int(stats.get("storageSize", 0) + stats.get("indexSize", 0))
                avg_row_bytes = int(stats.get("avgObjSize", 0))
        except Exception:
            pass
    else:
        free_limit = POSTGRES_FREE_LIMIT_BYTES
        pool = await get_asyncpg_pool(target)
        if pool:
            try:
                async with pool.acquire() as conn:
                    row = await conn.fetchrow("""
                        SELECT pg_database_size(current_database()) AS db_bytes,
                               COALESCE(sum(pg_total_relation_size(relid)), 0) AS table_bytes,
                               COALESCE(sum(n_live_tup), 0) AS row_count
                        FROM pg_stat_user_tables
                    """)
                    current_used = int(row["db_bytes"])
                    if row["row_count"]:
                        avg_row_bytes = int(row["table_bytes"]) // int(row["row_count"])
            except Exception:
                pass

    target_bytes = int(free_limit * (target_capacity_percent / 100.0))
    bytes_to_free = max(0, current_used - target_bytes)
    estimated_rows = bytes_to_free // avg_row_bytes if avg_row_bytes else 0
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=ARCHIVE_CUTOFF_DAYS)).strftime("%Y-%m-%d")

    return ArchivePreviewResponse(
        database=database,
        current_usage_bytes=current_used,
        target_usage_bytes=target_bytes,
        estimated_rows_to_archive=estimated_rows,
        cutoff_date=cutoff_date,
        pinned_tables_skipped=get_pinned_tables()
    )

async def probe_endpoint(url: str, timeout_sec: float = 0.8) -> tuple[bool, Optional[int]]:
    """Helper to probe an HTTP endpoint and return (is_healthy, latency_ms)."""
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            res = await client.get(url)
            elapsed_ms = max(1, int((time.time() - start) * 1000))
            if res.status_code < 400 or res.status_code in (401, 403, 404):
                return True, elapsed_ms
            return False, elapsed_ms
    except Exception:
        return False, None

async def collect_fleet_telemetry() -> FleetResponse:
    """
    Queries live operational telemetry for the Platform Control Plane and all
    Cloud Infrastructure targets configured in Infisical.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    services: List[FleetService] = []

    # -------------------------------------------------------------
    # 1. Platform Admin Control Plane Stack
    # -------------------------------------------------------------

    # A. Gateway
    nginx_ok, nginx_lat = await probe_endpoint("http://platform-admin-nginx:80/healthz")
    if not nginx_ok:
        nginx_ok, nginx_lat = await probe_endpoint("http://localhost:3095/healthz")
    services.append(
        FleetService(
            id="fleet-platform-admin-nginx",
            name="Platform Admin Gateway",
            category="edge",
            environment="Platform Control Plane",
            host="Edge Reverse Proxy",
            endpoint="http://localhost:3095",
            status="operational" if nginx_ok else "degraded",
            latency_ms=nginx_lat,
            last_checked=now_iso,
            details="Nginx 1.31 reverse proxy gateway routing /api and frontend"
        )
    )

    # B. Frontend
    fe_ok, fe_lat = await probe_endpoint("http://platform-admin-frontend:3000")
    if not fe_ok:
        fe_ok, fe_lat = await probe_endpoint("http://localhost:3092")
    services.append(
        FleetService(
            id="fleet-platform-admin-frontend",
            name="Platform Admin Frontend",
            category="frontend",
            environment="Platform Control Plane",
            host="Web App",
            endpoint="http://localhost:3092 (port 3095 via Gateway)",
            status="operational" if fe_ok else "degraded",
            latency_ms=fe_lat,
            last_checked=now_iso,
            details="Next.js 14 centralized administration and observability console"
        )
    )

    # C. Backend API
    be_ok, be_lat = await probe_endpoint("http://127.0.0.1:8000/api/health")
    if not be_ok:
        be_ok, be_lat = await probe_endpoint("http://platform-admin-backend:8000/api/health")
    services.append(
        FleetService(
            id="fleet-platform-admin-backend",
            name="Platform Admin Control Plane API",
            category="backend",
            environment="Platform Control Plane",
            host="Control Plane Service",
            endpoint="http://localhost:4041/api (port 3095/api via Gateway)",
            status="operational" if be_ok else "degraded",
            latency_ms=be_lat,
            last_checked=now_iso,
            details="FastAPI 1.0.0 central connection router & Infisical secret manager"
        )
    )

    # -------------------------------------------------------------
    # 2. Cloud Database Infrastructure (Credentials via Infisical)
    # -------------------------------------------------------------
    db_labels = {
        "core": ("Supabase Core Cluster", "IMS, Marketplace, TMS schemas"),
        "commerce": ("Supabase Commerce Cluster", "Textile Care, Rento Easy schemas"),
        "business": ("Supabase Business Cluster", "Engage, Clarity FI, Maun Kavach schemas"),
        "ai_erp": ("Supabase AI & ERP Cluster", "AI Models, ERP Supplements schemas"),
    }

    for proj in ["core", "commerce", "business", "ai_erp"]:
        h = await check_supabase_health(proj)
        status_val = "operational" if h.status == "healthy" else ("unconfigured" if h.status == "unconfigured" else "degraded")
        label, desc = db_labels[proj]
        services.append(
            FleetService(
                id=f"fleet-supabase-{proj}",
                name=label,
                category="database",
                environment="Cloud Database Tier",
                host="Supabase Cloud",
                endpoint=f"Supabase pooler :6543 ({proj})",
                status=status_val,
                latency_ms=h.latency_ms if h.latency_ms > 0 else None,
                last_checked=now_iso,
                details=h.details or h.error or f"PostgREST pooler ({desc}) • Infisical: /shared/database-pool/SUPABASE_{proj.upper()}_URL"
            )
        )

    mongo_h = await check_mongo_health()
    mongo_status = "operational" if mongo_h.status == "healthy" else ("unconfigured" if mongo_h.status == "unconfigured" else "degraded")
    services.append(
        FleetService(
            id="fleet-mongodb-atlas",
            name="MongoDB Atlas Shared Cluster",
            category="database",
            environment="Cloud Database Tier",
            host="MongoDB Atlas Cloud",
            endpoint="cluster0.mongodb.net (db_ai, db_tms, db_engage)",
            status=mongo_status,
            latency_ms=mongo_h.latency_ms if mongo_h.latency_ms > 0 else None,
            last_checked=now_iso,
            details=mongo_h.details or mongo_h.error or "M0 Free Tier document store • Infisical: /shared/MONGO_URI"
        )
    )

    # -------------------------------------------------------------
    # 3. Cloud Edge, Storage, and Communications (Via Infisical)
    # -------------------------------------------------------------

    # Cloudflare Edge Gateway
    cf_id = get_secret("CF_ACCOUNT_ID")
    services.append(
        FleetService(
            id="fleet-cloudflare-edge",
            name="Cloudflare Edge Gateway & Turnstile",
            category="edge",
            environment="Cloud Edge & Security",
            host="Cloudflare",
            endpoint="https://api-edge.zolexora.com",
            status="operational" if cf_id else "unconfigured",
            latency_ms=None,
            last_checked=now_iso,
            details="Account ID present (not probed)" if cf_id else "Infisical: /platform-admin/CF_ACCOUNT_ID"
        )
    )

    # Cloudflare R2
    r2_id = get_secret("R2_ACCOUNT_ID")
    services.append(
        FleetService(
            id="fleet-cloudflare-r2",
            name="Cloudflare R2 Object Storage",
            category="edge",
            environment="Cloud Edge & Security",
            host="Cloudflare R2",
            endpoint=f"https://{r2_id or 'r2'}.r2.cloudflarestorage.com",
            status="operational" if r2_id else "unconfigured",
            latency_ms=None,
            last_checked=now_iso,
            details="Account ID present (not probed)" if r2_id else "Infisical: /shared/R2_ACCOUNT_ID"
        )
    )

    # Resend Email
    resend_key = get_secret("RESEND_API_KEY")
    services.append(
        FleetService(
            id="fleet-resend-email",
            name="Resend Primary Email Dispatcher",
            category="worker",
            environment="Cloud Communications",
            host="Resend Cloud",
            endpoint="https://api.resend.com/emails",
            status="operational" if resend_key else "unconfigured",
            latency_ms=None,
            last_checked=now_iso,
            details="API key present (not probed)" if resend_key else "Infisical: /shared/RESEND_API_KEY"
        )
    )

    # Brevo Email
    brevo_key = get_secret("BREVO_API_KEY")
    services.append(
        FleetService(
            id="fleet-brevo-email",
            name="Brevo Backup Email Dispatcher",
            category="worker",
            environment="Cloud Communications",
            host="Brevo Cloud",
            endpoint="https://api.brevo.com/v3/smtp/email",
            status="operational" if brevo_key else "unconfigured",
            latency_ms=None,
            last_checked=now_iso,
            details="API key present (not probed)" if brevo_key else "Infisical: /shared/BREVO_API_KEY"
        )
    )

    # SendGrid Email
    sendgrid_key = get_secret("SENDGRID_API_KEY")
    services.append(
        FleetService(
            id="fleet-sendgrid-email",
            name="SendGrid Tertiary Email Dispatcher",
            category="worker",
            environment="Cloud Communications",
            host="SendGrid Cloud",
            endpoint="https://api.sendgrid.com/v3/mail/send",
            status="operational" if sendgrid_key else "unconfigured",
            latency_ms=None,
            last_checked=now_iso,
            details="API key present (not probed)" if sendgrid_key else "Infisical: /shared/SENDGRID_API_KEY"
        )
    )

    # Summary counts
    op_cnt = sum(1 for s in services if s.status == "operational")
    deg_cnt = sum(1 for s in services if s.status == "degraded")
    stp_cnt = sum(1 for s in services if s.status == "stopped")
    unc_cnt = sum(1 for s in services if s.status == "unconfigured")

    return FleetResponse(
        services=services,
        total_count=len(services),
        operational_count=op_cnt,
        degraded_count=deg_cnt,
        stopped_count=stp_cnt,
        unconfigured_count=unc_cnt,
        timestamp=now_iso
    )
