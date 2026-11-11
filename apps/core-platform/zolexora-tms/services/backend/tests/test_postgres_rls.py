import uuid
import pytest
from sqlalchemy import text
from app.db.session import AsyncSessionLocal


@pytest.mark.asyncio
async def test_postgres_engine_row_level_security():
    """
    Verifies that PostgreSQL Row-Level Security (RLS) is strictly enforced at the
    database engine level across multi-tenant tables.
    """
    org_a = uuid.uuid4()
    org_b = uuid.uuid4()

    async with AsyncSessionLocal() as session:
        # 1. Setup two organizations in bypass mode
        await session.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        await session.execute(
            text("INSERT INTO organisations (id, name, organisation_type, status, created_at, updated_at) "
                 "VALUES (:id, :name, 'Private Limited Company', 'ACTIVE', NOW(), NOW())"),
            {"id": org_a, "name": f"Org A {org_a.hex[:6]}"}
        )
        await session.execute(
            text("INSERT INTO organisations (id, name, organisation_type, status, created_at, updated_at) "
                 "VALUES (:id, :name, 'Private Limited Company', 'ACTIVE', NOW(), NOW())"),
            {"id": org_b, "name": f"Org B {org_b.hex[:6]}"}
        )

        # Insert vehicles for both orgs
        veh_a_id = uuid.uuid4()
        veh_b_id = uuid.uuid4()
        await session.execute(
            text("INSERT INTO vehicles (id, organisation_id, registration_number, vehicle_type, ownership_type, fuel_type, odometer_km, status, documents, created_at, updated_at) "
                 "VALUES (:id, :org_id, :reg, 'TRUCK', 'OWNED', 'DIESEL', 0.0, 'AVAILABLE', '{}', NOW(), NOW())"),
            {"id": veh_a_id, "org_id": org_a, "reg": f"DL-{org_a.hex[:4]}"}
        )
        await session.execute(
            text("INSERT INTO vehicles (id, organisation_id, registration_number, vehicle_type, ownership_type, fuel_type, odometer_km, status, documents, created_at, updated_at) "
                 "VALUES (:id, :org_id, :reg, 'TRUCK', 'OWNED', 'DIESEL', 0.0, 'AVAILABLE', '{}', NOW(), NOW())"),
            {"id": veh_b_id, "org_id": org_b, "reg": f"MH-{org_b.hex[:4]}"}
        )
        await session.commit()

    # 2. Test Tenant A Scope
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.current_organisation_id', :org_id, true)"), {"org_id": str(org_a)})
        result = await session.execute(text("SELECT id, organisation_id FROM vehicles"))
        rows = result.fetchall()
        
        # Must only see Org A's vehicle
        assert len(rows) == 1
        assert rows[0][0] == veh_a_id
        assert rows[0][1] == org_a

    # 3. Test Tenant B Scope
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.current_organisation_id', :org_id, true)"), {"org_id": str(org_b)})
        result = await session.execute(text("SELECT id, organisation_id FROM vehicles"))
        rows = result.fetchall()
        
        # Must only see Org B's vehicle
        assert len(rows) == 1
        assert rows[0][0] == veh_b_id
        assert rows[0][1] == org_b

    # 4. Test Unset Context (Deny-by-default)
    async with AsyncSessionLocal() as session:
        # No app.current_organisation_id set
        result = await session.execute(text("SELECT id FROM vehicles"))
        rows = result.fetchall()
        # Zero rows must be returned when no tenant context is set
        assert len(rows) == 0

    # 5. Test Cross-Tenant Tampering (WITH CHECK violation)
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.current_organisation_id', :org_id, true)"), {"org_id": str(org_a)})
        
        # Org A attempts to insert a record pretending to be Org B
        tamper_id = uuid.uuid4()
        with pytest.raises(Exception) as excinfo:
            await session.execute(
                text("INSERT INTO vehicles (id, organisation_id, registration_number, vehicle_type, ownership_type, fuel_type, odometer_km, status, documents, created_at, updated_at) "
                     "VALUES (:id, :org_id, 'HACK-01', 'TRUCK', 'OWNED', 'DIESEL', 0.0, 'AVAILABLE', '{}', NOW(), NOW())"),
                {"id": tamper_id, "org_id": org_b}
            )
            await session.flush()
        
        # PostgreSQL must reject with RLS check violation
        assert "violates row-level security policy" in str(excinfo.value).lower()

    # 6. Test Commander Bypass Mode
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        result = await session.execute(text(f"SELECT id FROM vehicles WHERE id IN ('{veh_a_id}', '{veh_b_id}')"))
        rows = result.fetchall()
        assert len(rows) == 2

    # Cleanup
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        await session.execute(text(f"DELETE FROM vehicles WHERE id IN ('{veh_a_id}', '{veh_b_id}')"))
        await session.execute(text(f"DELETE FROM organisations WHERE id IN ('{org_a}', '{org_b}')"))
        await session.commit()
