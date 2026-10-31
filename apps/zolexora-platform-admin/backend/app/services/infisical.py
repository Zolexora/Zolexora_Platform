import os
import logging
from typing import Dict, Optional, Any, List
import httpx

logger = logging.getLogger("infisical")

INFISICAL_SITE_URL = os.getenv("INFISICAL_SITE_URL", "https://app.infisical.com").rstrip("/")
INFISICAL_WORKSPACE_ID = os.getenv("INFISICAL_WORKSPACE_ID", "")
INFISICAL_ENV = os.getenv("INFISICAL_ENV", os.getenv("ENVIRONMENT", "dev"))
INFISICAL_TOKEN = os.getenv("INFISICAL_TOKEN", "")
INFISICAL_CLIENT_ID = os.getenv("INFISICAL_CLIENT_ID", "")
INFISICAL_CLIENT_SECRET = os.getenv("INFISICAL_CLIENT_SECRET", "")

# In-memory secrets cache
_secrets_cache: Dict[str, str] = {}
_last_sync_timestamp: Optional[str] = None
_sync_status: str = "initialized"
_sync_diagnostics: List[str] = []

async def authenticate_universal_auth() -> Optional[str]:
    """
    Authenticates with Infisical Machine Identity via Universal Auth.
    Returns access token or None.
    """
    if not (INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET):
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(
                f"{INFISICAL_SITE_URL}/api/v1/auth/universal-auth/login",
                json={
                    "clientId": INFISICAL_CLIENT_ID,
                    "clientSecret": INFISICAL_CLIENT_SECRET
                }
            )
            if res.status_code == 200:
                data = res.json()
                return data.get("accessToken")
            else:
                logger.warning(f"Infisical Universal Auth failed ({res.status_code}): {res.text}")
    except Exception as e:
        logger.warning(f"Error authenticating with Infisical: {e}")
    return None

async def sync_secrets_from_infisical() -> Dict[str, Any]:
    """
    Pulls cloud secrets from Infisical Cloud REST API if credentials are provided.
    Falls back gracefully to process environment variables injected via Infisical CLI / Docker.
    """
    global _secrets_cache, _last_sync_timestamp, _sync_status, _sync_diagnostics
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    _last_sync_timestamp = now_iso
    _sync_diagnostics = []

    access_token = INFISICAL_TOKEN
    if not access_token:
        access_token = await authenticate_universal_auth()

    if access_token and INFISICAL_WORKSPACE_ID:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(
                    f"{INFISICAL_SITE_URL}/api/v3/secrets/raw",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "workspaceId": INFISICAL_WORKSPACE_ID,
                        "environment": INFISICAL_ENV,
                    }
                )
                if res.status_code == 200:
                    payload = res.json()
                    secrets_list = payload.get("secrets", [])
                    for s in secrets_list:
                        k = s.get("secretKey")
                        v = s.get("secretValue")
                        if k and v:
                            _secrets_cache[k] = v
                            os.environ[k] = v
                    _sync_status = "connected"
                    msg = f"Synced {len(secrets_list)} secrets from Infisical workspace '{INFISICAL_WORKSPACE_ID}' ({INFISICAL_ENV})."
                    _sync_diagnostics.append(msg)
                    return {
                        "status": "success",
                        "synced_count": len(secrets_list),
                        "timestamp": now_iso,
                        "diagnostics": _sync_diagnostics
                    }
                else:
                    _sync_diagnostics.append(f"Infisical API returned HTTP {res.status_code}: {res.text}")
        except Exception as e:
            _sync_diagnostics.append(f"Infisical API request failed: {str(e)}")

    # Fallback to container environment variables
    _sync_status = "environment_fallback"
    env_keys = [
        "SUPABASE_CORE_URL", "SUPABASE_CORE_SERVICE_KEY", "SUPABASE_CORE_PG_URL",
        "SUPABASE_COMMERCE_URL", "SUPABASE_COMMERCE_SERVICE_KEY", "SUPABASE_COMMERCE_PG_URL",
        "SUPABASE_BUSINESS_URL", "SUPABASE_BUSINESS_SERVICE_KEY", "SUPABASE_BUSINESS_PG_URL",
        "SUPABASE_AI_ERP_URL", "SUPABASE_AI_ERP_SERVICE_KEY", "SUPABASE_AI_ERP_PG_URL",
        "MONGO_URI", "CF_ACCOUNT_ID", "RESEND_API_KEY", "BREVO_API_KEY", "SENDGRID_API_KEY",
        "FIREBASE_ACTIVE_ACCOUNTS"
    ]
    discovered_count = 0
    for k in env_keys:
        v = os.getenv(k)
        if v:
            _secrets_cache[k] = v
            discovered_count += 1

    _sync_diagnostics.append(
        f"Reading credentials from Infisical-injected environment ({discovered_count}/{len(env_keys)} platform keys present)."
    )

    return {
        "status": "success" if discovered_count > 0 else "partial",
        "synced_count": discovered_count,
        "timestamp": now_iso,
        "diagnostics": _sync_diagnostics
    }

def get_secret(key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Fetches secret value from Infisical cache or process environment.
    """
    if key in _secrets_cache:
        return _secrets_cache[key]
    val = os.getenv(key)
    if val:
        _secrets_cache[key] = val
        return val
    return default
