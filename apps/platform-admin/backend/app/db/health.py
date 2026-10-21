import os
import time
from datetime import datetime, timezone
from typing import Dict
from .config import PRODUCT_DB_MAP, MONGO_DB_MAP, SUPABASE_PROJECTS, get_supabase_url, get_supabase_key
from .connections import get_supabase, get_mongo
from ..schemas.health import DatabaseTargetHealth, DatabaseHealthReport

# ============================================================================
# ZOLEXORA PLATFORM — DATABASE HEALTH MONITOR
# Non-blocking health checks across all clustered Supabase projects and MongoDB
# ============================================================================

async def check_supabase_health(project_name: str) -> DatabaseTargetHealth:
    """
    Checks the health of a specific Supabase project with non-blocking graceful degradation.
    Returns status 'unconfigured' if credentials are missing, avoiding unhandled 500 exceptions.
    """
    url = get_supabase_url(project_name, raise_on_missing=False)
    key = get_supabase_key(project_name, "SERVICE_KEY", raise_on_missing=False)

    if not url or not key:
        return DatabaseTargetHealth(
            target=f"supabase_{project_name}",
            status="unconfigured",
            latency_ms=-1,
            details=f"Missing credentials: SUPABASE_{project_name.upper()}_URL or SERVICE_KEY",
            error=None
        )

    # Find a product mapped to this project to use its client config
    sample_product = next(
        (p for p, cfg in PRODUCT_DB_MAP.items() if cfg["supabase_project"] == project_name),
        None
    )
    if not sample_product:
        return DatabaseTargetHealth(
            target=f"supabase_{project_name}",
            status="unconfigured",
            latency_ms=-1,
            details=f"No products registered for project {project_name}"
        )

    start_time = time.time()
    try:
        client = get_supabase(sample_product, raise_on_missing=False)
        if not client:
            return DatabaseTargetHealth(
                target=f"supabase_{project_name}",
                status="unconfigured",
                latency_ms=-1,
                details=f"Client initialization failed for project {project_name}"
            )

        # Probing a system table or non-existent table to verify REST API is reachable
        client.table("non_existent_table").select("*").limit(1).execute()
    except Exception as e:
        err_msg = str(e)
        # If the response code indicates table/relation does not exist, PostgREST endpoint is healthy
        if any(keyword in err_msg for keyword in ["40", "Relation", "relation", "does not exist", "PGRST"]):
            pass
        else:
            return DatabaseTargetHealth(
                target=f"supabase_{project_name}",
                status="degraded",
                latency_ms=-1,
                error=err_msg
            )

    latency = max(1, int((time.time() - start_time) * 1000))
    return DatabaseTargetHealth(
        target=f"supabase_{project_name}",
        status="healthy",
        latency_ms=latency,
        details=f"Supabase {project_name} project reachable via PostgREST"
    )

async def check_mongo_health() -> DatabaseTargetHealth:
    """
    Checks the health of the MongoDB Atlas cluster with non-blocking graceful degradation.
    """
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        return DatabaseTargetHealth(
            target="mongodb_atlas",
            status="unconfigured",
            latency_ms=-1,
            details="Missing MONGO_URI environment variable",
            error=None
        )

    start_time = time.time()
    try:
        first_product = next(iter(MONGO_DB_MAP), "zolexora-ai")
        db = await get_mongo(first_product, raise_on_missing=False)
        if db is None:
            return DatabaseTargetHealth(
                target="mongodb_atlas",
                status="unconfigured",
                latency_ms=-1,
                details="MongoDB client pool could not be initialized"
            )
        await db.command("ping")
    except Exception as e:
        return DatabaseTargetHealth(
            target="mongodb_atlas",
            status="degraded",
            latency_ms=-1,
            error=str(e)
        )

    latency = max(1, int((time.time() - start_time) * 1000))
    return DatabaseTargetHealth(
        target="mongodb_atlas",
        status="healthy",
        latency_ms=latency,
        details="MongoDB Atlas cluster ping acknowledged"
    )

async def get_system_health() -> DatabaseHealthReport:
    """
    Returns comprehensive health metrics for all 4 Supabase projects and MongoDB Atlas.
    """
    targets: Dict[str, DatabaseTargetHealth] = {}

    for project in SUPABASE_PROJECTS:
        targets[f"supabase_{project}"] = await check_supabase_health(project)

    targets["mongodb_atlas"] = await check_mongo_health()

    # Determine overall status
    statuses = [t.status for t in targets.values()]
    if all(s == "healthy" for s in statuses):
        overall_status = "healthy"
    elif any(s in ("healthy", "unconfigured") for s in statuses):
        overall_status = "degraded"
    else:
        overall_status = "unhealthy"

    return DatabaseHealthReport(
        overall_status=overall_status,
        targets=targets,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
