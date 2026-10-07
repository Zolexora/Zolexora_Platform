-- =============================================================================
-- Zolexora — Sprint 1 & 2 Supabase Migration
-- Run once in the Supabase SQL Editor (New query → Run)
-- =============================================================================
-- This DDL implements the full relational schema from the architecture audit,
-- replacing the old single-table mirror with a proper normalised design.
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- =============================================================================
-- 1. Core users table
-- =============================================================================
create table if not exists public.users (
    id                uuid        primary key default uuid_generate_v4(),
    email             text        unique not null,
    name              text        not null,
    role              text        not null default 'viewer'
                                  check (role in ('viewer', 'seller', 'admin')),
    coin_balance      integer     not null default 0 check (coin_balance >= 0),
    is_active         boolean     not null default true,
    is_email_verified boolean     not null default false,
    auth_provider     text        not null default 'email',
    picture           text,
    created_at        timestamptz not null default timezone('utc'::text, now())
);

-- Separate credential table so RLS can block hash reads from the API layer.
-- The password_hash is NEVER returned by the users table — it lives here.
create table if not exists public.user_credentials (
    user_id uuid primary key references public.users(id) on delete cascade,
    hash    text not null
);

-- =============================================================================
-- 2. Seller profiles
-- =============================================================================
create table if not exists public.seller_profiles (
    id                  uuid primary key references public.users(id) on delete cascade,
    company_name        text not null,
    gstin               text,
    phone               text not null,
    pickup_address      text not null,
    pincode             text not null,
    city                text not null,
    state               text not null,
    verification_status text not null default 'pending'
                         check (verification_status in ('pending', 'approved', 'rejected')),
    created_at          timestamptz not null default timezone('utc'::text, now())
);

-- =============================================================================
-- 3. Buyer delivery addresses
-- =============================================================================
create table if not exists public.buyer_addresses (
    id           uuid        primary key default uuid_generate_v4(),
    buyer_id     uuid        not null references public.users(id) on delete cascade,
    name         text        not null,
    phone        text        not null,
    address_line text        not null,
    city         text        not null,
    state        text        not null,
    pincode      text        not null,
    is_default   boolean     not null default false,
    created_at   timestamptz not null default timezone('utc'::text, now())
);

-- =============================================================================
-- 4. Seller subscriptions
-- =============================================================================
create table if not exists public.seller_subscriptions (
    id         uuid        primary key default uuid_generate_v4(),
    seller_id  uuid        not null references public.seller_profiles(id) on delete cascade,
    plan_type  text        not null check (plan_type in ('basic', 'premium')),
    status     text        not null default 'active'
                            check (status in ('active', 'expired', 'cancelled')),
    starts_at  timestamptz not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- =============================================================================
-- 5. Orders
-- =============================================================================
create table if not exists public.orders (
    id               uuid         primary key default uuid_generate_v4(),
    buyer_id         uuid         not null references public.users(id),
    seller_id        uuid         not null references public.users(id),
    subtotal         numeric(12,2) not null,
    coins_used       integer      not null default 0,
    coins_discount   numeric(12,2) not null default 0.00,
    total_paid       numeric(12,2) not null,
    payment_method   text         not null
                      check (payment_method in ('razorpay', 'upi', 'coins')),
    payment_status   text         not null default 'pending'
                      check (payment_status in ('pending', 'awaiting_verification', 'paid', 'failed')),
    status           text         not null default 'pending'
                      check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    delivery_address jsonb        not null,
    admin_note       text,
    created_at       timestamptz  not null default timezone('utc'::text, now()),
    updated_at       timestamptz  not null default timezone('utc'::text, now())
);

-- =============================================================================
-- 6. Order line items
-- =============================================================================
create table if not exists public.order_items (
    id            uuid         primary key default uuid_generate_v4(),
    order_id      uuid         not null references public.orders(id) on delete cascade,
    product_id    text         not null,   -- MongoDB product document _id
    product_title text         not null,
    price         numeric(12,2) not null,
    quantity      integer      not null check (quantity > 0),
    image_url     text
);

-- =============================================================================
-- 7. Payment ledger (Razorpay + UPI)
-- =============================================================================
create table if not exists public.payment_ledger (
    id                    uuid         primary key default uuid_generate_v4(),
    order_id              uuid         references public.orders(id) on delete set null,
    user_id               uuid         not null references public.users(id),
    amount                numeric(12,2) not null,
    gateway               text         not null check (gateway in ('razorpay', 'upi')),
    transaction_reference text         unique not null,
    status                text         not null
                           check (status in ('pending', 'success', 'failed')),
    created_at            timestamptz  not null default timezone('utc'::text, now())
);

-- =============================================================================
-- Indexes
-- =============================================================================
create index if not exists idx_users_email         on public.users(lower(email));
create index if not exists idx_users_role          on public.users(role);
create index if not exists idx_buyer_addresses     on public.buyer_addresses(buyer_id);
create index if not exists idx_orders_buyer        on public.orders(buyer_id);
create index if not exists idx_orders_seller       on public.orders(seller_id);
create index if not exists idx_order_items_order   on public.order_items(order_id);
create index if not exists idx_payment_ledger_user on public.payment_ledger(user_id);
create index if not exists idx_subs_seller         on public.seller_subscriptions(seller_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.users             enable row level security;
alter table public.user_credentials  enable row level security;
alter table public.buyer_addresses   enable row level security;
alter table public.seller_profiles   enable row level security;
alter table public.seller_subscriptions enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.payment_ledger    enable row level security;

-- NOTE: The FastAPI backend connects via the service-role key only from the
-- server-side asyncpg pool — never from the browser.  RLS is a defence-in-depth
-- measure; the API enforces its own authorisation layer on top.
-- Add granular user-facing RLS policies here when implementing the Supabase
-- Realtime / direct client feature set.
