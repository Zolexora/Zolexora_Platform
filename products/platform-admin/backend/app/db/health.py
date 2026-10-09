import asyncio
import time
from typing import Dict, Any
from .config import PRODUCT_DB_MAP, MONGO_DB_MAP
from .connections import get_supabase, get_mongo

# ============================================================================
# ZOLEXORA PLATFORM — DATABASE HEALTH MONITOR
# Regularly checks connectivity to all clustered databases.
# ============================================================================

async def check_supabase_health(product: str) -> Dict[str, Any]:
    """Checks the health of the Supabase project associated with a product."""
    start_time = time.time()
    try:
        client = get_supabase(product)
        # Simple query to verify connection and schema resolution
        # We query a generic postgres system table or simple limit 1
        client.table("non_existent_table").select("*").limit(1).execute()
    except Exception as e:
        # We expect a PostgrestAPIError (404/400) which means the REST API is alive,
        # but if we get a connection error, it will be caught here.
        if "40" in str(e) or "Relation" in str(e) or "relation" in str(e):
             # The DB is alive, the table just doesn't exist. This is a successful ping.
             pass
        else:
            return {
                "status": "degraded",
                "latency_ms": -1,
                "error": str(e)
            }
    
    latency = int((time.time() - start_time) * 1000)
    return {
        "status": "healthy",
        "latency_ms": latency
    }

async def check_mongo_health(product: str) -> Dict[str, Any]:
    """Checks the health of the MongoDB database associated with a product."""
    start_time = time.time()
    try:
        db = await get_mongo(product)
        # Execute a fast ping command
        await db.command("ping")
    except Exception as e:
        return {
            "status": "degraded",
            "latency_ms": -1,
            "error": str(e)
        }
    
    latency = int((time.time() - start_time) * 1000)
    return {
        "status": "healthy",
        "latency_ms": latency
    }

async def get_system_health() -> Dict[str, Dict[str, Any]]:
    """
    Returns a comprehensive health report of all clustered databases.
    Used by the Platform Admin dashboard.
    """
    health_report = {}
    
    # We only need to check one product per unique project to avoid spamming pings
    checked_supabase_projects = set()
    
    for product, config in PRODUCT_DB_MAP.items():
        project = config["supabase_project"]
        if project not in checked_supabase_projects:
            health_report[f"supabase_{project}"] = await check_supabase_health(product)
            checked_supabase_projects.add(project)
            
    # For MongoDB, we share a cluster, so we only need to ping it once via any product
    if MONGO_DB_MAP:
        first_mongo_product = next(iter(MONGO_DB_MAP))
        health_report["mongodb"] = await check_mongo_health(first_mongo_product)

    return health_report
