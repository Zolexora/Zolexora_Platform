-- Phase 1: Partner Zolexora IDs registry for external (non-TMS) Clients (c<random>@zolexora.com)
-- and Vendors / Service Providers (v<random>@zolexora.com) in Auth DB.

CREATE TABLE IF NOT EXISTS zolexora_partner_ids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zolexora_id VARCHAR(64) NOT NULL,
    partner_kind VARCHAR(16) NOT NULL CHECK (partner_kind IN ('client', 'vendor')),
    owner_org_id UUID NULL,
    display_name VARCHAR(200) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_zolexora_partner_ids_id_ci
    ON zolexora_partner_ids (LOWER(TRIM(zolexora_id)));
