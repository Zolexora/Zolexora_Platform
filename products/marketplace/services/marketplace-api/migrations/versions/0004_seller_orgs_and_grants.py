"""seller orgs and grants

Revision ID: 0004_seller_orgs_and_grants
Revises: 0003_persisted_storefront_domain_isolation
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_seller_orgs_and_grants'
down_revision = '0003_persisted_storefront_domain_isolation'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. seller_organization table
    op.create_table(
        'seller_organization',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='PENDING_VERIFICATION', nullable=False),
        sa.Column('verification_status', sa.String(length=32), server_default='UNVERIFIED', nullable=False),
        sa.Column('onboarding_state', sa.String(length=32), server_default='DRAFT', nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('ACTIVE','SUSPENDED','PENDING_VERIFICATION','REJECTED','INACTIVE')", name=op.f('ck_seller_organization_seller_org_status_values')),
        sa.CheckConstraint("verification_status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED','NEEDS_REVISION')", name=op.f('ck_seller_organization_seller_verification_status_values')),
        sa.CheckConstraint("onboarding_state IN ('DRAFT','DOCUMENTS_SUBMITTED','UNDER_REVIEW','COMPLETED','REJECTED')", name=op.f('ck_seller_organization_seller_onboarding_state_values')),
        sa.CheckConstraint("slug = lower(trim(slug)) AND length(slug) >= 2", name=op.f('ck_seller_organization_slug_shape')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_seller_organization')),
        sa.UniqueConstraint('slug', name='uq_seller_organization_slug')
    )
    op.create_index('ix_seller_organization_status', 'seller_organization', ['status', 'verification_status'], unique=False)

    # 2. seller_org_member table
    op.create_table(
        'seller_org_member',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('role', sa.String(length=32), server_default='MEMBER', nullable=False),
        sa.Column('permissions', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=32), server_default='ACTIVE', nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("role IN ('OWNER','ADMIN','MANAGER','MEMBER')", name=op.f('ck_seller_org_member_member_role_values')),
        sa.CheckConstraint("status IN ('ACTIVE','INVITED','SUSPENDED','REMOVED')", name=op.f('ck_seller_org_member_member_status_values')),
        sa.ForeignKeyConstraint(['organization_id'], ['seller_organization.id'], name=op.f('fk_seller_org_member_organization_id'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_seller_org_member_user_id'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_seller_org_member')),
        sa.UniqueConstraint('organization_id', 'user_id', name='uq_seller_org_member_org_user')
    )
    op.create_index('uq_seller_org_member_active_owner', 'seller_org_member', ['organization_id'], unique=True, postgresql_where=sa.text("role = 'OWNER' AND status = 'ACTIVE'"))
    op.create_index('ix_seller_org_member_user_id', 'seller_org_member', ['user_id', 'status'], unique=False)
    op.create_index('ix_seller_org_member_org_role', 'seller_org_member', ['organization_id', 'role', 'status'], unique=False)

    # 3. seller_storefront_grant table
    op.create_table(
        'seller_storefront_grant',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('storefront_id', sa.Uuid(), nullable=False),
        sa.Column('grant_status', sa.String(length=32), server_default='PENDING', nullable=False),
        sa.Column('granted_by_user_id', sa.Uuid(), nullable=True),
        sa.Column('grant_reason', sa.String(length=500), nullable=True),
        sa.Column('effective_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("grant_status IN ('PENDING','APPROVED','REVOKED','SUSPENDED')", name=op.f('ck_seller_storefront_grant_status_values')),
        sa.ForeignKeyConstraint(['granted_by_user_id'], ['users.id'], name=op.f('fk_seller_storefront_grant_granted_by_user_id'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['organization_id'], ['seller_organization.id'], name=op.f('fk_seller_storefront_grant_organization_id'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['storefront_id'], ['storefront.id'], name=op.f('fk_seller_storefront_grant_storefront_id'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_seller_storefront_grant'))
    )
    op.create_index('uq_seller_storefront_grant_active', 'seller_storefront_grant', ['organization_id', 'storefront_id'], unique=True, postgresql_where=sa.text("grant_status IN ('PENDING', 'APPROVED')"))
    op.create_index('ix_seller_storefront_grant_lookup', 'seller_storefront_grant', ['organization_id', 'storefront_id', 'grant_status'], unique=False)

    # 4. seller_audit_log table
    op.create_table(
        'seller_audit_log',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('actor_user_id', sa.Uuid(), nullable=False),
        sa.Column('action', sa.String(length=128), nullable=False),
        sa.Column('resource_type', sa.String(length=64), nullable=False),
        sa.Column('resource_id', sa.Uuid(), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], name=op.f('fk_seller_audit_log_actor_user_id'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['organization_id'], ['seller_organization.id'], name=op.f('fk_seller_audit_log_organization_id'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_seller_audit_log'))
    )
    op.create_index('ix_seller_audit_log_org_created', 'seller_audit_log', ['organization_id', 'created_at'], unique=False)
    op.create_index('ix_seller_audit_log_actor', 'seller_audit_log', ['actor_user_id', 'created_at'], unique=False)
    op.create_index('ix_seller_audit_log_resource', 'seller_audit_log', ['resource_type', 'resource_id'], unique=False)

    # 5. seller_verification_history table
    op.create_table(
        'seller_verification_history',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('verified_by_user_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED','NEEDS_REVISION','SUSPENDED')", name=op.f('ck_seller_verification_history_status_values')),
        sa.ForeignKeyConstraint(['organization_id'], ['seller_organization.id'], name=op.f('fk_seller_verification_history_organization_id'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['verified_by_user_id'], ['users.id'], name=op.f('fk_seller_verification_history_verified_by_user_id'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_seller_verification_history'))
    )
    op.create_index('ix_seller_verification_history_org_created', 'seller_verification_history', ['organization_id', 'created_at'], unique=False)

    # 6. Set updated_at triggers
    for table_name in ('seller_organization', 'seller_org_member', 'seller_storefront_grant'):
        op.execute(
            f'CREATE TRIGGER trg_{table_name}_updated_at '
            f'BEFORE UPDATE ON {table_name} FOR EACH ROW EXECUTE FUNCTION set_updated_at()'
        )

    # 7. Set Immutability Triggers for audit logs and verification history
    op.execute("""
        CREATE OR REPLACE FUNCTION reject_seller_audit_log_mutation() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'seller_audit_log records are immutable and append-only'
                USING ERRCODE = '23514';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_seller_audit_log_immutable
        BEFORE UPDATE OR DELETE ON seller_audit_log
        FOR EACH ROW EXECUTE FUNCTION reject_seller_audit_log_mutation();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION reject_seller_verification_history_mutation() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'seller_verification_history records are immutable and append-only'
                USING ERRCODE = '23514';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_seller_verification_history_immutable
        BEFORE UPDATE OR DELETE ON seller_verification_history
        FOR EACH ROW EXECUTE FUNCTION reject_seller_verification_history_mutation();
    """)


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
