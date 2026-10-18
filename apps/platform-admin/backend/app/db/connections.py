import os
import asyncio
from typing import Optional, Any
from supabase import create_client, Client
# Motor is recommended for async MongoDB operations in FastAPI
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import PRODUCT_DB_MAP, MONGO_DB_MAP, get_supabase_url, get_supabase_key

# ============================================================================
# ZOLEXORA PLATFORM — CONNECTION ROUTER
# Exposes connection instances depending on the product map.
# ============================================================================

# In-memory caching for connection pools
_supabase_clients: dict[str, Client] = {}
_mongo_client: Optional[AsyncIOMotorClient] = None

def get_supabase(product: str) -> Client:
    """
    Returns a Supabase client configured for the correct project and schema.
    Utilizes caching to reuse the client per project/schema combination.
    """
    if product not in PRODUCT_DB_MAP:
        raise ValueError(f"Unknown product '{product}'. Not defined in PRODUCT_DB_MAP.")

    config = PRODUCT_DB_MAP[product]
    project_name = config["supabase_project"]
    schema = config["schema"]
    
    # We cache the client per product, so they are isolated by schema config
    cache_key = f"{project_name}_{schema}"
    
    if cache_key in _supabase_clients:
        return _supabase_clients[cache_key]

    url = get_supabase_url(project_name)
    key = get_supabase_key(project_name, "SERVICE_KEY") # Use service key for backend admin tasks

    # Standard create_client doesn't natively swap the port to 6543 for Supavisor in python-supabase 
    # but normally we'd configure connection string here if using raw asyncpg.
    # For now, we provide the standard python-supabase REST client configured with the correct schema.
    options = {
        "schema": schema,
        "headers": {"x-zolexora-product": product}
    }
    
    client = create_client(url, key, options=options)
    _supabase_clients[cache_key] = client
    return client

async def get_mongo(product: str) -> AsyncIOMotorDatabase:
    """
    Returns a MongoDB database handle for the correct database inside the shared Atlas cluster.
    """
    global _mongo_client
    
    if product not in MONGO_DB_MAP:
        raise ValueError(f"Unknown product '{product}'. Not defined in MONGO_DB_MAP.")

    db_name = MONGO_DB_MAP[product]
    
    if _mongo_client is None:
        mongo_uri = os.getenv("MONGO_URI")
        if not mongo_uri:
            raise ValueError("MONGO_URI environment variable is missing.")
        # Initialize the motor client pool
        _mongo_client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=5000)

    return _mongo_client[db_name]

def get_r2_url(bucket: str, key: str, expiry_seconds: int = 3600) -> str:
    """
    Returns a pre-signed Cloudflare R2 URL for secure file access.
    This is a stub. Implementation requires boto3 configured for Cloudflare R2 endpoint.
    """
    # Example boto3 usage:
    # s3_client = boto3.client('s3', endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com", aws_access_key_id=..., aws_secret_access_key=...)
    # return s3_client.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': key}, ExpiresIn=expiry_seconds)
    return f"https://mock-r2-url.cloudflarestorage.com/{bucket}/{key}?expires={expiry_seconds}"
