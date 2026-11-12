"""Reels, coins and subscriptions leave the marketplace. Reels move to PostCread and earnings to
the Zolexora auth service; there was no live data to keep.
"""

from alembic import op

revision = "0026_drop_reels_coins_subscriptions"
down_revision = "0025_seller_kyc_and_admin_actors"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("reel_view", "reel", "subscription_payment", "coin_discount_code", "coin_transaction"):
        op.execute(f"DROP TABLE IF EXISTS public.{table}")
    op.execute("ALTER TABLE public.user_profile DROP COLUMN IF EXISTS coin_balance")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
