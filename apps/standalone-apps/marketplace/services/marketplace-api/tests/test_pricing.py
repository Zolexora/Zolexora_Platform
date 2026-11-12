import uuid
import pytest
from datetime import datetime, timedelta, timezone
from pricing.repository import PostgresPricingRepository
from pricing.service import PricingService, CurrencyMismatchError

@pytest.fixture
async def seeded_data(db_connection):
    org_id = uuid.uuid4()
    storefront_id = uuid.uuid4()
    variant_id = uuid.uuid4()
    price_book_id = uuid.uuid4()

    await db_connection.execute(
        "INSERT INTO seller_organization (id, name, slug) VALUES ($1, 'Test Org', 'test-org')",
        org_id
    )

    await db_connection.execute(
        "INSERT INTO storefront (id, storefront_key, display_name, currency, locale) VALUES ($1, 'test-store', 'Test Store', 'USD', 'en-US')",
        storefront_id
    )

    # Master product & variant
    product_id = uuid.uuid4()
    await db_connection.execute(
        "INSERT INTO master_product (id, organization_id, slug, name, description) VALUES ($1, $2, 'test-product', 'Test Product', 'Desc')",
        product_id, org_id
    )
    await db_connection.execute(
        "INSERT INTO product_variant (id, product_id, sku) VALUES ($1, $2, 'SKU-1')",
        variant_id, product_id
    )

    await db_connection.execute(
        "INSERT INTO price_book (id, organization_id, storefront_id, name, currency, is_active) VALUES ($1, $2, $3, 'Main', 'USD', true)",
        price_book_id, org_id, storefront_id
    )

    return {
        "org_id": org_id,
        "storefront_id": storefront_id,
        "variant_id": variant_id,
        "price_book_id": price_book_id,
    }

async def test_price_effective_periods(db_connection, seeded_data):
    repo = PostgresPricingRepository(db_connection)
    service = PricingService(repo)

    data = seeded_data
    storefront_id = data["storefront_id"]
    variant_id = data["variant_id"]
    price_book_id = data["price_book_id"]

    now = datetime.now(timezone.utc)
    past = now - timedelta(days=10)
    future = now + timedelta(days=10)

    # Add expired price
    await db_connection.execute(
        "INSERT INTO price_record (id, price_book_id, variant_id, amount, effective_from, effective_until) VALUES ($1, $2, $3, $4, $5, $6)",
        uuid.uuid4(), price_book_id, variant_id, 1000, past - timedelta(days=5), past
    )

    # Add active price
    active_id = uuid.uuid4()
    await db_connection.execute(
        "INSERT INTO price_record (id, price_book_id, variant_id, amount, effective_from, effective_until) VALUES ($1, $2, $3, $4, $5, $6)",
        active_id, price_book_id, variant_id, 1500, past, future
    )

    snapshot = await service.get_snapshot_for_variant(storefront_id=storefront_id, variant_id=variant_id)
    assert snapshot.amount == 1500
    assert snapshot.currency == "USD"
    assert snapshot.price_book_id == price_book_id

async def test_currency_rejection(db_connection, seeded_data):
    repo = PostgresPricingRepository(db_connection)
    service = PricingService(repo)

    data = seeded_data
    storefront_id = data["storefront_id"]
    variant_id = data["variant_id"]
    price_book_id = data["price_book_id"]
    
    now = datetime.now(timezone.utc)
    
    await db_connection.execute(
        "INSERT INTO price_record (id, price_book_id, variant_id, amount, effective_from) VALUES ($1, $2, $3, $4, $5)",
        uuid.uuid4(), price_book_id, variant_id, 1500, now - timedelta(days=1)
    )
    
    with pytest.raises(CurrencyMismatchError):
        await service.get_snapshot_for_variant(
            storefront_id=storefront_id,
            variant_id=variant_id,
            expected_currency="EUR"
        )

async def test_ignored_client_totals(db_connection, seeded_data):
    # Proves the service always returns the exact DB price and ignores user input
    repo = PostgresPricingRepository(db_connection)
    service = PricingService(repo)

    data = seeded_data
    storefront_id = data["storefront_id"]
    variant_id = data["variant_id"]
    price_book_id = data["price_book_id"]
    
    now = datetime.now(timezone.utc)
    
    await db_connection.execute(
        "INSERT INTO price_record (id, price_book_id, variant_id, amount, effective_from) VALUES ($1, $2, $3, $4, $5)",
        uuid.uuid4(), price_book_id, variant_id, 1500, now - timedelta(days=1)
    )
    
    snapshot = await service.get_snapshot_for_variant(
        storefront_id=storefront_id,
        variant_id=variant_id,
    )
    
    # We never pass client totals into `get_snapshot_for_variant`, so client totals are fundamentally ignored by design.
    assert snapshot.amount == 1500

async def test_storefront_isolation(db_connection, seeded_data):
    repo = PostgresPricingRepository(db_connection)
    service = PricingService(repo)

    data = seeded_data
    storefront_id = data["storefront_id"]
    variant_id = data["variant_id"]
    price_book_id = data["price_book_id"]
    org_id = data["org_id"]
    
    other_storefront_id = uuid.uuid4()
    await db_connection.execute(
        "INSERT INTO storefront (id, storefront_key, display_name, currency, locale) VALUES ($1, 'other-store', 'Other Store', 'EUR', 'en-US')",
        other_storefront_id
    )

    other_price_book_id = uuid.uuid4()
    await db_connection.execute(
        "INSERT INTO price_book (id, organization_id, storefront_id, name, currency, is_active) VALUES ($1, $2, $3, 'Other', 'EUR', true)",
        other_price_book_id, org_id, other_storefront_id
    )

    now = datetime.now(timezone.utc)
    
    await db_connection.execute(
        "INSERT INTO price_record (id, price_book_id, variant_id, amount, effective_from) VALUES ($1, $2, $3, $4, $5)",
        uuid.uuid4(), price_book_id, variant_id, 1500, now - timedelta(days=1)
    )

    await db_connection.execute(
        "INSERT INTO price_record (id, price_book_id, variant_id, amount, effective_from) VALUES ($1, $2, $3, $4, $5)",
        uuid.uuid4(), other_price_book_id, variant_id, 2000, now - timedelta(days=1)
    )
    
    # Get for first storefront
    snapshot1 = await service.get_snapshot_for_variant(
        storefront_id=storefront_id,
        variant_id=variant_id,
    )
    assert snapshot1.amount == 1500
    
    # Get for other storefront
    snapshot2 = await service.get_snapshot_for_variant(
        storefront_id=other_storefront_id,
        variant_id=variant_id,
    )
    assert snapshot2.amount == 2000
