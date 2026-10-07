-- Run once in Supabase SQL Editor → New query

create table if not exists public.users (
  id                       text primary key,
  email                    text unique not null,
  name                     text not null,
  role                     text not null default 'viewer',
  coin_balance             int  not null default 0,
  subscription_plan        text,
  subscription_expires_at  timestamptz,
  is_active                bool not null default true,
  is_email_verified        bool not null default false,
  auth_provider            text not null default 'email',
  picture                  text,
  created_at               timestamptz not null default now()
);
alter table public.users enable row level security;
create index if not exists users_email_idx on public.users(email);
create index if not exists users_role_idx  on public.users(role);

-- Cloudinary handles ALL file storage — NO storage buckets needed in Supabase
-- Storage buckets to create in Cloudinary Dashboard (auto-created on first upload):
--   zolexora/products/   → product images
--   zolexora/reels/      → reel videos & thumbnails
--   zolexora/avatars/    → user profile pictures
