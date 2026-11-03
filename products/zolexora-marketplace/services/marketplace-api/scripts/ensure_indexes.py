import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from core.database import get_db, close_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zolexora.indexes")

async def ensure_indexes(db: AsyncIOMotorDatabase):
    logger.info("Ensuring MongoDB indexes...")

    # Users
    await db.users.create_index("email", unique=True)

    # The catalog lives in PostgreSQL (catalog.store).

    # Reels
    await db.reels.create_index("created_at")

    # Orders
    await db.orders.create_index("user_id")
    await db.orders.create_index("status")

    logger.info("Indexes created successfully.")

if __name__ == "__main__":
    async def main():
        db = get_db()
        await ensure_indexes(db)
        close_db()

    asyncio.run(main())
