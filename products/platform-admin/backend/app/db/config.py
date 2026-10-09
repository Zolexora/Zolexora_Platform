import os
from typing import Dict, Any

# ============================================================================
# ZOLEXORA PLATFORM — DATABASE ROUTER MAP
# Defines the location and connection details for every product's database.
# ============================================================================

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
    "zolexora-ai":    "db_ai",
    "zolexora-tms":   "db_tms",
    "zolexora-engage":"db_engage",
}

D1_DB_MAP: Dict[str, str] = {
    "sessions": "D1_SESSIONS_ID",
    "catalog":  "D1_CATALOG_ID",
    "config":   "D1_CONFIG_ID",
    "routes":   "D1_ROUTES_ID",
}

def get_supabase_url(project_name: str) -> str:
    """Helper to dynamically fetch the right SUPABASE_URL based on the mapped project name."""
    env_var_name = f"SUPABASE_{project_name.upper()}_URL"
    url = os.getenv(env_var_name)
    if not url:
        raise ValueError(f"Missing environment variable: {env_var_name}")
    return url

def get_supabase_key(project_name: str, key_type: str = "SERVICE_KEY") -> str:
    """Helper to fetch the ANON or SERVICE_KEY for a specific project."""
    env_var_name = f"SUPABASE_{project_name.upper()}_{key_type.upper()}"
    key = os.getenv(env_var_name)
    if not key:
        raise ValueError(f"Missing environment variable: {env_var_name}")
    return key
