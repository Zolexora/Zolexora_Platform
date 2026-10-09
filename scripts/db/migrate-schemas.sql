-- ==============================================================================
-- ZOLEXORA PLATFORM — MASTER SCHEMA MIGRATION SCRIPT
-- ==============================================================================
-- Run this script on each of the 4 core Supabase projects to initialize the
-- isolated schemas for the products hosted on that project.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. zolexora-core (IMS, Marketplace, TMS)
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS ims;
CREATE SCHEMA IF NOT EXISTS marketplace;
CREATE SCHEMA IF NOT EXISTS tms;

-- IMS Tables (Basic scaffolding)
CREATE TABLE IF NOT EXISTS ims.products (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    sku           TEXT UNIQUE,
    stock_qty     INTEGER DEFAULT 0,
    price         NUMERIC(10,2),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace Tables
CREATE TABLE IF NOT EXISTS marketplace.sellers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    verified      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- TMS Tables
CREATE TABLE IF NOT EXISTS tms.shipments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_no   TEXT UNIQUE NOT NULL,
    status        TEXT DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. zolexora-commerce (Textile Care, Rento Easy, Platform Admin)
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS textile_care;
CREATE SCHEMA IF NOT EXISTS rento_easy;
CREATE SCHEMA IF NOT EXISTS platform_admin;

-- Textile Care Tables
CREATE TABLE IF NOT EXISTS textile_care.orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    service_type  TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Rento Easy Tables
CREATE TABLE IF NOT EXISTS rento_easy.rentals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id       UUID NOT NULL,
    renter_id     UUID NOT NULL,
    start_date    DATE,
    end_date      DATE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Admin Tables (Central router config overrides if any)
CREATE TABLE IF NOT EXISTS platform_admin.global_settings (
    key           TEXT PRIMARY KEY,
    value         JSONB,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. zolexora-business (Engage, Clarity FI, Maun Kavach)
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS engage;
CREATE SCHEMA IF NOT EXISTS clarity_fi;
CREATE SCHEMA IF NOT EXISTS maun_kavach;

-- Engage Tables
CREATE TABLE IF NOT EXISTS engage.campaigns (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    status        TEXT DEFAULT 'DRAFT',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Clarity FI Tables
CREATE TABLE IF NOT EXISTS clarity_fi.transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    UUID NOT NULL,
    amount        NUMERIC(12,2) NOT NULL,
    type          TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Maun Kavach Tables
CREATE TABLE IF NOT EXISTS maun_kavach.incidents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description   TEXT,
    severity      TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. zolexora-ai-erp (Zolexora AI, ERP supplements)
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS zolexora_ai;
CREATE SCHEMA IF NOT EXISTS erp_supplements;

-- Zolexora AI Tables (Note: most AI data should be in MongoDB, this is for structured AI metadata)
CREATE TABLE IF NOT EXISTS zolexora_ai.models (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT UNIQUE NOT NULL,
    version       TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ERP Supplements Tables
CREATE TABLE IF NOT EXISTS erp_supplements.custom_fields (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   TEXT NOT NULL,
    field_name    TEXT NOT NULL,
    field_type    TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - Example for IMS
-- (Apply similar patterns to all schemas when full RLS is defined)
-- ==============================================================================
ALTER TABLE ims.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ims_isolation" ON ims.products
    USING (current_setting('app.product', true) = 'ims');
