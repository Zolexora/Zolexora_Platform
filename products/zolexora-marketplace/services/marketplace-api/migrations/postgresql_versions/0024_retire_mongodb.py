"""The last MongoDB data moves to PostgreSQL (commerce step 5): coin history, coin discount
codes, subscription payments, reels and reel views. (Wishlists use the existing wishlist tables.)
"""

from alembic import op

revision = "0024_retire_mongodb"
down_revision = "0023_shipping_on_postgresql"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""CREATE TABLE public.coin_transaction (
                  id UUID PRIMARY KEY,
                  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
                  amount BIGINT NOT NULL,
                  type VARCHAR(16) NOT NULL CONSTRAINT ck_coin_transaction_type_values CHECK (type IN ('earned','spent','refund')),
                  description VARCHAR(500) NOT NULL DEFAULT '',
                  ref_id VARCHAR(128),
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now())""")
    op.execute("CREATE INDEX ix_coin_transaction_user_created ON public.coin_transaction (user_id, created_at)")
    op.execute("CREATE INDEX ix_coin_transaction_type_created ON public.coin_transaction (type, created_at)")

    op.execute("""CREATE TABLE public.coin_discount_code (
                  id UUID PRIMARY KEY,
                  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
                  code VARCHAR(16) NOT NULL CONSTRAINT uq_coin_discount_code_code UNIQUE,
                  discount_percent INTEGER NOT NULL CONSTRAINT ck_coin_discount_code_percent_bounds CHECK (discount_percent BETWEEN 1 AND 100),
                  coins_spent BIGINT NOT NULL,
                  product_id VARCHAR(64),
                  is_used BOOLEAN NOT NULL DEFAULT false,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now())""")
    op.execute("CREATE INDEX ix_coin_discount_code_user ON public.coin_discount_code (user_id, created_at)")

    op.execute("""CREATE TABLE public.subscription_payment (
                  id UUID PRIMARY KEY,
                  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
                  razorpay_order_id VARCHAR(64) NOT NULL CONSTRAINT uq_subscription_payment_razorpay_order UNIQUE,
                  plan_type VARCHAR(32) NOT NULL,
                  amount_minor BIGINT NOT NULL,
                  status VARCHAR(16) NOT NULL DEFAULT 'pending',
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now())""")

    op.execute("""CREATE TABLE public.reel (
                  id UUID PRIMARY KEY,
                  storefront_id UUID NOT NULL REFERENCES public.storefront (id) ON DELETE RESTRICT,
                  creator_id UUID NOT NULL,
                  creator_name VARCHAR(200) NOT NULL DEFAULT '',
                  title VARCHAR(300) NOT NULL,
                  description TEXT NOT NULL DEFAULT '',
                  video_url TEXT, thumbnail_url TEXT,
                  media_type VARCHAR(16) NOT NULL DEFAULT 'image',
                  content_type VARCHAR(16) NOT NULL DEFAULT 'organic',
                  linked_product_id VARCHAR(64),
                  sponsor_data JSONB,
                  is_active BOOLEAN NOT NULL DEFAULT true,
                  views_count BIGINT NOT NULL DEFAULT 0,
                  likes_count BIGINT NOT NULL DEFAULT 0,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now())""")
    op.execute("CREATE INDEX ix_reel_storefront_created ON public.reel (storefront_id, created_at)")
    op.execute("CREATE INDEX ix_reel_creator ON public.reel (creator_id, created_at)")

    op.execute("""CREATE TABLE public.reel_view (
                  id UUID PRIMARY KEY,
                  reel_id UUID NOT NULL REFERENCES public.reel (id) ON DELETE CASCADE,
                  storefront_id UUID NOT NULL REFERENCES public.storefront (id) ON DELETE RESTRICT,
                  user_id UUID NOT NULL,
                  view_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  CONSTRAINT uq_reel_view_daily UNIQUE (user_id, reel_id, view_date))""")
    op.execute("CREATE INDEX ix_reel_view_storefront_created ON public.reel_view (storefront_id, created_at)")

    # One wishlist per buyer and storefront.
    op.execute("""CREATE UNIQUE INDEX uq_wishlist_buyer_storefront ON public.wishlist (buyer_id, storefront_id)
                  WHERE buyer_id IS NOT NULL""")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
