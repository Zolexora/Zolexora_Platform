"""Add unique indexes: vehicles registration_number per org, fastag_id globally (non-null), gps_device_id globally (non-null).

Revision ID: t10000000016
Revises: s10000000015
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa

revision = "t10000000016"
down_revision = "s10000000015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Bypass RLS for the index scan / dedup work
    op.execute("SET LOCAL app.bypass_rls = 'on'")

    # 1. registration_number must be unique per organisation (already enforced
    #    in app logic, now also at DB level as a partial unique index)
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_org_registration
        ON vehicles (organisation_id, registration_number)
        WHERE registration_number IS NOT NULL
        """
    )

    # 2. FASTag ID must be globally unique (non-null rows only — NULLs are
    #    allowed for vehicles without a FASTag)
    # First deduplicate: keep the most recently created row per fastag_id
    op.execute(
        """
        UPDATE vehicles
        SET fastag_id = NULL
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY fastag_id ORDER BY created_at DESC) AS rn
                FROM vehicles
                WHERE fastag_id IS NOT NULL
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_fastag_id
        ON vehicles (fastag_id)
        WHERE fastag_id IS NOT NULL
        """
    )

    # 3. GPS Device ID must be globally unique (non-null rows only)
    op.execute(
        """
        UPDATE vehicles
        SET gps_device_id = NULL
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY gps_device_id ORDER BY created_at DESC) AS rn
                FROM vehicles
                WHERE gps_device_id IS NOT NULL
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_gps_device_id
        ON vehicles (gps_device_id)
        WHERE gps_device_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_vehicles_org_registration")
    op.execute("DROP INDEX IF EXISTS uq_vehicles_fastag_id")
    op.execute("DROP INDEX IF EXISTS uq_vehicles_gps_device_id")
