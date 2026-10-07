"""persisted storefront domain isolation

Revision ID: 0003_persisted_storefront_domain_isolation
Revises: 0002_identity_session_rbac
"""
from alembic import op


revision = '0003_persisted_storefront_domain_isolation'
down_revision = '0002_identity_session_rbac'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 0. Expand alembic_version.version_num column size to support 42-char revision ID
    op.execute("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(64);")

    # 1. Add locale shape check constraint on storefront table
    op.create_check_constraint(
        op.f('ck_storefront_storefront_locale_shape'),
        'storefront',
        "length(locale) >= 2 AND locale !~ '\\s'",
    )

    # 2. Host normalization check constraints on storefront_domain table
    op.create_check_constraint(
        op.f('ck_storefront_domain_hostname_trimmed'),
        'storefront_domain',
        'hostname = trim(hostname)',
    )
    op.create_check_constraint(
        op.f('ck_storefront_domain_hostname_no_trailing_dot'),
        'storefront_domain',
        "hostname !~ '\\.$'",
    )
    op.create_check_constraint(
        op.f('ck_storefront_domain_reject_surface_domains'),
        'storefront_domain',
        "hostname NOT IN ('api.zolexora.com', 'seller.zolexora.com', 'admin.marketplace.zolexora.com')",
    )

    # 3. Add FK index and lookup indexes on storefront_domain table
    op.create_index(
        op.f('ix_storefront_domain_storefront_id'),
        'storefront_domain',
        ['storefront_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_storefront_domain_active_lookup'),
        'storefront_domain',
        ['hostname', 'is_active'],
        unique=False,
    )

    # 4. Expression unique index for normalized host uniqueness
    op.execute("""
        CREATE UNIQUE INDEX uq_storefront_domain_normalized_hostname
        ON storefront_domain (lower(trim(trailing '.' from hostname)));
    """)

    # 5. Create / update PL/pgSQL Functions and Triggers for Immutability

    # Function & Trigger 1: Storefront Key Immutability
    op.execute("""
        CREATE OR REPLACE FUNCTION reject_storefront_key_change() RETURNS trigger AS $$
        BEGIN
            IF OLD.storefront_key IS DISTINCT FROM NEW.storefront_key THEN
                RAISE EXCEPTION 'storefront_key is immutable: cannot change storefront_key from ''%'' to ''%''',
                    OLD.storefront_key, NEW.storefront_key
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_storefront_key_immutable ON storefront;")
    op.execute("""
        CREATE TRIGGER trg_storefront_key_immutable
        BEFORE UPDATE ON storefront
        FOR EACH ROW
        EXECUTE FUNCTION reject_storefront_key_change();
    """)

    # Function & Trigger 2: Storefront Domain storefront_id Immutability
    op.execute("""
        CREATE OR REPLACE FUNCTION reject_storefront_domain_storefront_id_change() RETURNS trigger AS $$
        BEGIN
            IF OLD.storefront_id IS DISTINCT FROM NEW.storefront_id THEN
                RAISE EXCEPTION 'storefront_domain.storefront_id is immutable: cannot reassign domain ''%'' from storefront % to storefront %',
                    OLD.hostname, OLD.storefront_id, NEW.storefront_id
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_storefront_domain_storefront_id_immutable ON storefront_domain;")
    op.execute("""
        CREATE TRIGGER trg_storefront_domain_storefront_id_immutable
        BEFORE UPDATE ON storefront_domain
        FOR EACH ROW
        EXECUTE FUNCTION reject_storefront_domain_storefront_id_change();
    """)

    # Function & Trigger 3: Order storefront_id Immutability
    op.execute("""
        CREATE OR REPLACE FUNCTION reject_order_storefront_id_change() RETURNS trigger AS $$
        BEGIN
            IF OLD.storefront_id IS DISTINCT FROM NEW.storefront_id THEN
                RAISE EXCEPTION 'marketplace_order.storefront_id is immutable: cannot change storefront_id for order % from % to %',
                    OLD.id, OLD.storefront_id, NEW.storefront_id
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_order_storefront_id_immutable ON marketplace_order;")
    op.execute("""
        CREATE TRIGGER trg_order_storefront_id_immutable
        BEFORE UPDATE ON marketplace_order
        FOR EACH ROW
        EXECUTE FUNCTION reject_order_storefront_id_change();
    """)

    # Function & Trigger 4: Cart storefront_id Immutability
    op.execute("""
        CREATE OR REPLACE FUNCTION reject_cart_storefront_id_change() RETURNS trigger AS $$
        BEGIN
            IF OLD.storefront_id IS DISTINCT FROM NEW.storefront_id THEN
                RAISE EXCEPTION 'cart.storefront_id is immutable: cannot change storefront_id for cart % from % to %',
                    OLD.id, OLD.storefront_id, NEW.storefront_id
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_cart_storefront_id_immutable ON cart;")
    op.execute("""
        CREATE TRIGGER trg_cart_storefront_id_immutable
        BEFORE UPDATE ON cart
        FOR EACH ROW
        EXECUTE FUNCTION reject_cart_storefront_id_change();
    """)

    # 6. Seed canonical storefronts
    op.execute("""
        INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale) VALUES
        ('60000000-0000-4000-8000-000000000001', 'zolexora-shop', 'Zolexora Shop', true, 'INR', 'en-IN'),
        ('60000000-0000-4000-8000-000000000002', 'mahila-madel', 'Mahila Madel', true, 'INR', 'en-IN')
        ON CONFLICT (storefront_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            currency = EXCLUDED.currency,
            locale = EXCLUDED.locale,
            is_active = EXCLUDED.is_active;
    """)

    # 7. Seed canonical storefront domains
    op.execute("""
        INSERT INTO storefront_domain (id, storefront_id, hostname, environment, domain_role, is_active) VALUES
        ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'shop.zolexora.com', 'production', 'primary', true),
        ('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 'shop.zolexora.local', 'development', 'development', true),
        ('70000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000002', 'mahilamadel.store', 'production', 'primary', true),
        ('70000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000002', 'www.mahilamadel.store', 'production', 'alias', true),
        ('70000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', 'mahilamadel.local', 'development', 'development', true)
        ON CONFLICT (hostname) DO UPDATE SET
            storefront_id = EXCLUDED.storefront_id,
            environment = EXCLUDED.environment,
            domain_role = EXCLUDED.domain_role,
            is_active = EXCLUDED.is_active;
    """)


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
