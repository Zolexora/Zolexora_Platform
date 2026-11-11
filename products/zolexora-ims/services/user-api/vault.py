"""Payment gateway secrets of each business, kept in one Infisical folder instead of the database.

Folder IMS_VAULT_PATH (default /Zolexora_IMS_Gateways) holds one secret per business, named ORG_<org id>
(hyphens as underscores), whose value is JSON: {"razorpay_key_secret", "razorpay_webhook_secret",
"cashfree_secret_key"}. The database, its Litestream backups and SQL dumps never contain them.

The folder must sit outside /Zolexora_IMS: scripts/setup/with-infisical.sh injects /Zolexora_IMS and
everything under it into every process it starts. The API writes with a machine identity (Universal Auth)
whose role allows only this folder: IMS_VAULT_CLIENT_ID, IMS_VAULT_CLIENT_SECRET, IMS_VAULT_PROJECT_ID,
IMS_VAULT_ENV, and optionally IMS_VAULT_SITE_URL (self-hosted Infisical).
"""
import json
import os
import re
import time
from typing import Dict, Optional, Tuple

import httpx

SECRET_FIELDS = ("razorpay_key_secret", "razorpay_webhook_secret", "cashfree_secret_key")
CACHE_SECONDS = 300
_ORG_ID = re.compile(r"^[A-Za-z0-9-]{1,80}$")


class VaultError(RuntimeError):
    pass


class GatewayVault:
    def __init__(self):
        self.site = os.getenv("IMS_VAULT_SITE_URL", "https://app.infisical.com").rstrip("/")
        self.client_id = os.getenv("IMS_VAULT_CLIENT_ID", "")
        self.client_secret = os.getenv("IMS_VAULT_CLIENT_SECRET", "")
        self.project = os.getenv("IMS_VAULT_PROJECT_ID", "")
        self.env = os.getenv("IMS_VAULT_ENV", "")
        self.path = os.getenv("IMS_VAULT_PATH", "/Zolexora_IMS_Gateways")
        self._token: Optional[str] = None
        self._cache: Dict[str, Tuple[float, Dict[str, str]]] = {}

    @property
    def configured(self) -> bool:
        return all((self.client_id, self.client_secret, self.project, self.env))

    @staticmethod
    def key(org_id: str) -> str:
        if not _ORG_ID.match(org_id or ""):
            raise VaultError("Invalid business id")
        return "ORG_" + org_id.replace("-", "_")

    async def _call(self, method: str, name: str, **kw) -> httpx.Response:
        if not self.configured:
            raise VaultError("Gateway vault not configured: set IMS_VAULT_CLIENT_ID, IMS_VAULT_CLIENT_SECRET, "
                             "IMS_VAULT_PROJECT_ID and IMS_VAULT_ENV (Infisical /Zolexora_IMS).")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for attempt in (1, 2):
                    if not self._token:
                        res = await client.post(f"{self.site}/api/v1/auth/universal-auth/login",
                                                json={"clientId": self.client_id, "clientSecret": self.client_secret})
                        if res.status_code != 200:
                            raise VaultError(f"Gateway vault login failed (HTTP {res.status_code})")
                        self._token = res.json()["accessToken"]
                    res = await client.request(method, f"{self.site}/api/v3/secrets/raw/{name}",
                                               headers={"Authorization": f"Bearer {self._token}"}, **kw)
                    if res.status_code == 401 and attempt == 1:
                        self._token = None  # expired: log in again once
                        continue
                    return res
        except httpx.HTTPError as e:
            raise VaultError("Gateway vault unreachable") from e
        return res

    def _scope(self) -> dict:
        return {"workspaceId": self.project, "environment": self.env, "secretPath": self.path}

    async def get(self, org_id: str) -> Dict[str, str]:
        """This business's gateway secrets ({} if none saved)."""
        name = self.key(org_id)
        hit = self._cache.get(name)
        if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
            return hit[1]
        res = await self._call("GET", name, params=self._scope())
        if res.status_code == 404:
            secrets: Dict[str, str] = {}
        elif res.status_code == 200:
            secrets = json.loads(res.json()["secret"]["secretValue"] or "{}")
        else:
            raise VaultError(f"Gateway vault read failed (HTTP {res.status_code})")
        self._cache[name] = (time.monotonic(), secrets)
        return secrets

    async def put(self, org_id: str, secrets: Dict[str, str]) -> None:
        name = self.key(org_id)
        clean = {k: v for k, v in secrets.items() if k in SECRET_FIELDS and v}
        body = {**self._scope(), "secretValue": json.dumps(clean), "type": "shared"}
        res = await self._call("PATCH", name, json=body)
        if res.status_code in (400, 404):  # not there yet
            res = await self._call("POST", name, json=body)
        if res.status_code != 200:
            raise VaultError(f"Gateway vault write failed (HTTP {res.status_code})")
        self._cache[name] = (time.monotonic(), clean)
