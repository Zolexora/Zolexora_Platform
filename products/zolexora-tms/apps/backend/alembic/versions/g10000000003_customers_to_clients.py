"""use clients as the single customer table

The UI manages customers through the CRM `clients` table, but bookings, invoices,
payments and billing referenced the legacy `customers` table, which nothing writes to.
This copies any legacy customers into clients (same ids) and repoints the foreign keys.
The legacy `customers` table is left in place untouched.

Revision ID: g10000000003
Revises: f10000000002
Create Date: 2026-10-30 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'g10000000003'
down_revision: Union[str, Sequence[str], None] = 'f10000000002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, ondelete)
REFERENCING = [
    ("bookings", "RESTRICT"),
    ("booking_requests", "RESTRICT"),
    ("invoices", "RESTRICT"),
    ("payments", "RESTRICT"),
    ("billing_records", "RESTRICT"),
    ("financial_adjustment_notes", "RESTRICT"),
    ("rate_cards", "SET NULL"),
]


def _swap(target: str) -> None:
    old = "customers" if target == "clients" else "clients"
    for table, ondelete in REFERENCING:
        op.execute(f"ALTER TABLE public.{table} DROP CONSTRAINT IF EXISTS fk_{table}_customer_id_{old}")
        op.execute(
            f"ALTER TABLE public.{table} ADD CONSTRAINT fk_{table}_customer_id_{target} "
            f"FOREIGN KEY (customer_id) REFERENCES public.{target}(id) ON DELETE {ondelete}"
        )


def upgrade() -> None:
    # RLS would hide other tenants' rows from this copy; migrations run as owner with bypass.
    op.execute("SELECT set_config('app.bypass_rls', 'on', true)")
    op.execute("""
        INSERT INTO public.clients (
            id, organisation_id, name, contact_person, email, phone, billing_address, gstin, pan,
            payment_terms_days, credit_limit, status, notes, created_at, updated_at
        )
        SELECT
            id, organisation_id, name, contact_person, email, phone, billing_address, gstin, pan,
            payment_terms_days, credit_limit, status::text::client_status, notes, created_at, updated_at
        FROM public.customers
        ON CONFLICT (id) DO NOTHING
    """)
    _swap("clients")


def downgrade() -> None:
    _swap("customers")
