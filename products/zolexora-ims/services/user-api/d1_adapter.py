import os
import httpx
import aiosqlite
from typing import Any, Dict, List, Optional
import sys

# Support importing from services/shared
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../shared")))
try:
    from logging import setup_logger
    logger = setup_logger("zolexora.ims_user.d1")
except ImportError:
    import logging
    logger = logging.getLogger("zolexora.ims_user.d1")


class D1Adapter:
    """Unified Database Adapter: Pure Cloudflare D1 Serverless SQL with local SQLite fallback."""

    def __init__(
        self,
        account_id: Optional[str] = None,
        database_id: Optional[str] = None,
        api_token: Optional[str] = None,
        http_client: Optional[httpx.AsyncClient] = None,
        sqlite_path: Optional[str] = None,
        schema_path: Optional[str] = None,
    ):
        self.account_id = account_id or os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.database_id = database_id or os.getenv("CLOUDFLARE_D1_DATABASE_ID")
        self.api_token = api_token or os.getenv("CLOUDFLARE_API_TOKEN")
        self.http_client = http_client
        self.use_d1 = bool(self.account_id and self.database_id and self.api_token)
        self.sqlite_path = sqlite_path or os.getenv(
            "LOCAL_SQLITE_PATH",
            os.path.join(os.path.dirname(__file__), "data", "zolexora.db")
        )
        self.schema_path = schema_path or os.path.join(os.path.dirname(__file__), "schema.sql")

    def _schema_statements(self) -> List[str]:
        with open(self.schema_path, "r", encoding="utf-8") as f:
            sql = "\n".join(line for line in f.read().splitlines() if not line.lstrip().startswith("--"))
        return [st.strip() + ";" for st in sql.split(";") if st.strip()]

    async def init(self):
        """Creates the business-scoped tables (schema.sql) on D1 and in local SQLite.
        Refuses to start on the old demo schema (rows keyed globally, organizations table)."""
        legacy = "SELECT name FROM sqlite_master WHERE type='table' AND name='organizations';"
        hint = "Old IMS demo schema found. Run apps/ims-user/migrations/0002_drop_demo_schema.sql once"
        statements = self._schema_statements()

        os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
        async with aiosqlite.connect(self.sqlite_path) as conn:
            if await (await conn.execute(legacy)).fetchone():
                raise RuntimeError(f"{hint} (local SQLite: delete {self.sqlite_path}).")
            for st in statements:
                await conn.execute(st)
            await conn.commit()

        if self.use_d1:
            if await self._query_d1(legacy, []):
                raise RuntimeError(f"{hint} on D1 database {self.database_id}.")
            for st in statements:
                await self._execute_d1(st, [])
            logger.info("Cloudflare D1 schema verified: %s", self.database_id)

    async def query(self, sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        params = params or []
        if self.use_d1:
            try:
                return await self._query_d1(sql, params)
            except Exception as e:
                logger.warning("Cloudflare D1 query error, falling back to local SQLite: %s", e)
        return await self._query_sqlite(sql, params)

    async def fetch_one(self, sql: str, params: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        rows = await self.query(sql, params)
        return rows[0] if rows else None

    async def execute(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        params = params or []
        res = None
        if self.use_d1:
            try:
                res = await self._execute_d1(sql, params)
            except Exception as e:
                logger.warning("Cloudflare D1 execute error, using local SQLite: %s", e)
        sqlite_res = await self._execute_sqlite(sql, params)
        return res or sqlite_res

    async def _query_sqlite(self, sql: str, params: List[Any]) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.sqlite_path) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute(sql, params) as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]

    async def _execute_sqlite(self, sql: str, params: List[Any]) -> Dict[str, Any]:
        async with aiosqlite.connect(self.sqlite_path) as conn:
            async with conn.execute(sql, params) as cursor:
                await conn.commit()
                return {
                    "success": True,
                    "rows_affected": cursor.rowcount,
                    "last_insert_rowid": cursor.lastrowid
                }

    async def _get_client(self) -> httpx.AsyncClient:
        return self.http_client or httpx.AsyncClient(timeout=15.0)

    async def _query_d1(self, sql: str, params: List[Any]) -> List[Dict[str, Any]]:
        if not (self.account_id and self.database_id and self.api_token):
            return await self._query_sqlite(sql, params)
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}/query"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        client = await self._get_client()
        try:
            resp = await client.post(url, headers=headers, json={"sql": sql, "params": params})
            data = resp.json()
            if not data.get("success"):
                raise RuntimeError(f"D1 Query Error: {data.get('errors')}")
            return data.get("result", [{}])[0].get("results", [])
        finally:
            if not self.http_client:
                await client.aclose()

    async def _execute_d1(self, sql: str, params: List[Any]) -> Dict[str, Any]:
        if not (self.account_id and self.database_id and self.api_token):
            return await self._execute_sqlite(sql, params)
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}/query"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        client = await self._get_client()
        try:
            resp = await client.post(url, headers=headers, json={"sql": sql, "params": params})
            data = resp.json()
            if not data.get("success"):
                raise RuntimeError(f"D1 Execute Error: {data.get('errors')}")
            meta = data.get("result", [{}])[0].get("meta", {})
            return {
                "success": True,
                "rows_affected": meta.get("changes", 0),
                "last_insert_rowid": meta.get("last_row_id")
            }
        finally:
            if not self.http_client:
                await client.aclose()
