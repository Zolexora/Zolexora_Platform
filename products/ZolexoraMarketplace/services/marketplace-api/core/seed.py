import logging

from core.config import settings

logger = logging.getLogger("zolexora.seed")

SAMPLE_PRODUCTS = [
    {"title":"Pro Wireless Headphones","description":"40-hour ANC headphones with premium Hi-Fi sound and fast charging.","price":4999,"original_price":7999,"discount_percent":38,"category":"Electronics","images":["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80"],"stock":50},
    {"title":"Ultra Running Shoes","description":"Carbon-fibre plate, adaptive cushioning. Built for serious runners.","price":3499,"original_price":5499,"discount_percent":36,"category":"Sports","images":["https://images.pexels.com/photos/4065509/pexels-photo-4065509.jpeg?w=800"],"stock":30},
    {"title":"Artisan Coffee Pack","description":"Single-origin Ethiopian & Colombian beans, roasted fresh.","price":699,"original_price":999,"discount_percent":30,"category":"Food","images":["https://images.unsplash.com/photo-1610478506025-8110cc8f1986?w=800&q=80"],"stock":100},
    {"title":"Smart Fitness Watch","description":"Heart rate, SpO2, sleep tracking. 7-day battery. 5ATM waterproof.","price":2999,"original_price":4999,"discount_percent":40,"category":"Electronics","images":["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80"],"stock":45},
    {"title":"Organic Skincare Set","description":"100% natural moisturiser, serum and toner. Dermatologist tested.","price":1299,"original_price":1999,"discount_percent":35,"category":"Beauty","images":["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&q=80"],"stock":60},
    {"title":"Minimalist Leather Wallet","description":"Slim Italian full-grain leather. 8 cards + RFID block.","price":899,"original_price":1499,"discount_percent":40,"category":"Fashion","images":["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80"],"stock":80},
    {"title":"Bamboo Desk Organiser","description":"Sustainable bamboo. Pen holder, tray, phone dock – all-in-one.","price":799,"original_price":1199,"discount_percent":33,"category":"Home & Living","images":["https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=800&q=80"],"stock":70},
    {"title":"Yoga Mat Pro","description":"6mm thick non-slip mat with alignment guides. Includes carry strap.","price":1499,"original_price":2499,"discount_percent":40,"category":"Sports","images":["https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80"],"stock":55},
]

SAMPLE_REELS = [
    {"title":"Morning Coffee Ritual","description":"Start your day with our artisan blend ☕","video_url":"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80","media_type":"image","content_type":"organic","sponsor_data":None},
    {"title":"Best Headphones 2025 – Unboxing","description":"First look at our new wireless collection 🎧","video_url":"https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80","media_type":"image","content_type":"organic","sponsor_data":None},
    {"title":"10km Trail Run Review","description":"Testing the carbon fibre sole on mountain terrain 🏃","video_url":"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80","media_type":"image","content_type":"organic","sponsor_data":None},
    {"title":"Skincare Routine That Works","description":"Clean skin in 4 steps with our organic set ✨","video_url":"https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80","media_type":"image","content_type":"sponsored","sponsor_data":{"cta_label":"Shop Now","cta_url":"https://zolexora.com","brand_name":"Zolexora Beauty"}},
]

async def seed_data(db) -> None:
    import uuid
    from datetime import datetime, timezone
    from shared.database.postgres import transaction
    from shared.database.postgres import is_pool_ready

    admin_profile = None
    admin_email = settings.DEFAULT_ADMIN_EMAIL.strip().lower()

    # ── Canonical PostgreSQL admin identity ───────────────────────────────────
    if not admin_email:
        logger.info("Default admin seed skipped: DEFAULT_ADMIN_EMAIL is not configured.")
    elif not is_pool_ready():
        logger.warning("Default admin seed skipped: Postgres pool is not ready.")
    else:
        try:
            async with transaction() as conn:
                admin_profile = await conn.fetchrow(
                    """INSERT INTO public.admins(email,full_name,role,permissions,is_active)
                       VALUES ($1,'Zolexora Admin','super_admin'::admin_role,'[\"*\"]'::jsonb,TRUE)
                       ON CONFLICT (email) DO UPDATE SET role='super_admin'::admin_role,
                       permissions='[\"*\"]'::jsonb,is_active=TRUE,updated_at=NOW()
                       RETURNING id,email,full_name""", admin_email,
                )
            admin_profile = dict(admin_profile)
            admin_profile["id"] = str(admin_profile["id"])
            logger.info("Default Firebase-backed admin directory record ensured")
        except Exception as exc:
            logger.error("Default admin seed failed: %s", type(exc).__name__)

    # ── Sample products & reels ────────────────────────────────────────────────
    if await db.products.count_documents({}) == 0:
        if not admin_profile:
            logger.info("Sample products/reels skipped: no Postgres admin profile available.")
            return
        now = datetime.now(timezone.utc).isoformat()

        for p in SAMPLE_PRODUCTS:
            await db.products.insert_one({
                "id": str(uuid.uuid4()), "seller_id": admin_profile["id"],
                "seller_name": "Zolexora Team", "is_active": True,
                "rating": 4.5, "reviews_count": 0, "created_at": now, **p,
            })

        for r in SAMPLE_REELS:
            await db.reels.insert_one({
                "id": str(uuid.uuid4()), "creator_id": admin_profile["id"],
                "creator_name": "Zolexora Team", "is_active": True,
                "views_count": 0, "likes_count": 0, "linked_product_id": None,
                "thumbnail_url": r["video_url"], "created_at": now,
                "title": r["title"], "description": r["description"],
                "video_url": r["video_url"], "media_type": r["media_type"],
                "content_type": r["content_type"], "sponsor_data": r["sponsor_data"],
            })

        logger.info("Sample data seeded (%d products, %d reels)", len(SAMPLE_PRODUCTS), len(SAMPLE_REELS))
