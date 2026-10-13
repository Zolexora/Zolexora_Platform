"""enable_tenant_row_level_security

Revision ID: e10000000001
Revises: a503d687602f
Create Date: 2026-10-13 11:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e10000000001'
down_revision: Union[str, Sequence[str], None] = 'a503d687602f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Enforces Database-Level Row-Level Security (RLS) for Multi-Tenancy.
    
    1. Installs current_app_organisation_id() and is_app_bypass_rls() helper functions.
    2. Automatically discovers all public tables with an organisation_id column.
    3. Enables and FORCES Row-Level Security on each table.
    4. Attaches a tenant_isolation_policy to each table using subquery-cached evaluation.
    5. Secures public.organisations table against current_app_organisation_id().
    """
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    # 1. Helper functions
    op.execute("""
    CREATE OR REPLACE FUNCTION public.current_app_organisation_id()
    RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('app.current_organisation_id', true), '')::uuid;
    $$;
    """)

    op.execute("""
    CREATE OR REPLACE FUNCTION public.is_app_bypass_rls()
    RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT COALESCE(current_setting('app.bypass_rls', true) = 'on', false);
    $$;
    """)

    # Ensure application connection role does not carry BYPASSRLS attribute
    op.execute("""
    DO $$ BEGIN
        EXECUTE format('ALTER ROLE %I NOBYPASSRLS', CURRENT_USER);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END $$;
    """)

    # 2. Dynamic RLS policy application across all multi-tenant tables
    op.execute("""
    DO $$ 
    DECLARE 
        tbl record;
    BEGIN
        FOR tbl IN 
            SELECT table_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND column_name = 'organisation_id'
              AND table_name NOT IN ('organisations')
        LOOP
            -- Enable RLS and FORCE even for table owner connections
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.table_name);
            EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl.table_name);
            
            -- Drop existing policy if any
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I;', tbl.table_name);
            
            -- Create optimized tenant isolation policy (subquery-cached per statement)
            EXECUTE format(
                'CREATE POLICY tenant_isolation_policy ON public.%I FOR ALL USING (
                    (SELECT public.is_app_bypass_rls()) OR 
                    organisation_id = (SELECT public.current_app_organisation_id())
                ) WITH CHECK (
                    (SELECT public.is_app_bypass_rls()) OR 
                    organisation_id = (SELECT public.current_app_organisation_id())
                );',
                tbl.table_name
            );
        END LOOP;
    END $$;
    """)

    # 3. Secure root organisations table
    op.execute("ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS organisations_tenant_policy ON public.organisations;")
    op.execute("""
    CREATE POLICY organisations_tenant_policy ON public.organisations
    FOR ALL
    USING (
        (SELECT public.is_app_bypass_rls()) OR
        id = (SELECT public.current_app_organisation_id())
    )
    WITH CHECK (
        (SELECT public.is_app_bypass_rls()) OR
        id = (SELECT public.current_app_organisation_id())
    );
    """)


def downgrade() -> None:
    """Disables RLS policies."""
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    op.execute("""
    DO $$ 
    DECLARE 
        tbl record;
    BEGIN
        FOR tbl IN 
            SELECT table_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND column_name = 'organisation_id'
              AND table_name NOT IN ('organisations')
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I;', tbl.table_name);
            EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY;', tbl.table_name);
            EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', tbl.table_name);
        END LOOP;
    END $$;
    """)

    op.execute("DROP POLICY IF EXISTS organisations_tenant_policy ON public.organisations;")
    op.execute("ALTER TABLE public.organisations DISABLE ROW LEVEL SECURITY;")
    op.execute("DROP FUNCTION IF EXISTS public.current_app_organisation_id();")
    op.execute("DROP FUNCTION IF EXISTS public.is_app_bypass_rls();")
