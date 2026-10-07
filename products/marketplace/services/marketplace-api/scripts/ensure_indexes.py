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
    await db.users.create_index("role")

    # Products
    await db.products.create_index("category")
    await db.products.create_index([("title", "text"), ("description", "text")])
    await db.products.create_index("price")

    # Catalog: Storefront Listings
    await db.storefront_listings.create_index([("storefront_id", 1), ("is_active", 1), ("created_at", -1)])
    await db.storefront_listings.create_index([("id", 1), ("storefront_id", 1)], unique=True)
    await db.storefront_listings.create_index([("product_id", 1), ("seller_id", 1)])
    await db.storefront_listings.create_index("seller_id")
    await db.storefront_listings.create_index("category")

    # Catalog: Master Products
    await db.master_products.create_index("id", unique=True)
    await db.master_products.create_index("seller_id")

    # Catalog: Inventory Balances
    await db.inventory_balances.create_index("product_id", unique=True)
    await db.inventory_balances.create_index("seller_id")

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
