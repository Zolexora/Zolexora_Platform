-- =============================================================================
-- Zolexora — Supabase Auth migration notes
-- =============================================================================
-- New accounts now use Supabase Auth for credentials.  The application profile
-- table keeps only app-specific fields and uses auth.users.id as public.users.id.
--
-- For a fresh project:
--   Run supabase_schema_v2.sql only.
--
-- For an existing project:
--   1. Create/migrate each existing email account in Supabase Auth.
--   2. Update public.users.id to the matching auth.users.id, cascading that id
--      into any referencing tables as needed.
--   3. After every account has been migrated, remove the legacy credential table.
-- =============================================================================

drop table if exists public.user_credentials;
