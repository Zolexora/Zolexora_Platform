-- PostgreSQL Schema for Zolexora Multi-Tenant Organizations & RBAC

CREATE TABLE IF NOT EXISTS public.zolexora_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zolexora_org_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE CHECK (slug = lower(slug)),
  name TEXT NOT NULL,
  logo_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_organizations_zolexora_org_id ON public.zolexora_organizations(zolexora_org_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.zolexora_organizations(slug);

CREATE TABLE IF NOT EXISTS public.zolexora_organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.zolexora_organizations(id) ON DELETE CASCADE,
  zolexora_org_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  zolexora_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_zolexora_id ON public.zolexora_organization_memberships(zolexora_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON public.zolexora_organization_memberships(organization_id);
