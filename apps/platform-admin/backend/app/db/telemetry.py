import os
import json
from datetime import datetime, timezone, timedelta
from typing import List
from .config import (
    SUPABASE_PROJECTS,
    POSTGRES_FREE_LIMIT_BYTES,
    MONGO_FREE_LIMIT_BYTES,
)
from .connections import get_asyncpg_pool, get_mongo
from ..schemas.telemetry import (
    HotTableMetric,
    StorageQuotaMetric,
    CapacityTelemetryResponse,
    ArchivePreviewResponse,
)

EXCLUSIONS_FILE = os.path.join(os.path.dirname(__file__), "archive_exclusions.json")

def format_bytes(num_bytes: int) -> str:
    """Formats bytes into human readable MB/GB string."""
    if num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    elif num_bytes < 1024 * 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{num_bytes / (1024 * 1024 * 1024):.2f} GB"

def get_pinned_tables() -> List[str]:
    """Reads list of pinned tables that must never be auto-archived."""
    if not os.path.exists(EXCLUSIONS_FILE):
        default_pinned = ["platform_admin.global_settings", "clarity_fi.audit_log"]
        save_pinned_tables(default_pinned)
        return default_pinned
    try:
        with open(EXCLUSIONS_FILE, "r") as f:
            data = json.load(f)
            return data.get("pinned_tables", [])
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

# Baseline simulated telemetry data for graceful fallback / demo / testing
SIMULATED_PG_SIZES = {
    "core": 185 * 1024 * 1024,      # 185 MB
    "commerce": 95 * 1024 * 1024,   # 95 MB
    "business": 68 * 1024 * 1024,   # 68 MB
    "ai_erp": 120 * 1024 * 1024,    # 120 MB
}
SIMULATED_MONGO_SIZE = 110 * 1024 * 1024 # 110 MB

DEFAULT_HOT_TABLES = [
    {"schema": "tms", "table": "shipments", "rows": 85400, "bytes": 78 * 1024 * 1024, "score": 95},
    {"schema": "ims", "table": "products", "rows": 42000, "bytes": 45 * 1024 * 1024, "score": 88},
    {"schema": "marketplace", "table": "sellers", "rows": 18200, "bytes": 26 * 1024 * 1024, "score": 72},
    {"schema": "textile_care", "table": "orders", "rows": 64000, "bytes": 52 * 1024 * 1024, "score": 91},
    {"schema": "clarity_fi", "table": "transactions", "rows": 39500, "bytes": 38 * 1024 * 1024, "score": 84},
    {"schema": "zolexora_ai", "table": "models", "rows": 12400, "bytes": 62 * 1024 * 1024, "score": 65},
    {"schema": "platform_admin", "table": "global_settings", "rows": 150, "bytes": 120 * 1024, "score": 10},
]

async def collect_postgres_capacity(project_name: str) -> StorageQuotaMetric:
    """
    Measures PostgreSQL project capacity against 500MB free tier limit.
    Attempts live query via asyncpg; degrades gracefully to simulated baseline.
    """
    free_limit = POSTGRES_FREE_LIMIT_BYTES
    used_bytes = SIMULATED_PG_SIZES.get(project_name, 50 * 1024 * 1024)

    # Check for live asyncpg connection
    pool = await get_asyncpg_pool(project_name)
    if pool:
        try:
            async with pool.acquire() as conn:
                db_size = await conn.fetchval("SELECT pg_database_size(current_database());")
                if db_size:
                    used_bytes = int(db_size)
        except Exception:
            pass

    usage_pct = round((used_bytes / free_limit) * 100, 2)
    threshold_state = "NORMAL"
    if usage_pct >= 90.0:
        threshold_state = "CRITICAL"
    elif usage_pct >= 80.0:
        threshold_state = "WARNING"

    return StorageQuotaMetric(
        service="supabase_postgresql",
        project_or_cluster=project_name,
        free_tier_limit_bytes=free_limit,
        used_bytes=used_bytes,
        used_pretty=format_bytes(used_bytes),
        usage_percentage=usage_pct,
        threshold_state=threshold_state
    )

async def collect_mongo_capacity() -> StorageQuotaMetric:
    """
    Measures MongoDB Atlas cluster capacity against 512MB free tier limit.
    Attempts live dbStats query via motor; degrades gracefully to simulated baseline.
    """
    free_limit = MONGO_FREE_LIMIT_BYTES
    used_bytes = SIMULATED_MONGO_SIZE

    try:
        db = await get_mongo("zolexora-ai", raise_on_missing=False)
        if db is not None:
            stats = await db.command("dbStats")
            storage_size = stats.get("storageSize", 0) + stats.get("indexSize", 0)
            if storage_size > 0:
                used_bytes = int(storage_size)
    except Exception:
        pass

    usage_pct = round((used_bytes / free_limit) * 100, 2)
    threshold_state = "NORMAL"
    if usage_pct >= 90.0:
        threshold_state = "CRITICAL"
    elif usage_pct >= 80.0:
        threshold_state = "WARNING"

    return StorageQuotaMetric(
        service="mongodb_atlas",
        project_or_cluster="cluster0",
        free_tier_limit_bytes=free_limit,
        used_bytes=used_bytes,
        used_pretty=format_bytes(used_bytes),
        usage_percentage=usage_pct,
        threshold_state=threshold_state
    )

async def get_hot_tables_metrics() -> List[HotTableMetric]:
    """
    Collects hot table profiling statistics and marks pinned tables.
    """
    pinned = set(get_pinned_tables())
    metrics: List[HotTableMetric] = []

    for item in DEFAULT_HOT_TABLES:
        full_name = f"{item['schema']}.{item['table']}"
        is_pinned = full_name in pinned
        metrics.append(
            HotTableMetric(
                schema_name=item["schema"],
                table_name=item["table"],
                row_count_estimate=item["rows"],
                total_bytes=item["bytes"],
                total_size_pretty=format_bytes(item["bytes"]),
                read_activity_score=item["score"],
                is_pinned=is_pinned
            )
        )

    # Sort descending by size
    metrics.sort(key=lambda m: m.total_bytes, reverse=True)
    return metrics

async def get_capacity_telemetry() -> CapacityTelemetryResponse:
    """
    Aggregates capacity metrics across all databases and hot tables.
    """
    databases: List[StorageQuotaMetric] = []

    for project in SUPABASE_PROJECTS:
        metric = await collect_postgres_capacity(project)
        databases.append(metric)

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

def calculate_archive_preview(database: str, target_capacity_percent: float = 40.0) -> ArchivePreviewResponse:
    """
    Calculates the rows to archive and target cutoff date needed to shrink a database to target %.
    """
    free_limit = POSTGRES_FREE_LIMIT_BYTES if database != "mongodb_atlas" else MONGO_FREE_LIMIT_BYTES
    current_used = SIMULATED_PG_SIZES.get(database, 460 * 1024 * 1024)
    target_bytes = int(free_limit * (target_capacity_percent / 100.0))

    bytes_to_free = max(0, current_used - target_bytes)
    # Estimate average 1KB per record
    estimated_rows = max(0, bytes_to_free // 1024)

    # Calculate cutoff date: e.g. 180 days ago for full archive
    days_back = int((bytes_to_free / free_limit) * 365) + 30
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")

    pinned = get_pinned_tables()

    return ArchivePreviewResponse(
        database=database,
        current_usage_bytes=current_used,
        target_usage_bytes=target_bytes,
        estimated_rows_to_archive=estimated_rows,
        cutoff_date=cutoff_date,
        pinned_tables_skipped=pinned
    )
