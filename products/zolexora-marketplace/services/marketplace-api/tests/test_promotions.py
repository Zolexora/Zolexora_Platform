import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import asyncpg
import pytest

from promotions.service import PromotionService
from promotions.repository import PromotionRepository

TEST_URL = "postgresql://marketplace_local:marketplace-local-only@127.0.0.1:5432/marketplace_local"

@pytest.fixture
async def pg_conn():
    conn = await asyncpg.connect(TEST_URL)
    rev = await conn.fetchval("SELECT version_num FROM alembic_version")
    if rev != "0010_erp_outbox_inbox":
        raise ValueError("Database not at head revision")
    
    transaction = conn.transaction()
    await transaction.start()
    try:
        yield conn
    finally:
        await transaction.rollback()
        await conn.close()

@pytest.fixture
async def pg_pool():
    pool = await asyncpg.create_pool(TEST_URL, min_size=5, max_size=10)
    try:
        yield pool
    finally:
        await pool.close()

@pytest.mark.asyncio
async def test_promotion_eligibility_and_cross_store_rejection(pg_conn):
    service = PromotionService(pg_conn)
    
    org_id = uuid.uuid4()
    await pg_conn.execute(
        "INSERT INTO seller_organization (id, name, slug) VALUES ($1, 'Test Org', $2)",
        org_id, str(uuid.uuid4())
    )
    
    storefront_id_1 = uuid.uuid4()
    await pg_conn.execute(
        "INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale) VALUES ($1, 'store1', 'Store 1', true, 'USD', 'en-US')",
        storefront_id_1
    )
    
    storefront_id_2 = uuid.uuid4()
    await pg_conn.execute(
        "INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale) VALUES ($1, 'store2', 'Store 2', true, 'USD', 'en-US')",
        storefront_id_2
    )
    
    # Create promo for store 1
    promo_id = uuid.uuid4()
    await pg_conn.execute(
        """
        INSERT INTO promotion (id, organization_id, storefront_id, code, type, value, minimum_order_value, effective_from, budget_used, usage_count)
        VALUES ($1, $2, $3, 'SAVE10', 'FIXED', 1000, 5000, $4, 0, 0)
        """,
        promo_id, org_id, storefront_id_1, datetime.now(timezone.utc) - timedelta(days=1)
    )
    
    user_id = uuid.uuid4()
    await pg_conn.execute(
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'hash')",
        user_id, str(uuid.uuid4())
    )
    
    # Test valid application
    result = await service.apply_promotion('SAVE10', storefront_id_1, 6000, user_id, 'order-1')
    assert result['discount_amount'] == 1000
    
    # Test cross-store rejection
    with pytest.raises(ValueError, match="Promotion not found for this storefront"):
        await service.apply_promotion('SAVE10', storefront_id_2, 6000, user_id, 'order-2')
        
    # Test min order value
    with pytest.raises(ValueError, match="Order subtotal does not meet the minimum requirement"):
        await service.apply_promotion('SAVE10', storefront_id_1, 4000, user_id, 'order-3')


@pytest.mark.asyncio
async def test_promotion_concurrency_and_budget_exhaustion(pg_pool):
    # Setup test data with a single connection
    async with pg_pool.acquire() as conn:
        org_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO seller_organization (id, name, slug) VALUES ($1, 'Test Org 2', $2)",
            org_id, str(uuid.uuid4())
        )
        
        storefront_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale) VALUES ($1, 'store3', 'Store 3', true, 'USD', 'en-US')",
            storefront_id
        )
        
        # Create promo with budget limit of 2500
        promo_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO promotion (id, organization_id, storefront_id, code, type, value, budget_limit, effective_from, budget_used, usage_count)
            VALUES ($1, $2, $3, 'LIMIT30', 'FIXED', 1000, 2500, $4, 0, 0)
            """,
            promo_id, org_id, storefront_id, datetime.now(timezone.utc) - timedelta(days=1)
        )
        
        # Create users
        user_ids = []
        for i in range(5):
            uid = uuid.uuid4()
            await conn.execute(
                "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'hash')",
                uid, f'user{i}-{uuid.uuid4()}@test.com'
            )
            user_ids.append(uid)
            
    # Attempt 5 concurrent applications using different connections
    async def apply_promo(uid, idx):
        async with pg_pool.acquire() as conn:
            service = PromotionService(conn)
            try:
                return await service.apply_promotion('LIMIT30', storefront_id, 2000, uid, f'order-{idx}-{uuid.uuid4()}')
            except Exception as e:
                return e

    results = await asyncio.gather(*(apply_promo(uid, i) for i, uid in enumerate(user_ids)))
    
    # Check results
    successes = [r for r in results if isinstance(r, dict)]
    errors = [r for r in results if isinstance(r, Exception)]
    
    # 3 should succeed (1000 + 1000 + 500 = 2500)
    assert len(successes) == 3
    assert len(errors) == 2
    
    total_discount = sum(r['discount_amount'] for r in successes)
    assert total_discount == 2500
    
    async with pg_pool.acquire() as conn:
        repo = PromotionRepository(conn)
        db_promo = await repo.get_promotion_by_code('LIMIT30', storefront_id)
        assert db_promo['budget_used'] == 2500
        assert db_promo['usage_count'] == 3
        
        # Clean up
        await conn.execute("DELETE FROM promotion_usage WHERE promotion_id = $1", promo_id)
        await conn.execute("DELETE FROM promotion WHERE id = $1", promo_id)
        await conn.execute("DELETE FROM users WHERE id = ANY($1)", user_ids)
        await conn.execute("DELETE FROM storefront WHERE id = $1", storefront_id)
        await conn.execute("DELETE FROM seller_organization WHERE id = $1", org_id)
