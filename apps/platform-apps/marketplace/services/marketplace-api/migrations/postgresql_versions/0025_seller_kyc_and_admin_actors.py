"""Seller KYC secrets out of organisation metadata, and admin actors that are not users.

* seller_kyc keeps an organisation's PAN and payout bank account number encrypted (key from
  Infisical); the organisation's metadata keeps only their last four digits. Full Aadhaar
  numbers are not stored at all.
* Platform admins are the auth service's Track 3 accounts and have no users row, so the
  columns recording which admin acted (grant approvals, verification, audit trails, refunds)
  hold the auth-service id without a foreign key to users.
"""

from alembic import op

revision = "0025_seller_kyc_and_admin_actors"
down_revision = "0024_retire_mongodb"
branch_labels = None
depends_on = None

ADMIN_ACTOR_KEYS = (
    ("audit_event", "fk_audit_event_actor_id"),
    ("refund_record", "fk_refund_record_requested_by"),
    ("seller_storefront_grant", "fk_seller_storefront_grant_granted_by_user_id"),
    ("seller_audit_log", "fk_seller_audit_log_actor_user_id"),
    ("seller_verification_history", "fk_seller_verification_history_verified_by_user_id"),
    ("order_state_history", "fk_order_state_history_actor_id"),
)


def upgrade() -> None:
    for table, constraint in ADMIN_ACTOR_KEYS:
        op.execute(f"ALTER TABLE public.{table} DROP CONSTRAINT IF EXISTS {constraint}")

    op.execute("""CREATE TABLE public.seller_kyc (
                  organization_id UUID PRIMARY KEY REFERENCES public.seller_organization (id) ON DELETE CASCADE,
                  pan_ciphertext TEXT,
                  account_number_ciphertext TEXT,
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT now())""")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
