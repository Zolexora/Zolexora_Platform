import asyncpg
from fastapi import Depends

from shared.database.postgres import pg_conn_dep
from .repository import PostgresMediaRepository
from .adapter import MediaStorageAdapter, DummyS3Adapter

async def get_media_repo(conn: asyncpg.Connection = Depends(pg_conn_dep)) -> PostgresMediaRepository:
    return PostgresMediaRepository(conn)

async def get_media_adapter() -> MediaStorageAdapter:
    return DummyS3Adapter()
