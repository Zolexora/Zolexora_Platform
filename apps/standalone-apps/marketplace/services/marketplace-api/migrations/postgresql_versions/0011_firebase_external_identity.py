"""Add Firebase external identity links.

Revision ID: 0011_firebase_external_identity
Revises: 0010_erp_outbox_inbox
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_firebase_external_identity"
down_revision = "0010_erp_outbox_inbox"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ``op.f`` marks this as an already-conventioned name; without it Alembic
    # prefixes the naming convention a second time on PostgreSQL.
    op.drop_constraint(op.f("ck_user_profile_user_profile_source_values"), "user_profile", type_="check")
    op.create_check_constraint(
        op.f("ck_user_profile_user_profile_source_values"),
        "user_profile",
        "identity_source IN ('password','legacy_supabase','firebase')",
    )
    op.create_table(
        "external_identity",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("subject", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("provider IN ('firebase')", name="ck_external_identity_provider_values"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_external_identity_user_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_external_identity"),
        sa.UniqueConstraint("provider", "subject", name="uq_external_identity_provider_subject"),
        sa.UniqueConstraint("provider", "user_id", name="uq_external_identity_provider_user"),
    )
    op.execute(
        "CREATE TRIGGER trg_external_identity_updated_at "
        "BEFORE UPDATE ON external_identity FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
