import os
import httpx
import aiosqlite
from typing import Any, Dict, List, Optional


class AdminD1Adapter:
    """Cloudflare D1 Serverless SQL Adapter for Admin Control Plane with local SQLite fallback."""

    def __init__(
        self,
        http_client: Optional[httpx.AsyncClient] = None,
        sqlite_path: Optional[str] = None,
    ):
        self.account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.database_id = os.getenv("CLOUDFLARE_D1_DATABASE_ID")
        self.api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        self.http_client = http_client
        self.use_d1 = bool(self.account_id and self.database_id and self.api_token)
        self.sqlite_path = sqlite_path or os.getenv(
            "LOCAL_SQLITE_PATH",
            os.path.join(os.path.dirname(__file__), "../../ims-user/backend/data/zolexora.db")
        )

    async def init(self):
        pass

    async def _get_client(self) -> httpx.AsyncClient:
        return self.http_client or httpx.AsyncClient(timeout=15.0)

    async def query(self, sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        params = params or []
        if self.use_d1:
            url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}/query"
            headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}
            client = await self._get_client()
            try:
                resp = await client.post(url, headers=headers, json={"sql": sql, "params": params})
                data = resp.json()
                if data.get("success"):
                    return data.get("result", [{}])[0].get("results", [])
            except Exception:
                pass
            finally:
                if not self.http_client:
                    await client.aclose()

        if not os.path.exists(self.sqlite_path):
            return []
        async with aiosqlite.connect(self.sqlite_path) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute(sql, params) as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]

    async def fetch_one(self, sql: str, params: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        rows = await self.query(sql, params)
        return rows[0] if rows else None

    async def execute(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        params = params or []
        if self.use_d1:
            url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}/query"
            headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}
            client = await self._get_client()
            try:
                resp = await client.post(url, headers=headers, json={"sql": sql, "params": params})
                data = resp.json()
                if data.get("success"):
                    meta = data.get("result", [{}])[0].get("meta", {})
                    return {"success": True, "rows_affected": meta.get("changes", 0)}
            except Exception:
                pass
            finally:
                if not self.http_client:
                    await client.aclose()

        async with aiosqlite.connect(self.sqlite_path) as conn:
            async with conn.execute(sql, params) as cursor:
                await conn.commit()
                return {"success": True, "rows_affected": cursor.rowcount}
