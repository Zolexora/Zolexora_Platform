import uuid
from typing import Any
import asyncpg
from datetime import datetime, timezone

class PostgresMediaRepository:
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn

    async def create_asset(
        self,
        org_id: uuid.UUID,
        filename: str,
        content_type: str,
        size_bytes: int,
        storage_key: str,
    ) -> dict[str, Any]:
        query = """
            INSERT INTO media_asset (id, organization_id, filename, content_type, size_bytes, storage_key, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
            RETURNING *
        """
        asset_id = uuid.uuid4()
        row = await self.conn.fetchrow(query, asset_id, org_id, filename, content_type, size_bytes, storage_key)
        return dict(row)

    async def get_asset(self, asset_id: uuid.UUID) -> dict[str, Any] | None:
        query = "SELECT * FROM media_asset WHERE id = $1"
        row = await self.conn.fetchrow(query, asset_id)
        return dict(row) if row else None

    async def update_asset_status(self, asset_id: uuid.UUID, status: str) -> dict[str, Any]:
        query = """
            UPDATE media_asset
            SET status = $2, updated_at = $3
            WHERE id = $1
            RETURNING *
        """
        row = await self.conn.fetchrow(query, asset_id, status, datetime.now(timezone.utc))
        if not row:
            raise ValueError("Media asset not found")
        return dict(row)
