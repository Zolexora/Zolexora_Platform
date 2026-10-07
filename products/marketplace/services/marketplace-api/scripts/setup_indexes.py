"""
Run once: python scripts/setup_indexes.py
Creates all MongoDB Atlas indexes + TTL auto-purge to stay inside 500 MB.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ.get("DB_NAME","zolexora_db")]
    print(f"Connected → {db.name}\n")

    await db.users.create_index("email", unique=True)
    await db.users.create_index("id",    unique=True)
    print("✓ users")

    await db.products.create_index([("is_active",1),("category",1),("created_at",-1)])
    await db.products.create_index([("seller_id",1),("created_at",-1)])
    await db.products.create_index([("title","text"),("description","text")])
    print("✓ products")

    await db.orders.create_index([("buyer_id",1),("created_at",-1)])
    await db.orders.create_index([("seller_id",1),("created_at",-1)])
    await db.orders.create_index([("payment_status",1),("payment_method",1)])
    await db.orders.create_index("razorpay_order_id", sparse=True)
    print("✓ orders")

    await db.cart.create_index("user_id")
    await db.cart.create_index([("user_id",1),("product_id",1)], unique=True)
    print("✓ cart")

    await db.reels.create_index([("is_active",1),("created_at",-1)])
    await db.reels.create_index([("creator_id",1),("created_at",-1)])
    print("✓ reels")

    # TTL 90 days — keeps Atlas quota healthy
    await db.reel_views.create_index([("user_id",1),("reel_id",1),("created_at",-1)])
    await db.reel_views.create_index("created_at", expireAfterSeconds=7_776_000)
    print("✓ reel_views  (TTL 90d)")

    await db.coin_transactions.create_index([("user_id",1),("type",1),("created_at",-1)])
    print("✓ coin_transactions")

    # TTL — expired OTP docs auto-deleted
    await db.pending_registrations.create_index("expires_at", expireAfterSeconds=0)
    print("✓ pending_registrations  (TTL)")

    # TTL — used/expired reset tokens auto-deleted after 24h
    await db.password_resets.create_index("expires_at", expireAfterSeconds=86_400)
    print("✓ password_resets  (TTL 24h)")

    await db.discount_codes.create_index([("user_id",1),("is_used",1)])
    await db.discount_codes.create_index("code", unique=True)
    print("✓ discount_codes")

    client.close()
    print("\n✅ All indexes created!")

asyncio.run(main())
