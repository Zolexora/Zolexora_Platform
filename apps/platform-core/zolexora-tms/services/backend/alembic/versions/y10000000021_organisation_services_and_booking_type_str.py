"""Create organisation_services table and convert booking_type to varchar(64).

Revision ID: y10000000021
Revises: x10000000020
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "y10000000021"
down_revision = "x10000000020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL app.bypass_rls = 'on'")

    # Convert bookings.booking_type & booking_requests.booking_type from enum to varchar(64)
    op.execute(
        "ALTER TABLE bookings ALTER COLUMN booking_type TYPE VARCHAR(64) USING booking_type::text"
    )
    op.execute(
        "ALTER TABLE booking_requests ALTER COLUMN booking_type TYPE VARCHAR(64) USING booking_type::text"
    )

    op.create_table(
        "organisation_services",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("service_category", sa.String(length=16), nullable=False, server_default="PASSENGER"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("organisation_id", "code", name="uq_org_services_org_code"),
    )
    op.create_index("ix_organisation_services_organisation_id", "organisation_services", ["organisation_id"])

    op.execute("ALTER TABLE organisation_services ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation_organisation_services ON organisation_services
        USING (
            current_setting('app.bypass_rls', true) = 'on'
            OR organisation_id = NULLIF(current_setting('app.organisation_id', true), '')::uuid
        )
        WITH CHECK (
            current_setting('app.bypass_rls', true) = 'on'
            OR organisation_id = NULLIF(current_setting('app.organisation_id', true), '')::uuid
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_organisation_services ON organisation_services")
    op.drop_index("ix_organisation_services_organisation_id", table_name="organisation_services")
    op.drop_table("organisation_services")
