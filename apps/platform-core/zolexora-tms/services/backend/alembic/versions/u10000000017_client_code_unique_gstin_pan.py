"""Add client_code and unique indexes on client_code, gstin, and pan per organisation.

Revision ID: u10000000017
Revises: t10000000016
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa

revision = "u10000000017"
down_revision = "t10000000016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL app.bypass_rls = 'on'")

    op.add_column("clients", sa.Column("client_code", sa.String(length=32), nullable=True))

    # Backfill unique client_code for existing clients
    op.execute(
        """
        UPDATE clients
        SET client_code = 'CLT-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
        WHERE client_code IS NULL
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_org_client_code
        ON clients (organisation_id, client_code)
        WHERE client_code IS NOT NULL
        """
    )

    # Deduplicate existing GSTINs per org (keep latest)
    op.execute(
        """
        UPDATE clients
        SET gstin = NULL
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY organisation_id, gstin
                           ORDER BY created_at DESC
                       ) AS rn
                FROM clients
                WHERE gstin IS NOT NULL AND gstin <> ''
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_org_gstin
        ON clients (organisation_id, gstin)
        WHERE gstin IS NOT NULL AND gstin <> ''
        """
    )

    # Deduplicate existing PANs per org (keep latest)
    op.execute(
        """
        UPDATE clients
        SET pan = NULL
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY organisation_id, pan
                           ORDER BY created_at DESC
                       ) AS rn
                FROM clients
                WHERE pan IS NOT NULL AND pan <> ''
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_org_pan
        ON clients (organisation_id, pan)
        WHERE pan IS NOT NULL AND pan <> ''
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_clients_org_pan")
    op.execute("DROP INDEX IF EXISTS uq_clients_org_gstin")
    op.execute("DROP INDEX IF EXISTS uq_clients_org_client_code")
    op.drop_column("clients", "client_code")
