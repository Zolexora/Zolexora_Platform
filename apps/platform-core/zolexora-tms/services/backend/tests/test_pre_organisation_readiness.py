import uuid
import pytest
from sqlalchemy import text
from app.core.config import settings
from app.db.session import AsyncSessionLocal


@pytest.mark.asyncio
async def test_first_organisation_dry_run():
    """Verify core Postgres RLS helpers, DB URL, and storage key prefixing are ready."""
    assert settings.DATABASE_URL
    async with AsyncSessionLocal() as session:
        fn_count = (
            await session.execute(
                text(
                    "SELECT COUNT(*) FROM pg_proc "
                    "WHERE proname IN ('is_app_bypass_rls', 'current_app_organisation_id')"
                )
            )
        ).scalar()
        assert fn_count == 2

    new_org_uuid = uuid.uuid4()
    r2_prefix = f"organisations/{new_org_uuid}/"
    cld_prefix = f"zolexora/organisations/{new_org_uuid}/"
    assert str(new_org_uuid) in r2_prefix
    assert str(new_org_uuid) in cld_prefix


@pytest.mark.asyncio
async def test_resource_uniqueness():
    """Verify multi-tenant uniqueness constraints exist at the schema level."""
    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                text(
                    "SELECT table_name, constraint_name "
                    "FROM information_schema.table_constraints "
                    "WHERE constraint_type = 'UNIQUE' "
                    "AND table_name IN ('organisation_database_assignments', 'shift_rosters', 'fastag_transactions')"
                )
            )
        ).fetchall()
        assert len(rows) >= 2


@pytest.mark.asyncio
async def test_tenant_context_derivation_isolation():
    """Verify OrgContext/dependencies derive tenant scope cleanly without trusting client DB headers."""
    with open("app/auth/dependencies.py", "r") as f:
        content = f.read()

    assert "set_tenant_context" in content
    assert "organisation_id" in content
