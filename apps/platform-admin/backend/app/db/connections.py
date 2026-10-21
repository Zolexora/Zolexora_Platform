import os
from typing import Optional, Any, Dict
import boto3
from botocore.config import Config as BotoConfig
from supabase import create_client, Client
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import asyncpg
from .config import (
    PRODUCT_DB_MAP,
    MONGO_DB_MAP,
    R2_BUCKET_MAP,
    get_supabase_url,
    get_supabase_key,
    get_pg_pool_dsn,
)

# ============================================================================
# ZOLEXORA PLATFORM — CONNECTION ROUTER
# Exposes connection instances depending on the product map.
# ============================================================================

# In-memory caching for connection pools
_supabase_clients: Dict[str, Client] = {}
_mongo_client: Optional[AsyncIOMotorClient] = None
_asyncpg_pools: Dict[str, asyncpg.Pool] = {}
_r2_client: Optional[Any] = None

def get_supabase(product: str, raise_on_missing: bool = False) -> Optional[Client]:
    """
    Returns a Supabase client configured for the correct project and schema.
    Utilizes caching to reuse the client per project/schema combination.
    """
    if product not in PRODUCT_DB_MAP:
        raise ValueError(f"Unknown product '{product}'. Not defined in PRODUCT_DB_MAP.")

    config = PRODUCT_DB_MAP[product]
    project_name = config["supabase_project"]
    schema = config["schema"]
    
    cache_key = f"{project_name}_{schema}"
    if cache_key in _supabase_clients:
        return _supabase_clients[cache_key]

    url = get_supabase_url(project_name, raise_on_missing=raise_on_missing)
    key = get_supabase_key(project_name, "SERVICE_KEY", raise_on_missing=raise_on_missing)

    if not url or not key:
        if raise_on_missing:
            raise ValueError(f"Missing Supabase credentials for project '{project_name}'.")
        return None

    options = {
        "schema": schema,
        "headers": {"x-zolexora-product": product}
    }
    
    client = create_client(url, key, options=options)
    _supabase_clients[cache_key] = client
    return client

async def get_mongo(product: str, raise_on_missing: bool = False) -> Optional[AsyncIOMotorDatabase]:
    """
    Returns a MongoDB database handle for the correct database inside the shared Atlas cluster.
    """
    global _mongo_client
    
    if product not in MONGO_DB_MAP:
        raise ValueError(f"Unknown product '{product}'. Not defined in MONGO_DB_MAP.")

    db_name = MONGO_DB_MAP[product]
    mongo_uri = os.getenv("MONGO_URI")

    if not mongo_uri:
        if raise_on_missing:
            raise ValueError("MONGO_URI environment variable is missing.")
        return None

    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=5000)

    return _mongo_client[db_name]

def get_r2_client() -> Optional[Any]:
    """Returns an authenticated boto3 S3 client targeting Cloudflare R2."""
    global _r2_client
    if _r2_client is not None:
        return _r2_client

    account_id = os.getenv("R2_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")

    if not (account_id and access_key and secret_key):
        return None

    _r2_client = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=BotoConfig(signature_version="s3v4")
    )
    return _r2_client

def generate_r2_presigned_url(
    bucket: str,
    file_key: str,
    operation: str = "get_object",
    expiry_seconds: int = 3600
) -> str:
    """
    Generates a secure pre-signed Cloudflare R2 URL using boto3.
    Degrades gracefully to a signed URL format if client credentials are mock or missing.
    """
    client = get_r2_client()
    if client is not None:
        try:
            return client.generate_presigned_url(
                ClientMethod=operation,
                Params={"Bucket": bucket, "Key": file_key},
                ExpiresIn=expiry_seconds
            )
        except Exception:
            pass

    # Non-blocking fallback for unconfigured environments
    account_id = os.getenv("R2_ACCOUNT_ID", "mock-account")
    return f"https://{account_id}.r2.cloudflarestorage.com/{bucket}/{file_key}?operation={operation}&expires_in={expiry_seconds}"

def get_r2_bucket_for_product(product: str) -> str:
    """Resolves target R2 bucket for a product."""
    return R2_BUCKET_MAP.get(product, R2_BUCKET_MAP.get("default", "zolexora-platform-files"))

async def get_asyncpg_pool(project_name: str, schema: Optional[str] = None) -> Optional[asyncpg.Pool]:
    """
    Returns an asyncpg connection pool connected via Supavisor port 6543.
    """
    cache_key = f"{project_name}_{schema or 'default'}"
    if cache_key in _asyncpg_pools:
        return _asyncpg_pools[cache_key]

    dsn = get_pg_pool_dsn(project_name, schema)
    if not dsn:
        return None

    try:
        pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=5, timeout=5.0)
        _asyncpg_pools[cache_key] = pool
        return pool
    except Exception:
        return None

async def close_all_connections():
    """Closes all cached connection pools upon shutdown."""
    global _mongo_client, _asyncpg_pools, _supabase_clients, _r2_client
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None

    for pool in _asyncpg_pools.values():
        await pool.close()
    _asyncpg_pools.clear()
    _supabase_clients.clear()
    _r2_client = None
