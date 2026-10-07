# ADR 0016: Firebase identity and marketplace user-management RBAC

- Status: Accepted
- Date: 2026-08-19

## Decision

Firebase Authentication is the only credential and provider identity system.
Marketplace PostgreSQL stores application metadata, lifecycle status, provider
links, separated administrator records, permissions, and immutable admin audit
events. Migrations `0013` through `0015` implement this model forward-only.
Firebase is the only password store; PostgreSQL no longer has `password_hash`
or the legacy `identity_source` field. Provider type/primary-provider columns
are also intentionally absent: a verified Firebase UID can use any enabled
Firebase sign-in method.

Administrators are represented only in `public.admins`, identified by their
verified Firebase email. They are not rows in `public.users` and have no
Firebase UID bridge column. Admin operations require server-side membership and
granular permissions; only a super-admin can create administrators or change
administrator roles; user status changes increment `auth_version` and are
audited transactionally.

## Consequences

- Firebase provider credentials are never copied into PostgreSQL.
- Existing Firebase `external_identity` rows remain compatible while provider
  usage is tracked in `user_auth_providers`.
- Direct Supabase clients are constrained by RLS policies; FastAPI remains the
  authoritative authorization boundary.
- All public tables have RLS enabled. Identity metadata has explicit
  least-privilege policies; tables without a policy deny direct client access.
