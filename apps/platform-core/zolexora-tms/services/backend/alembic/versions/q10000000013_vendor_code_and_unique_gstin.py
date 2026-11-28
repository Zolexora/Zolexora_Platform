"""Add vendor_code and unique per-org indexes on vendor_code and gstin.

Revision ID: q10000000013
Revises: p10000000012
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa

revision = "q10000000013"
down_revision = "p10000000012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL app.bypass_rls = 'on'")
    op.add_column("vendors", sa.Column("vendor_code", sa.String(length=32), nullable=True))

    # Backfill existing vendors deterministically so every row has a unique Vendor ID
    op.execute(
        "UPDATE vendors "
        "SET vendor_code = 'VND-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8)) "
        "WHERE vendor_code IS NULL"
    )

    # Normalize empty/whitespace GSTINs to NULL and clear older duplicate GSTINs before indexing
    op.execute("UPDATE vendors SET gstin = NULL WHERE gstin IS NOT NULL AND BTRIM(gstin) = ''")
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY organisation_id, UPPER(BTRIM(gstin))
                       ORDER BY created_at DESC, id DESC
                   ) AS rn
            FROM vendors
            WHERE gstin IS NOT NULL AND BTRIM(gstin) <> ''
        )
        UPDATE vendors v
        SET gstin = NULL
        FROM ranked r
        WHERE v.id = r.id AND r.rn > 1
        """
    )

    op.execute(
        "CREATE UNIQUE INDEX uq_vendors_org_vendor_code "
        "ON vendors (organisation_id, vendor_code) "
        "WHERE vendor_code IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_vendors_org_gstin "
        "ON vendors (organisation_id, gstin) "
        "WHERE gstin IS NOT NULL AND gstin <> ''"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_vendors_org_gstin")
    op.execute("DROP INDEX IF EXISTS uq_vendors_org_vendor_code")
    op.drop_column("vendors", "vendor_code")
