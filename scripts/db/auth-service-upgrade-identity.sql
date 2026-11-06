-- ==============================================================================
-- AUTH DATABASE (AUTH_DATABASE_URL / ZOLEXORA_AUTHENTICATION_DATABASE_URL)
-- ADR 0004 (one identity, businesses, verification) + ADR 0005 (roles & permissions,
-- Track 2 hardening). Run after auth-service-schema.sql. Safe to re-run.
-- ==============================================================================
BEGIN;

-- ------------------------------------------------------------------------------
-- 1. People: profile (Track 1 sign-in itself is unchanged)
-- ------------------------------------------------------------------------------
ALTER TABLE public.zolexora_auth_users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS addresses  JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------------------------
-- 2. Businesses: typed by the PAN's 4th letter
-- ------------------------------------------------------------------------------
ALTER TABLE public.zolexora_organizations
    ADD COLUMN IF NOT EXISTS legal_name          TEXT,
    ADD COLUMN IF NOT EXISTS trade_name          TEXT,
    ADD COLUMN IF NOT EXISTS pan_holder_type     CHAR(1),
    ADD COLUMN IF NOT EXISTS business_kind       TEXT,
    ADD COLUMN IF NOT EXISTS pan_encrypted       TEXT,
    ADD COLUMN IF NOT EXISTS pan_last4           TEXT,
    ADD COLUMN IF NOT EXISTS pan_hash            TEXT,
    ADD COLUMN IF NOT EXISTS email               TEXT,
    ADD COLUMN IF NOT EXISTS phone               TEXT,
    ADD COLUMN IF NOT EXISTS address             JSONB,
    ADD COLUMN IF NOT EXISTS logo_url            TEXT,
    ADD COLUMN IF NOT EXISTS activity_primary    TEXT,
    ADD COLUMN IF NOT EXISTS activity_others     JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS official_activities JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS mfa_policy          TEXT NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS created_by          UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orgs_business_kind') THEN
    ALTER TABLE public.zolexora_organizations ADD CONSTRAINT chk_orgs_business_kind CHECK (business_kind IS NULL OR business_kind IN
      ('individual', 'proprietor', 'company', 'llp', 'partnership', 'huf', 'trust', 'society', 'public_body'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orgs_mfa_policy') THEN
    ALTER TABLE public.zolexora_organizations ADD CONSTRAINT chk_orgs_mfa_policy CHECK (mfa_policy IN ('off', 'optional', 'required'));
  END IF;
END $$;

-- One business per PAN, except individuals/proprietors (P). Closed businesses release their PAN.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orgs_pan_non_person
    ON public.zolexora_organizations(pan_hash) WHERE pan_holder_type <> 'P' AND status <> 'deactivated';
CREATE INDEX IF NOT EXISTS idx_orgs_pan_hash ON public.zolexora_organizations(pan_hash);

-- What the business does: groups editable in platform-admin (hidden, never deleted).
CREATE TABLE IF NOT EXISTS public.zolexora_activity_groups (
    key        TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
    label      TEXT NOT NULL,
    hidden     BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.zolexora_activity_groups (key, label, sort_order) VALUES
  ('agriculture', 'Agriculture & Farming', 10), ('food_beverages', 'Food & Beverages', 20),
  ('textiles_apparel', 'Textiles & Apparel', 30), ('handicrafts', 'Handicrafts & Handloom', 40),
  ('retail', 'Retail', 50), ('wholesale_trading', 'Wholesale & Trading', 60), ('ecommerce', 'E-commerce', 70),
  ('manufacturing', 'Manufacturing', 80), ('construction_real_estate', 'Construction & Real Estate', 90),
  ('logistics_transport', 'Logistics & Transport', 100), ('automotive', 'Automotive', 110),
  ('electronics_hardware', 'Electronics & Hardware', 120), ('software_it', 'Software & IT Services', 130),
  ('professional_services', 'Professional Services', 140), ('finance_insurance', 'Finance & Insurance', 150),
  ('healthcare', 'Healthcare', 160), ('pharma', 'Pharma & Medical Supplies', 170), ('education', 'Education & Training', 180),
  ('hospitality_tourism', 'Hospitality & Tourism', 190), ('media_entertainment', 'Media & Entertainment', 200),
  ('energy_utilities', 'Energy & Utilities', 210), ('chemicals', 'Chemicals & Plastics', 220),
  ('beauty_wellness', 'Beauty & Wellness', 230), ('non_profit_social', 'Non-profit & Social', 240),
  ('government_public', 'Government & Public Services', 250), ('other', 'Other', 990)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. Employees (Track 2): phone login, platform-wide ZX id
-- ------------------------------------------------------------------------------
ALTER TABLE public.zolexora_organization_memberships
    ALTER COLUMN email DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS phone_number TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_memberships_contact') THEN
    ALTER TABLE public.zolexora_organization_memberships
      ADD CONSTRAINT chk_org_memberships_contact CHECK (email IS NOT NULL OR phone_number IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_memberships_phone_e164') THEN
    ALTER TABLE public.zolexora_organization_memberships
      ADD CONSTRAINT chk_org_memberships_phone_e164 CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_memberships_zx_id_global ON public.zolexora_organization_memberships(zolexora_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_memberships_org_phone
    ON public.zolexora_organization_memberships(organization_id, phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_memberships_phone ON public.zolexora_organization_memberships(phone_number);
-- The legacy `role` and `permissions` columns are superseded by zolexora_member_roles (ADR 0005).

-- ------------------------------------------------------------------------------
-- 4. Members: people (Track 1 accounts) and employees (Track 2) of a business
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zolexora_org_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.zolexora_organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
    employee_id     UUID UNIQUE REFERENCES public.zolexora_organization_memberships(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    invited_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_org_members_kind CHECK ((user_id IS NULL) <> (employee_id IS NULL)),
    CONSTRAINT uq_org_members_person UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.zolexora_org_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.zolexora_org_members(user_id);

-- ------------------------------------------------------------------------------
-- 5. Roles (ADR 0005). Built-in business roles get their permissions from code;
--    their rows here hold only the business's own blocks.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zolexora_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.zolexora_organizations(id) ON DELETE CASCADE,
    scope           TEXT NOT NULL CHECK (scope ~ '^[a-z][a-z0-9_]{1,30}$'), -- 'org' or a product key
    key             TEXT NOT NULL CHECK (key ~ '^[a-z0-9_]{2,40}$'),
    name            TEXT NOT NULL,
    built_in        BOOLEAN NOT NULL DEFAULT false,
    disabled        BOOLEAN NOT NULL DEFAULT false,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_roles_org_scope_key UNIQUE (organization_id, scope, key),
    CONSTRAINT chk_roles_builtin_scope CHECK (NOT built_in OR scope = 'org'),
    CONSTRAINT chk_roles_owner_enabled CHECK (NOT (built_in AND key = 'owner' AND disabled))
);

CREATE TABLE IF NOT EXISTS public.zolexora_role_permissions (
    role_id        UUID NOT NULL REFERENCES public.zolexora_roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    effect         TEXT NOT NULL DEFAULT 'grant' CHECK (effect IN ('grant', 'block')),
    PRIMARY KEY (role_id, permission_key)
);

-- One business role and at most one role per product, per member.
CREATE TABLE IF NOT EXISTS public.zolexora_member_roles (
    member_id UUID NOT NULL REFERENCES public.zolexora_org_members(id) ON DELETE CASCADE,
    scope     TEXT NOT NULL,
    role_id   UUID NOT NULL REFERENCES public.zolexora_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (member_id, scope)
);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON public.zolexora_member_roles(role_id);

CREATE TABLE IF NOT EXISTS public.zolexora_member_overrides (
    member_id      UUID NOT NULL REFERENCES public.zolexora_org_members(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    effect         TEXT NOT NULL CHECK (effect IN ('grant', 'block')),
    granted_by     UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, permission_key)
);

-- Every business gets the four built-in roles.
CREATE OR REPLACE FUNCTION public.zolexora_create_builtin_roles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.zolexora_roles (organization_id, scope, key, name, built_in)
  VALUES (NEW.id, 'org', 'owner', 'Owner', true), (NEW.id, 'org', 'admin', 'Admin', true),
         (NEW.id, 'org', 'manager', 'Manager', true), (NEW.id, 'org', 'member', 'Member', true)
  ON CONFLICT (organization_id, scope, key) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zolexora_orgs_builtin_roles ON public.zolexora_organizations;
CREATE TRIGGER trg_zolexora_orgs_builtin_roles
    AFTER INSERT ON public.zolexora_organizations
    FOR EACH ROW EXECUTE FUNCTION public.zolexora_create_builtin_roles();

-- Existing businesses and employees join the new model.
INSERT INTO public.zolexora_roles (organization_id, scope, key, name, built_in)
SELECT o.id, 'org', r.key, r.name, true
FROM public.zolexora_organizations o
CROSS JOIN (VALUES ('owner', 'Owner'), ('admin', 'Admin'), ('manager', 'Manager'), ('member', 'Member')) AS r(key, name)
ON CONFLICT (organization_id, scope, key) DO NOTHING;

INSERT INTO public.zolexora_org_members (organization_id, employee_id, status)
SELECT e.organization_id, e.id, CASE WHEN e.status = 'active' THEN 'active' ELSE 'suspended' END
FROM public.zolexora_organization_memberships e
ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO public.zolexora_member_roles (member_id, scope, role_id)
SELECT m.id, 'org', r.id
FROM public.zolexora_org_members m
JOIN public.zolexora_organization_memberships e ON e.id = m.employee_id
JOIN public.zolexora_roles r ON r.organization_id = m.organization_id AND r.scope = 'org'
 AND r.key = CASE WHEN e.role IN ('owner', 'admin', 'manager') THEN e.role ELSE 'member' END
ON CONFLICT (member_id, scope) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. Invites (7-day links; only a hash of the token is stored)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zolexora_org_invites (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID NOT NULL REFERENCES public.zolexora_organizations(id) ON DELETE CASCADE,
    kind               TEXT NOT NULL CHECK (kind IN ('person', 'employee')),
    email              TEXT CHECK (email IS NULL OR email = lower(email)),
    phone_number       TEXT CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$'),
    org_role_id        UUID NOT NULL REFERENCES public.zolexora_roles(id) ON DELETE CASCADE,
    product_roles      JSONB NOT NULL DEFAULT '{}'::jsonb, -- { "<product>": "<role id>" }
    token_hash         TEXT NOT NULL UNIQUE,
    invited_by         UUID REFERENCES public.zolexora_org_members(id) ON DELETE SET NULL,
    expires_at         TIMESTAMPTZ NOT NULL,
    accepted_at        TIMESTAMPTZ,
    accepted_member_id UUID,
    revoked_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_invites_contact CHECK (email IS NOT NULL OR phone_number IS NOT NULL),
    CONSTRAINT chk_invites_person_email CHECK (kind = 'employee' OR email IS NOT NULL)
);
-- Admin force reset: the link sets a new password for this existing employee instead of creating one.
ALTER TABLE public.zolexora_org_invites ADD COLUMN IF NOT EXISTS reset_member_id UUID REFERENCES public.zolexora_org_members(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON public.zolexora_org_invites(organization_id);

-- ------------------------------------------------------------------------------
-- 7. Permission catalog registered by products (ADR 0005 §2)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zolexora_permission_catalog (
    key         TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$'),
    product     TEXT NOT NULL,
    description TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_removal', 'retired')),
    version     INTEGER NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_catalog_own_prefix CHECK (split_part(key, ':', 1) = product),
    CONSTRAINT chk_catalog_reserved CHECK (product NOT IN ('org', 'common'))
);
CREATE INDEX IF NOT EXISTS idx_permission_catalog_product ON public.zolexora_permission_catalog(product);

CREATE TABLE IF NOT EXISTS public.zolexora_catalog_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product     TEXT NOT NULL,
    version     INTEGER NOT NULL,
    permissions JSONB NOT NULL, -- full list as registered: [{key, description}]
    added       JSONB NOT NULL DEFAULT '[]'::jsonb,
    removed     JSONB NOT NULL DEFAULT '[]'::jsonb,
    status      TEXT NOT NULL CHECK (status IN ('applied', 'pending_approval', 'approved', 'rejected')),
    decided_by  TEXT,
    decided_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_catalog_versions UNIQUE (product, version)
);

-- ------------------------------------------------------------------------------
-- 8. Sessions (refresh-token rotation), MFA, login attempts (ADR 0005 §6)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zolexora_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id         UUID NOT NULL REFERENCES public.zolexora_org_members(id) ON DELETE CASCADE,
    product           TEXT,
    refresh_hash      TEXT NOT NULL UNIQUE,
    prev_refresh_hash TEXT,
    mfa_at            TIMESTAMPTZ,
    user_agent        TEXT,
    ip                TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL,
    revoked_at        TIMESTAMPTZ,
    revoked_reason    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_member ON public.zolexora_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_prev_hash ON public.zolexora_sessions(prev_refresh_hash);

CREATE TABLE IF NOT EXISTS public.zolexora_mfa_factors (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID UNIQUE REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
    employee_id      UUID UNIQUE REFERENCES public.zolexora_organization_memberships(id) ON DELETE CASCADE,
    secret_encrypted TEXT NOT NULL,
    confirmed_at     TIMESTAMPTZ,
    last_used_step   BIGINT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_mfa_factor_owner CHECK ((user_id IS NULL) <> (employee_id IS NULL))
);

CREATE TABLE IF NOT EXISTS public.zolexora_login_attempts (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key     TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    ip      TEXT,
    at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_key_at ON public.zolexora_login_attempts(key, at);

-- ------------------------------------------------------------------------------
-- 9. Verification (ADR 0004 §4, option C)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zolexora_payout_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.zolexora_organizations(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('bank', 'upi')),
    holder_name     TEXT NOT NULL,
    value_encrypted TEXT NOT NULL, -- {"account_number","ifsc"} or {"vpa"}
    value_last4     TEXT NOT NULL,
    ifsc            TEXT CHECK (ifsc IS NULL OR ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_payout_ifsc CHECK ((kind = 'bank') = (ifsc IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_accounts_primary
    ON public.zolexora_payout_accounts(organization_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS public.zolexora_verifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
    organization_id   UUID REFERENCES public.zolexora_organizations(id) ON DELETE CASCADE,
    payout_account_id UUID REFERENCES public.zolexora_payout_accounts(id) ON DELETE CASCADE,
    check_type        TEXT NOT NULL CHECK (check_type IN ('identity', 'pan', 'gst', 'registration', 'authority', 'bank')),
    status            TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'needs_revision')),
    provider          TEXT NOT NULL,
    method            TEXT,
    provider_ref      TEXT,
    value_encrypted   TEXT,
    value_last4       TEXT,
    registered_name   TEXT,
    document_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
    details           JSONB NOT NULL DEFAULT '{}'::jsonb, -- non-secret facts only
    reason            TEXT,
    submitted_by      TEXT,
    decided_by        TEXT,
    decided_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_verifications_subject CHECK ((user_id IS NULL) <> (organization_id IS NULL)),
    CONSTRAINT chk_verifications_payout CHECK (payout_account_id IS NULL OR (organization_id IS NOT NULL AND check_type = 'bank')),
    CONSTRAINT chk_verifications_identity CHECK ((check_type = 'identity') = (user_id IS NOT NULL)),
    CONSTRAINT uq_verifications_subject_check UNIQUE NULLS NOT DISTINCT (user_id, organization_id, payout_account_id, check_type)
);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON public.zolexora_verifications(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_verifications_org ON public.zolexora_verifications(organization_id);

CREATE TABLE IF NOT EXISTS public.zolexora_verification_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES public.zolexora_verifications(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    method          TEXT,
    paid            BOOLEAN NOT NULL DEFAULT false,
    outcome         TEXT NOT NULL,
    registered_name TEXT,
    note            TEXT,
    actor_id        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_v ON public.zolexora_verification_attempts(verification_id, created_at);

-- Accepted documents, with the official place to download the authentic PDF.
CREATE TABLE IF NOT EXISTS public.zolexora_verification_document_types (
    key            TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
    label          TEXT NOT NULL,
    check_type     TEXT NOT NULL CHECK (check_type IN ('identity', 'pan', 'gst', 'registration', 'authority')),
    business_kinds JSONB NOT NULL DEFAULT '[]'::jsonb, -- empty = every kind
    official_url   TEXT,
    verify_url     TEXT, -- the free government page an admin checks it on
    instructions   TEXT NOT NULL,
    active         BOOLEAN NOT NULL DEFAULT true,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.zolexora_verification_document_types
  (key, label, check_type, business_kinds, official_url, verify_url, instructions, sort_order) VALUES
  ('e_pan', 'e-PAN (PDF)', 'pan', '[]', 'https://www.incometax.gov.in', 'https://www.incometax.gov.in',
   'Go to incometax.gov.in → Instant e-PAN → Check Status / Download e-PAN, enter the PAN and the OTP, and download the PDF. If your PAN came from Protean (NSDL) or UTIITSL, download the e-PAN from their site. Upload the PDF as downloaded: no scans, photos or edits. Its password is usually the date of birth or incorporation as DDMMYYYY.', 10),
  ('e_pan_person', 'e-PAN of the person (PDF)', 'identity', '[]', 'https://www.incometax.gov.in', 'https://www.incometax.gov.in',
   'Download your own e-PAN PDF from incometax.gov.in (Instant e-PAN → Check Status / Download) and upload it unchanged.', 20),
  ('gst_reg06', 'GST registration certificate (REG-06)', 'gst', '[]', 'https://www.gst.gov.in', 'https://services.gst.gov.in/services/searchtp',
   'Log in at gst.gov.in → Services → User Services → View/Download Certificates → Download. Upload the PDF unchanged.', 30),
  ('udyam', 'Udyam registration certificate', 'registration', '["proprietor"]', 'https://udyamregistration.gov.in', 'https://udyamregistration.gov.in',
   'Udyam registration is free and online with Aadhaar at udyamregistration.gov.in. Log in, print the certificate to PDF and upload it.', 40),
  ('reg_gst_certificate', 'GST certificate (as business registration)', 'registration', '["proprietor"]', 'https://www.gst.gov.in', 'https://services.gst.gov.in/services/searchtp',
   'Log in at gst.gov.in → Services → User Services → View/Download Certificates → Download, and upload the PDF unchanged.', 50),
  ('shop_establishment', 'Shop & Establishment licence', 'registration', '["proprietor"]', NULL, NULL,
   'Download the licence PDF from your state labour department portal (or scan the original if it was issued on paper).', 60),
  ('trade_licence', 'Trade licence', 'registration', '["proprietor"]', NULL, NULL,
   'Upload the trade licence issued by your municipal corporation or local body.', 70),
  ('fssai', 'FSSAI licence / registration', 'registration', '["proprietor"]', 'https://foscos.fssai.gov.in', 'https://foscos.fssai.gov.in',
   'Log in at foscos.fssai.gov.in and download the licence or registration certificate PDF.', 80),
  ('incorporation_certificate', 'Certificate of incorporation (MCA)', 'registration', '["company", "llp"]', 'https://www.mca.gov.in', 'https://www.mca.gov.in',
   'Upload the certificate of incorporation issued by the Registrar of Companies (MCA). Give the CIN or LLPIN too; an admin checks it against MCA master data.', 90),
  ('partnership_deed', 'Partnership deed', 'registration', '["partnership"]', NULL, NULL,
   'Upload the signed partnership deed, and the Registrar of Firms certificate if the firm is registered.', 100),
  ('huf_declaration', 'HUF declaration', 'registration', '["huf"]', NULL, NULL,
   'Upload the HUF declaration signed by the karta and the adult members.', 110),
  ('trust_deed', 'Trust deed or registration certificate', 'registration', '["trust"]', NULL, NULL,
   'Upload the registered trust deed or the registration certificate.', 120),
  ('society_certificate', 'Registration certificate (society / co-operative)', 'registration', '["society"]', NULL, NULL,
   'Upload the registration certificate issued by the Registrar of Societies or Co-operatives.', 130),
  ('board_resolution', 'Board resolution', 'authority', '["company"]', NULL, 'https://www.mca.gov.in',
   'Upload a board resolution authorising you to act for the company, unless you are a director listed on MCA.', 140),
  ('authorisation_letter', 'Authorisation letter', 'authority', '["company", "llp", "partnership", "huf", "trust", "society", "public_body"]', NULL, NULL,
   'Upload a signed letter on the organisation''s letterhead that names you as authorised to act for it.', 150)
ON CONFLICT (key) DO NOTHING;

-- updated_at triggers for the new tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['zolexora_org_members', 'zolexora_roles', 'zolexora_payout_accounts', 'zolexora_verifications',
                           'zolexora_activity_groups', 'zolexora_verification_document_types', 'zolexora_permission_catalog']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

COMMIT;
