"""Add driver_code and unique indexes on driver_code, phone, license_number, and pan per organisation.

Revision ID: v10000000018
Revises: u10000000017
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa

revision = "v10000000018"
down_revision = "u10000000017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL app.bypass_rls = 'on'")

    op.add_column("drivers", sa.Column("driver_code", sa.String(length=32), nullable=True))

    op.execute(
        """
        UPDATE drivers
        SET driver_code = 'DRV-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
        WHERE driver_code IS NULL
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_drivers_org_driver_code
        ON drivers (organisation_id, driver_code)
        WHERE driver_code IS NOT NULL
        """
    )

    # Deduplicate existing phone/license/pan per org before creating unique indexes
    for col, idx_name in (
        ("phone", "uq_drivers_org_phone"),
        ("license_number", "uq_drivers_org_license"),
        ("pan", "uq_drivers_org_pan"),
    ):
        if col == "pan":
            op.execute(
                f"""
                UPDATE drivers
                SET {col} = NULL
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id,
                               ROW_NUMBER() OVER (
                                   PARTITION BY organisation_id, {col}
                                   ORDER BY created_at DESC
                               ) AS rn
                        FROM drivers
                        WHERE {col} IS NOT NULL AND {col} <> ''
                    ) ranked
                    WHERE rn > 1
                )
                """
            )
        op.execute(
            f"""
            CREATE UNIQUE INDEX IF NOT EXISTS {idx_name}
            ON drivers (organisation_id, {col})
            WHERE {col} IS NOT NULL AND {col} <> ''
            """
        )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_drivers_org_pan")
    op.execute("DROP INDEX IF EXISTS uq_drivers_org_license")
    op.execute("DROP INDEX IF EXISTS uq_drivers_org_phone")
    op.execute("DROP INDEX IF EXISTS uq_drivers_org_driver_code")
    op.drop_column("drivers", "driver_code")
