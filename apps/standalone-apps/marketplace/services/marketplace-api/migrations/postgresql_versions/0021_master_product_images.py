"""Product images on master_product (the catalog moves from MongoDB to PostgreSQL)."""

from alembic import op

revision = "0021_master_product_images"
down_revision = "0020_unify_commerce_on_organisations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE public.master_product ADD COLUMN images JSONB NOT NULL DEFAULT '[]'::jsonb")
    op.execute("""ALTER TABLE public.master_product ADD CONSTRAINT ck_master_product_images_array
                  CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 10)""")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
