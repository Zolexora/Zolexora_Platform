import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger("zolexora.db")
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def get_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        from core.config import settings
        _client = AsyncIOMotorClient(
            settings.MONGO_URL,
            serverSelectionTimeoutMS=10000,
            maxPoolSize=20,
            minPoolSize=2,
        )
        _db = _client[settings.DB_NAME]
        logger.info("MongoDB Atlas connected → %s", settings.DB_NAME)
    return _db


def close_db() -> None:
    global _client, _db
    if _client:
        _client.close()
        logger.info("MongoDB Atlas disconnected")
    _client = _db = None
