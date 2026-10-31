import os
from typing import Dict, Any, Optional

# ============================================================================
# ZOLEXORA PLATFORM — DATABASE ROUTER MAP
# Defines the location and connection details for every product's database.
# ============================================================================

SUPABASE_PROJECTS = ["core", "commerce", "business", "ai_erp"]

PRODUCT_DB_MAP: Dict[str, Dict[str, Any]] = {
    # ── zolexora-core ───────────────────────────────────────────────
    "zolexora-ims": {
        "supabase_project": "core",          
        "schema":           "ims",           
        "pool_port":        6543,            
    },
    "zolexora-marketplace": {
        "supabase_project": "core",
        "schema":           "marketplace",
        "pool_port":        6543,
    },
    "zolexora-tms": {
        "supabase_project": "core",
        "schema":           "tms",
        "pool_port":        6543,
    },
    
    # ── zolexora-commerce ───────────────────────────────────────────
    "textile-care": {
        "supabase_project": "commerce",
        "schema":           "textile_care",
        "pool_port":        6543,
    },
    "rento-easy": {
        "supabase_project": "commerce",
        "schema":           "rento_easy",
        "pool_port":        6543,
    },
    "platform-admin": {
        "supabase_project": "commerce",
        "schema":           "platform_admin",
        "pool_port":        6543,
    },

    # ── zolexora-business ───────────────────────────────────────────
    "zolexora-engage": {
        "supabase_project": "business",
        "schema":           "engage",
        "pool_port":        6543,
    },
    "clarity-fi": {
        "supabase_project": "business",
        "schema":           "clarity_fi",
        "pool_port":        6543,
    },
    "maun-kavach": {
        "supabase_project": "business",
        "schema":           "maun_kavach",
        "pool_port":        6543,
    },

    # ── zolexora-ai-erp ─────────────────────────────────────────────
    "zolexora-ai": {
        "supabase_project": "ai_erp",
        "schema":           "zolexora_ai",
        "pool_port":        6543,
    },
    "erp-supplements": {
        "supabase_project": "ai_erp",
        "schema":           "erp_supplements",
        "pool_port":        6543,
    },
}

MONGO_DB_MAP: Dict[str, str] = {
    "zolexora-ai":     "db_ai",
    "zolexora-tms":    "db_tms",
    "zolexora-engage": "db_engage",
}

D1_DB_MAP: Dict[str, str] = {
    "sessions": "D1_SESSIONS_ID",
    "catalog":  "D1_CATALOG_ID",
    "config":   "D1_CONFIG_ID",
    "routes":   "D1_ROUTES_ID",
}

R2_BUCKET_MAP: Dict[str, str] = {
    "zolexora-ims":         os.getenv("R2_BUCKET_IMS", "zolexora-ims-files"),
    "zolexora-marketplace": os.getenv("R2_BUCKET_MARKETPLACE", "zolexora-marketplace-files"),
    "zolexora-tms":         os.getenv("R2_BUCKET_TMS", "zolexora-tms-files"),
    "default":              os.getenv("R2_BUCKET_DEFAULT", "zolexora-platform-files"),
}

# Free-tier capacity limits
POSTGRES_FREE_LIMIT_BYTES = 500 * 1024 * 1024   # 500 MB (524,288,000 bytes)
MONGO_FREE_LIMIT_BYTES    = 512 * 1024 * 1024   # 512 MB (536,870,912 bytes)

def get_supabase_url(project_name: str, raise_on_missing: bool = True) -> Optional[str]:
    """Helper to dynamically fetch the right SUPABASE_URL based on the mapped project name."""
    from ..services.infisical import get_secret
    env_var_name = f"SUPABASE_{project_name.upper()}_URL"
    url = get_secret(env_var_name)
    if not url:
        if raise_on_missing:
            raise ValueError(f"Missing environment variable: {env_var_name}")
        return None
    return url

def get_supabase_key(project_name: str, key_type: str = "SERVICE_KEY", raise_on_missing: bool = True) -> Optional[str]:
    """Helper to fetch the ANON or SERVICE_KEY for a specific project."""
    from ..services.infisical import get_secret
    env_var_name = f"SUPABASE_{project_name.upper()}_{key_type.upper()}"
    key = get_secret(env_var_name)
    if not key:
        if raise_on_missing:
            raise ValueError(f"Missing environment variable: {env_var_name}")
        return None
    return key

def get_pg_pool_dsn(project_name: str, schema: Optional[str] = None) -> Optional[str]:
    """
    Constructs an asyncpg DSN for cloud Supavisor connection pooling on port 6543
    using credentials strictly retrieved from Infisical.
    """
    from ..services.infisical import get_secret
    project_upper = project_name.upper()
    explicit_dsn = get_secret(f"SUPABASE_{project_upper}_PG_URL")
    if explicit_dsn:
        if schema and "search_path" not in explicit_dsn:
            separator = "&" if "?" in explicit_dsn else "?"
            return f"{explicit_dsn}{separator}options=-csearch_path%3D{schema}"
        return explicit_dsn

    db_host = get_secret(f"SUPABASE_{project_upper}_HOST")
    db_user = get_secret(f"SUPABASE_{project_upper}_USER")
    db_pass = get_secret(f"SUPABASE_{project_upper}_PASSWORD")
    db_name = get_secret(f"SUPABASE_{project_upper}_DB", "postgres")
    port = int(get_secret(f"SUPABASE_{project_upper}_PORT", "6543") or "6543")

    if not db_host or not db_pass:
        return None

    dsn = f"postgresql://{db_user}:{db_pass}@{db_host}:{port}/{db_name}"
    if schema:
        dsn += f"?options=-csearch_path%3D{schema}"
    return dsn
