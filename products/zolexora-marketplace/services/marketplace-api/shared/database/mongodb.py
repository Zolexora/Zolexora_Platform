"""
shared/database/mongodb.py
───────────────────────────
Motor (async MongoDB) client pool for Zolexora.

This is the canonical MongoDB initialisation point for the new modular
architecture.  The legacy `core/database.py` remains in place for the
existing routers that have not yet been migrated.

Collections owned by this store:
  products          – e-commerce catalog & variants
  reels             – video content feed & metadata
  reel_views        – daily view logs (TTL-indexed, high write volume)
  coin_transactions – user coin earn/spend ledger

All other persistent data lives in Supabase PostgreSQL.
"""

import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from core.config import settings

logger = logging.getLogger("zolexora.mongodb")

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


# ── Lifecycle ─────────────────────────────────────────────────────────────────

def init_mongo() -> AsyncIOMotorDatabase:
    """Initialise the Motor client and return the database handle.

    Idempotent – safe to call multiple times.
    """
    global _client, _db
    if _db is not None:
        return _db

    if not settings.MONGO_URL:
        raise RuntimeError("MONGO_URL environment variable is not set.")

    _client = AsyncIOMotorClient(
        settings.MONGO_URL,
        serverSelectionTimeoutMS=5_000,
        maxPoolSize=20,
        minPoolSize=2,
    )
    _db = _client[settings.DB_NAME]
    logger.info("MongoDB Atlas connected → %s", settings.DB_NAME)
    return _db


def close_mongo() -> None:
    """Close the Motor client.  Call inside the FastAPI `lifespan` shutdown."""
    global _client, _db
    if _client:
        _client.close()
        logger.info("MongoDB Atlas disconnected")
    _client = _db = None


def get_mongo() -> AsyncIOMotorDatabase:
    """Return the active database handle.

    Raises `RuntimeError` if `init_mongo` has not been called first.
    """
    if _db is None:
        raise RuntimeError(
            "MongoDB is not initialised.  "
            "Call init_mongo() inside the FastAPI lifespan startup handler."
        )
    return _db


# ── FastAPI dependency ────────────────────────────────────────────────────────

async def mongo_dep() -> AsyncIOMotorDatabase:
    """FastAPI dependency that yields the shared Motor database."""
    return get_mongo()
