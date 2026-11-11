"""IMS database: Cloudflare D1 over its HTTP API.

D1 is the only production store. LOCAL_SQLITE_PATH selects a local SQLite file instead (tests and
offline development); it is never a fallback: a D1 error is an error.
"""
import logging
import os
from typing import Any, Dict, List, Optional

import aiosqlite
import httpx

logger = logging.getLogger("zolexora.ims.db")

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")
LEGACY_CHECK = "SELECT name FROM sqlite_master WHERE type='table' AND name='organizations';"
LEGACY_HINT = (
    "Old IMS demo schema found. Run products/zolexora-ims/database/one-time-reset-demo-schema.sql once"
)


class DatabaseError(RuntimeError):
    pass


class D1Adapter:
    def __init__(
        self,
        account_id: Optional[str] = None,
        database_id: Optional[str] = None,
        api_token: Optional[str] = None,
        sqlite_path: Optional[str] = None,
    ):
        self.account_id = account_id if account_id is not None else os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.database_id = database_id if database_id is not None else os.getenv("CLOUDFLARE_D1_DATABASE_ID")
        self.api_token = api_token if api_token is not None else os.getenv("CLOUDFLARE_API_TOKEN")
        self.sqlite_path = sqlite_path if sqlite_path is not None else os.getenv("LOCAL_SQLITE_PATH")

    @property
    def mode(self) -> str:
        if self.sqlite_path:
            return "sqlite"
        if self.account_id and self.database_id and self.api_token:
            return "d1"
        raise DatabaseError(
            "Database not configured: set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and "
            "CLOUDFLARE_API_TOKEN (Infisical), or LOCAL_SQLITE_PATH for local development."
        )

    async def init(self) -> None:
        """Creates the business-scoped tables (idempotent). Refuses to run on the old demo schema."""
        where = f"local SQLite {self.sqlite_path}" if self.mode == "sqlite" else f"D1 database {self.database_id}"
        if self.mode == "sqlite":
            os.makedirs(os.path.dirname(os.path.abspath(self.sqlite_path)), exist_ok=True)
        if await self.query(LEGACY_CHECK):
            raise DatabaseError(f"{LEGACY_HINT} on {where}.")
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            sql = "\n".join(line for line in f.read().splitlines() if not line.lstrip().startswith("--"))
        for statement in (s.strip() for s in sql.split(";")):
            if statement:
                await self.execute(statement + ";")
        # Columns added after the business-scoped schema first shipped.
        try:
            await self.execute("ALTER TABLE selling_point_sales ADD COLUMN payment_id TEXT;")
        except Exception as e:
            if "duplicate column" not in str(e):
                raise
        logger.info("IMS schema ready on %s", where)

    async def query(self, sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        params = params or []
        if self.mode == "sqlite":
            async with aiosqlite.connect(self.sqlite_path) as conn:
                conn.row_factory = aiosqlite.Row
                async with conn.execute(sql, params) as cursor:
                    return [dict(r) for r in await cursor.fetchall()]
        return (await self._d1(sql, params)).get("results", [])

    async def fetch_one(self, sql: str, params: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        rows = await self.query(sql, params)
        return rows[0] if rows else None

    async def execute(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        params = params or []
        if self.mode == "sqlite":
            async with aiosqlite.connect(self.sqlite_path) as conn:
                async with conn.execute(sql, params) as cursor:
                    await conn.commit()
                    return {"success": True, "rows_affected": cursor.rowcount, "last_insert_rowid": cursor.lastrowid}
        meta = (await self._d1(sql, params)).get("meta", {})
        return {"success": True, "rows_affected": meta.get("changes", 0), "last_insert_rowid": meta.get("last_row_id")}

    async def _d1(self, sql: str, params: List[Any]) -> Dict[str, Any]:
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}/query"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers={"Authorization": f"Bearer {self.api_token}"}, json={"sql": sql, "params": params})
            data = res.json()
        except (httpx.HTTPError, ValueError) as e:
            raise DatabaseError(f"D1 request failed: {e}") from e
        if not data.get("success"):
            raise DatabaseError(f"D1 error: {data.get('errors')}")
        return (data.get("result") or [{}])[0]
