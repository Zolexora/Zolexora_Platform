-- ==============================================================================
-- PHASE 1 MANUAL MIGRATION SCRIPT (DO NOT AUTO-RUN WITHOUT REVIEWING EXISTING ROWS)
-- Purpose:
--   1. Drop legacy ZX-XXXX-XXXX-XXXX / ZX-ORG-XXXX-XXXX-XXXX CHECK constraints
--      on Auth DB, update existing rows to <userid>@zolexora.com handles, and
--      apply the new @zolexora.com CHECK constraints.
--   2. Update existing TMS DB clients (CLT-...) and vendors (VND-...) after
--      running `alembic upgrade head` (a10000000023_partner_zolexora_handles.py).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION A: AUTH DB (Run against AUTH_DATABASE_URL)
-- ------------------------------------------------------------------------------

-- A1. Inspect existing legacy IDs before modifying:
-- SELECT id, zolexora_org_id, name FROM public.zolexora_organizations WHERE zolexora_org_id !~* '@zolexora\.com$';
-- SELECT id, zolexora_id, email FROM public.zolexora_auth_users WHERE zolexora_id !~* '@zolexora\.com$';
-- SELECT id, organization_id, zolexora_id, email, role FROM public.zolexora_organization_memberships WHERE zolexora_id !~* '@zolexora\.com$';

BEGIN;

-- A2. Drop legacy Crockford Base32 CHECK constraints:
ALTER TABLE public.zolexora_organizations DROP CONSTRAINT IF EXISTS chk_zolexora_org_id_format;
ALTER TABLE public.zolexora_auth_users DROP CONSTRAINT IF EXISTS chk_auth_users_zx_id_format;
ALTER TABLE public.zolexora_organization_memberships DROP CONSTRAINT IF EXISTS chk_org_memberships_zx_id_format;

-- A3. Update existing Organizations (set each org's chosen <userid>@zolexora.com):
-- Example:
-- UPDATE public.zolexora_organizations
-- SET zolexora_org_id = 'denebpollux@zolexora.com'
-- WHERE zolexora_org_id = 'ZX-ORG-XXXX-XXXX-XXXX';

-- A4. Update existing Track 1 Users (fallback to u<8-char>@zolexora.com if no chosen handle):
UPDATE public.zolexora_auth_users
SET zolexora_id = LOWER('u' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 8) || '@zolexora.com')
WHERE zolexora_id !~* '@zolexora\.com$';

-- A5. Update existing Track 2 Memberships (employees / partners):
UPDATE public.zolexora_organization_memberships
SET zolexora_id = LOWER('e' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 8) || '@zolexora.com')
WHERE zolexora_id !~* '@zolexora\.com$';

-- A6. Enforce @zolexora.com handle CHECK constraints once all rows are migrated:
-- (Uncomment after all organizations in A3 are updated)
-- ALTER TABLE public.zolexora_organizations
--     ADD CONSTRAINT chk_zolexora_org_id_format
--     CHECK (zolexora_org_id ~* '^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]@zolexora\.com$');
-- ALTER TABLE public.zolexora_auth_users
--     ADD CONSTRAINT chk_auth_users_zx_id_format
--     CHECK (zolexora_id ~* '^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]@zolexora\.com$');
-- ALTER TABLE public.zolexora_organization_memberships
--     ADD CONSTRAINT chk_org_memberships_zx_id_format
--     CHECK (zolexora_id ~* '^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]@zolexora\.com$');

COMMIT;

-- ------------------------------------------------------------------------------
-- SECTION B: TMS DB (Run `alembic upgrade head` first, then run against TMS DB)
-- ------------------------------------------------------------------------------

BEGIN;

-- B1. Update connected Zolexora clients/vendors whose zolexora_org_id changed from ZX-ORG-...:
-- UPDATE public.clients SET zolexora_org_id = '<new_handle>@zolexora.com', client_code = '<new_handle>@zolexora.com'
-- WHERE zolexora_org_id = 'ZX-ORG-XXXX-XXXX-XXXX';
-- UPDATE public.vendors SET zolexora_org_id = '<new_handle>@zolexora.com', vendor_code = '<new_handle>@zolexora.com'
-- WHERE zolexora_org_id = 'ZX-ORG-XXXX-XXXX-XXXX';

-- B2. Update external (non-Zolexora) clients from CLT-... to c<8-digits>@zolexora.com:
UPDATE public.clients
SET client_code = 'c' || LPAD((ABS(HASHTEXT(id::text)) % 100000000)::text, 8, '0') || '@zolexora.com'
WHERE is_zolexora_user = false AND client_code !~* '@zolexora\.com$';

-- B3. Update external (non-Zolexora) vendors from VND-... to v<8-digits>@zolexora.com:
UPDATE public.vendors
SET vendor_code = 'v' || LPAD((ABS(HASHTEXT(id::text)) % 100000000)::text, 8, '0') || '@zolexora.com'
WHERE is_zolexora_user = false AND vendor_code !~* '@zolexora\.com$';

COMMIT;
