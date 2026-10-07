import os
import httpx
import aiosqlite
from typing import Any, Dict, List, Optional
import sys

# Support importing from backend-shared
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../backend-shared")))
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
        self.schema_path = schema_path or os.path.join(
            os.path.dirname(__file__), "../migrations/0001_initial_schema.sql"
        )

    async def init(self):
        """Initializes database schema and ensures all tables are created both locally and on D1."""
        # 1. Always ensure local SQLite database has full schema and initial seeds
        os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
        async with aiosqlite.connect(self.sqlite_path) as conn:
            cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations';")
            exists = await cursor.fetchone()
            if not exists and os.path.exists(self.schema_path):
                with open(self.schema_path, "r", encoding="utf-8") as f:
                    schema_sql = f.read()
                await conn.executescript(schema_sql)
                await conn.commit()
                logger.info("Initialized local SQLite database from schema: %s", self.sqlite_path)

            # Ensure supplementary tables exist in local SQLite
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                  key TEXT PRIMARY KEY,
                  org_id TEXT NOT NULL,
                  value TEXT,
                  description TEXT
                );
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS aggregator_orders (
                  id TEXT PRIMARY KEY,
                  org_id TEXT NOT NULL,
                  platform TEXT NOT NULL,
                  channel_color TEXT,
                  source TEXT,
                  customer_name TEXT,
                  customer_phone TEXT,
                  items_json TEXT NOT NULL,
                  subtotal REAL NOT NULL,
                  tax REAL NOT NULL,
                  total_amount REAL NOT NULL,
                  payment_status TEXT,
                  status TEXT NOT NULL DEFAULT 'NEW',
                  rider_json TEXT,
                  prep_time_mins INTEGER DEFAULT 20,
                  cancel_reason TEXT,
                  received_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS customers (
                  phone TEXT PRIMARY KEY,
                  org_id TEXT NOT NULL,
                  name TEXT NOT NULL,
                  email TEXT,
                  tier TEXT DEFAULT 'Silver',
                  loyalty_points INTEGER DEFAULT 0,
                  total_orders INTEGER DEFAULT 0,
                  total_spend REAL DEFAULT 0,
                  created_at TEXT NOT NULL,
                  last_visit TEXT
                );
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS pos_tables (
                  id TEXT PRIMARY KEY,
                  org_id TEXT NOT NULL,
                  number TEXT NOT NULL,
                  section TEXT NOT NULL,
                  capacity INTEGER NOT NULL DEFAULT 4,
                  status TEXT NOT NULL DEFAULT 'Vacant',
                  current_bill REAL DEFAULT 0.0,
                  waiter TEXT,
                  token TEXT,
                  items_count INTEGER DEFAULT 0,
                  seated_since TEXT,
                  updated_at TEXT NOT NULL
                );
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS cash_drawer_logs (
                  id TEXT PRIMARY KEY,
                  org_id TEXT NOT NULL,
                  timestamp TEXT NOT NULL,
                  type TEXT NOT NULL,
                  amount REAL NOT NULL,
                  reason TEXT,
                  cashier TEXT,
                  created_at TEXT NOT NULL
                );
            """)
            await conn.commit()

        # 2. If D1 is configured, verify and provision supplementary tables on D1
        if self.use_d1:
            try:
                logger.info("Verifying Cloudflare D1 database: %s", self.database_id)
                supp_tables = [
                    """CREATE TABLE IF NOT EXISTS settings (
                      key TEXT PRIMARY KEY, org_id TEXT NOT NULL, value TEXT, description TEXT
                    );""",
                    """CREATE TABLE IF NOT EXISTS aggregator_orders (
                      id TEXT PRIMARY KEY, org_id TEXT NOT NULL, platform TEXT NOT NULL,
                      channel_color TEXT, source TEXT, customer_name TEXT, customer_phone TEXT,
                      items_json TEXT NOT NULL, subtotal REAL NOT NULL, tax REAL NOT NULL,
                      total_amount REAL NOT NULL, payment_status TEXT, status TEXT NOT NULL DEFAULT 'NEW',
                      rider_json TEXT, prep_time_mins INTEGER DEFAULT 20, cancel_reason TEXT,
                      received_at TEXT NOT NULL, updated_at TEXT NOT NULL
                    );""",
                    """CREATE TABLE IF NOT EXISTS customers (
                      phone TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL,
                      email TEXT, tier TEXT DEFAULT 'Silver', loyalty_points INTEGER DEFAULT 0,
                      total_orders INTEGER DEFAULT 0, total_spend REAL DEFAULT 0,
                      created_at TEXT NOT NULL, last_visit TEXT
                    );""",
                    """CREATE TABLE IF NOT EXISTS pos_tables (
                      id TEXT PRIMARY KEY, org_id TEXT NOT NULL, number TEXT NOT NULL,
                      section TEXT NOT NULL, capacity INTEGER NOT NULL DEFAULT 4,
                      status TEXT NOT NULL DEFAULT 'Vacant', current_bill REAL DEFAULT 0.0,
                      waiter TEXT, token TEXT, items_count INTEGER DEFAULT 0,
                      seated_since TEXT, updated_at TEXT NOT NULL
                    );""",
                    """CREATE TABLE IF NOT EXISTS cash_drawer_logs (
                      id TEXT PRIMARY KEY, org_id TEXT NOT NULL, timestamp TEXT NOT NULL,
                      type TEXT NOT NULL, amount REAL NOT NULL, reason TEXT,
                      cashier TEXT, created_at TEXT NOT NULL
                    );"""
                ]
                for st in supp_tables:
                    await self._execute_d1(st, [])
                logger.info("Cloudflare D1 tables successfully verified.")
            except Exception as e:
                logger.warning("Cloudflare D1 initialization warning (will use SQLite fallback if needed): %s", e)

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
