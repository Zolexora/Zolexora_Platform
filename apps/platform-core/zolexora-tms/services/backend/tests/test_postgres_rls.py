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


@pytest.mark.asyncio
async def test_shift_rosters_rls_isolation():
    """shift_rosters rows must be invisible across tenants (migration o10000000011)."""
    org_a = uuid.uuid4()
    org_b = uuid.uuid4()

    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        for org_id, name in [(org_a, f"RLS-A-{org_a.hex[:6]}"), (org_b, f"RLS-B-{org_b.hex[:6]}")]:
            await s.execute(
                text("INSERT INTO organisations (id, name, organisation_type, status, created_at, updated_at) "
                     "VALUES (:id, :name, 'Private Limited Company', 'ACTIVE', NOW(), NOW())"),
                {"id": org_id, "name": name},
            )
        # Insert a client per org (required FK for shift_rosters.customer_id)
        client_a = uuid.uuid4()
        client_b = uuid.uuid4()
        for cid, oid in [(client_a, org_a), (client_b, org_b)]:
            await s.execute(
                text("INSERT INTO clients (id, organisation_id, name, payment_terms_days, credit_limit, status, created_at, updated_at) "
                     "VALUES (:id, :org, :name, 30, 0, 'ACTIVE', NOW(), NOW())"),
                {"id": cid, "org": oid, "name": f"Client-{cid.hex[:6]}"},
            )
        # Insert one roster per org
        roster_a = uuid.uuid4()
        roster_b = uuid.uuid4()
        for rid, oid, cid in [(roster_a, org_a, client_a), (roster_b, org_b, client_b)]:
            await s.execute(
                text("INSERT INTO shift_rosters "
                     "(id, organisation_id, customer_id, route_code, route_name, booking_type, shift_label, shift_time, duration_minutes, weekdays, pickup_address, drop_address, stops, escort_required, active, created_at, updated_at) "
                     "VALUES (:id, :org, :cid, :rc, :rn, 'ETS', 'Morning', '08:00', 120, '[1,2,3,4,5]', 'HQ', 'Office', '[]', false, true, NOW(), NOW())"),
                {"id": rid, "org": oid, "cid": cid, "rc": f"R-{rid.hex[:4]}", "rn": f"Route-{rid.hex[:4]}"},
            )
        await s.commit()

    # Org A must only see its own roster
    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
        await s.execute(text("SELECT set_config('app.current_organisation_id', :o, true)"), {"o": str(org_a)})
        rows = (await s.execute(text(f"SELECT id FROM shift_rosters WHERE id IN ('{roster_a}', '{roster_b}')"))).fetchall()
        assert len(rows) == 1 and rows[0][0] == roster_a

    # Org B must only see its own roster
    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
        await s.execute(text("SELECT set_config('app.current_organisation_id', :o, true)"), {"o": str(org_b)})
        rows = (await s.execute(text(f"SELECT id FROM shift_rosters WHERE id IN ('{roster_a}', '{roster_b}')"))).fetchall()
        assert len(rows) == 1 and rows[0][0] == roster_b

    # Deny-by-default: no context → empty
    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
        rows = (await s.execute(text(f"SELECT id FROM shift_rosters WHERE id IN ('{roster_a}', '{roster_b}')"))).fetchall()
        assert len(rows) == 0

    # Cleanup
    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        await s.execute(text(f"DELETE FROM shift_rosters WHERE id IN ('{roster_a}', '{roster_b}')"))
        await s.execute(text(f"DELETE FROM clients WHERE id IN ('{client_a}', '{client_b}')"))
        await s.execute(text(f"DELETE FROM organisations WHERE id IN ('{org_a}', '{org_b}')"))
        await s.commit()


@pytest.mark.asyncio
async def test_fastag_transactions_rls_isolation():
    """fastag_transactions rows must be invisible across tenants (migration o10000000011)."""
    org_a = uuid.uuid4()
    org_b = uuid.uuid4()

    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        for org_id, name in [(org_a, f"FT-A-{org_a.hex[:6]}"), (org_b, f"FT-B-{org_b.hex[:6]}")]:
            await s.execute(
                text("INSERT INTO organisations (id, name, organisation_type, status, created_at, updated_at) "
                     "VALUES (:id, :name, 'Private Limited Company', 'ACTIVE', NOW(), NOW())"),
                {"id": org_id, "name": name},
            )
        # Insert one FASTag transaction per org (vehicle_id & trip_id are nullable)
        ft_a = uuid.uuid4()
        ft_b = uuid.uuid4()
        for fid, oid in [(ft_a, org_a), (ft_b, org_b)]:
            await s.execute(
                text("INSERT INTO fastag_transactions "
                     "(id, organisation_id, transaction_ref, plaza_name, amount, transacted_at, raw_payload) "
                     "VALUES (:id, :org, :ref, 'RLS Test Plaza', 60.0, NOW(), '{}')"),
                {"id": fid, "org": oid, "ref": f"RLS-TXN-{fid.hex[:8]}"},
            )
        await s.commit()

    # Org A sees only its own
    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
        await s.execute(text("SELECT set_config('app.current_organisation_id', :o, true)"), {"o": str(org_a)})
        rows = (await s.execute(text(f"SELECT id FROM fastag_transactions WHERE id IN ('{ft_a}', '{ft_b}')"))).fetchall()
        assert len(rows) == 1 and rows[0][0] == ft_a

    # Org B sees only its own
    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
        await s.execute(text("SELECT set_config('app.current_organisation_id', :o, true)"), {"o": str(org_b)})
        rows = (await s.execute(text(f"SELECT id FROM fastag_transactions WHERE id IN ('{ft_a}', '{ft_b}')"))).fetchall()
        assert len(rows) == 1 and rows[0][0] == ft_b

    # Deny-by-default
    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
        rows = (await s.execute(text(f"SELECT id FROM fastag_transactions WHERE id IN ('{ft_a}', '{ft_b}')"))).fetchall()
        assert len(rows) == 0

    # Cleanup
    async with AsyncSessionLocal() as s:
        await s.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        await s.execute(text(f"DELETE FROM fastag_transactions WHERE id IN ('{ft_a}', '{ft_b}')"))
        await s.execute(text(f"DELETE FROM organisations WHERE id IN ('{org_a}', '{org_b}')"))
        await s.commit()
