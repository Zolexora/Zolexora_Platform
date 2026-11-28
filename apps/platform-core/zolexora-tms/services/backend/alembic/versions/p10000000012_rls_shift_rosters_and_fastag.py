"""Enable RLS + tenant isolation policy for shift_rosters and fastag_transactions.

Revision ID: p10000000012
Revises: n10000000010
Create Date: 2026-11-27
"""
from alembic import op

revision = "p10000000012"
down_revision = "n10000000010"
branch_labels = None
depends_on = None

_POLICY = (
    "(is_app_bypass_rls() OR organisation_id = current_app_organisation_id())"
)


def upgrade() -> None:
    for table in ("shift_rosters", "fastag_transactions"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation_policy ON {table} "
            f"AS PERMISSIVE FOR ALL TO PUBLIC USING ({_POLICY}) "
            f"WITH CHECK ({_POLICY})"
        )


def downgrade() -> None:
    for table in ("shift_rosters", "fastag_transactions"):
        op.execute(
            f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}"
        )
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
