import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest

from inventory.schemas import AdjustInventoryRequest, ReserveInventoryRequest
from inventory.service import InventoryService

# Test variables
VARIANT_ID = uuid.uuid4()
ORG_ID = uuid.uuid4()

@pytest.fixture
async def inventory_service(db_connection):
    # Setup some basic dependencies: product_variant and seller_organization
    # Actually wait, the database schema has foreign keys to product_variant and seller_organization.
    # We must insert those first.
    
    # We need a seller_organization
    await db_connection.execute(
        """
        INSERT INTO seller_organization (id, name, slug)
        VALUES ($1, 'Test Org', 'test-org')
        ON CONFLICT DO NOTHING
        """,
        ORG_ID
    )
    
    product_id = uuid.uuid4()
    await db_connection.execute(
        """
        INSERT INTO master_product (id, organization_id, slug, name)
        VALUES ($1, $2, 'test-product', 'Test Product')
        ON CONFLICT DO NOTHING
        """,
        product_id, ORG_ID
    )
    
    await db_connection.execute(
        """
        INSERT INTO product_variant (id, product_id, sku)
        VALUES ($1, $2, 'TEST-SKU-1')
        ON CONFLICT DO NOTHING
        """,
        VARIANT_ID, product_id
    )

    yield InventoryService(db_connection)

@pytest.mark.asyncio
async def test_adjust_inventory_success(inventory_service: InventoryService):
    ref_id = str(uuid.uuid4())
    req = AdjustInventoryRequest(amount=10, reason="Initial stock", reference_id=ref_id)
    
    ledger = await inventory_service.adjust_inventory(VARIANT_ID, ORG_ID, req)
    
    assert ledger.on_hand_quantity == 10
    assert ledger.reserved_quantity == 0
    assert ledger.status == 'ACTIVE'

@pytest.mark.asyncio
async def test_adjust_inventory_idempotency(inventory_service: InventoryService):
    ref_id = str(uuid.uuid4())
    req = AdjustInventoryRequest(amount=5, reason="Stock", reference_id=ref_id)
    
    # First call
    ledger1 = await inventory_service.adjust_inventory(VARIANT_ID, ORG_ID, req)
    
    # Second call with same reference_id
    ledger2 = await inventory_service.adjust_inventory(VARIANT_ID, ORG_ID, req)
    
    # Should not increase on_hand_quantity by another 5
    assert ledger1.on_hand_quantity == ledger2.on_hand_quantity

@pytest.mark.asyncio
async def test_reserve_inventory_and_consume(inventory_service: InventoryService):
    # Setup stock
    await inventory_service.adjust_inventory(
        VARIANT_ID, ORG_ID, AdjustInventoryRequest(amount=20, reason="Restock", reference_id=str(uuid.uuid4()))
    )
    
    # Reserve
    req = ReserveInventoryRequest(
        quantity=5,
        expires_at=datetime.now(ZoneInfo("UTC")) + timedelta(hours=1),
        reference_id=str(uuid.uuid4())
    )
    reservation = await inventory_service.reserve_inventory(VARIANT_ID, ORG_ID, req)
    
    assert reservation.quantity == 5
    assert reservation.status == 'ACTIVE'
    
    ledger = await inventory_service.get_ledger(VARIANT_ID, ORG_ID)
    assert ledger.reserved_quantity == 5
    
    # Consume
    ledger_after = await inventory_service.consume_reservation(reservation.id, 5)
    
    # It was 20 on hand, 5 reserved. Now 15 on hand, 0 reserved.
    # Wait, the total on hand might be accumulated from previous tests if db is shared.
    # In db_connection fixture, there's a rollback so it's isolated.
    assert ledger_after.on_hand_quantity == 15
    assert ledger_after.reserved_quantity == 0

@pytest.mark.asyncio
async def test_reserve_inventory_overselling(inventory_service: InventoryService):
    # Attempt to reserve more than available
    req = ReserveInventoryRequest(
        quantity=100,
        expires_at=datetime.now(ZoneInfo("UTC")) + timedelta(hours=1),
        reference_id=str(uuid.uuid4())
    )
    
    with pytest.raises(ValueError):
        await inventory_service.reserve_inventory(VARIANT_ID, ORG_ID, req)

@pytest.mark.asyncio
async def test_release_expired_reservations(inventory_service: InventoryService):
    # Restock
    await inventory_service.adjust_inventory(
        VARIANT_ID, ORG_ID, AdjustInventoryRequest(amount=10, reason="Stock", reference_id=str(uuid.uuid4()))
    )
    
    # Reserve with past expiry
    req = ReserveInventoryRequest(
        quantity=3,
        expires_at=datetime.now(ZoneInfo("UTC")) - timedelta(hours=1),
        reference_id=str(uuid.uuid4())
    )
    await inventory_service.reserve_inventory(VARIANT_ID, ORG_ID, req)
    
    ledger_before = await inventory_service.get_ledger(VARIANT_ID, ORG_ID)
    assert ledger_before.reserved_quantity == 3
    
    # Release
    count = await inventory_service.release_expired_reservations()
    assert count == 1
    
    ledger_after = await inventory_service.get_ledger(VARIANT_ID, ORG_ID)
    assert ledger_after.reserved_quantity == 0
