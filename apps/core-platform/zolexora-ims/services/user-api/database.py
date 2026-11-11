"""IMS database: one SQLite file at DATABASE_PATH.

Not tied to any host: the API image sets DATABASE_PATH=/data/ims.db, so any platform that mounts a
persistent disk at /data keeps the data. Run one API instance per file (SQLite has a single writer).
"""
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict, List, Optional

import aiosqlite

logger = logging.getLogger("zolexora.ims.db")

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


class DatabaseError(RuntimeError):
    pass


class _Conn:
    """query / fetch_one / execute on one open connection."""

    def __init__(self, conn: aiosqlite.Connection):
        self.conn = conn

    async def query(self, sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        async with self.conn.execute(sql, params or []) as cursor:
            return [dict(r) for r in await cursor.fetchall()]

    async def fetch_one(self, sql: str, params: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        rows = await self.query(sql, params)
        return rows[0] if rows else None

    async def execute(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        async with self.conn.execute(sql, params or []) as cursor:
            return {"success": True, "rows_affected": cursor.rowcount, "last_insert_rowid": cursor.lastrowid}


class Database:
    def __init__(self, path: Optional[str] = None):
        self._path = path

    @property
    def path(self) -> str:
        path = self._path if self._path is not None else os.getenv("DATABASE_PATH")
        if not path:
            raise DatabaseError("DATABASE_PATH is not set (the API image sets /data/ims.db; mount a disk there).")
        return path

    @asynccontextmanager
    async def _connect(self) -> AsyncIterator[aiosqlite.Connection]:
        async with aiosqlite.connect(self.path, timeout=10) as conn:
            conn.row_factory = aiosqlite.Row
            await conn.execute("PRAGMA busy_timeout = 10000;")
            yield conn

    async def init(self) -> None:
        """Creates the business-scoped tables (idempotent) and turns on WAL for concurrent reads."""
        os.makedirs(os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            schema = f.read()
        async with self._connect() as conn:
            await conn.execute("PRAGMA journal_mode = WAL;")
            await conn.executescript(schema)
            try:  # column added after the business-scoped schema first shipped
                await conn.execute("ALTER TABLE selling_point_sales ADD COLUMN payment_id TEXT;")
            except aiosqlite.OperationalError as e:
                if "duplicate column" not in str(e):
                    raise
            await conn.commit()
        logger.info("IMS database ready at %s", self.path)

    async def query(self, sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        async with self._connect() as conn:
            return await _Conn(conn).query(sql, params)

    async def fetch_one(self, sql: str, params: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        rows = await self.query(sql, params)
        return rows[0] if rows else None

    async def execute(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        async with self._connect() as conn:
            result = await _Conn(conn).execute(sql, params)
            await conn.commit()
            return result

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[_Conn]:
        """All statements inside commit together, or none do (an exception rolls back)."""
        async with self._connect() as conn:
            await conn.execute("BEGIN IMMEDIATE;")
            try:
                yield _Conn(conn)
            except BaseException:
                await conn.rollback()
                raise
            await conn.commit()
