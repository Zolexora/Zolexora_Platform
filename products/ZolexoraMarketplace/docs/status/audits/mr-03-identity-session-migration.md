# MR-03 — Identity & Session Migration

## Outcome

- Starting SHA: `19ec2c19fa47a58c3ecb84ada439b998a7ce639c`.
- Final SHA: the single MR-03 implementation commit containing this report; the resolved SHA and remote equality are recorded in the final handoff because a commit cannot contain its own hash.
- Verdict: **PASS — MR-03 complete; wait for authorization for MR-04**.

## Decision and implementation

[ADR 0004](../../../docs/decisions/0004-secure-session-architecture.md) now establishes PostgreSQL users/profiles/RBAC as canonical identity authority and Redis as provider-independent ephemeral opaque-session, OTP, pending-registration, and revocation storage through standard `DATABASE_URL`/`REDIS_URL` contracts. Authorization reloads active canonical user/role state per request; JWT claims, client roles, seller identity, and storefront hints have no identity authority.

Revision chain: `base -> 0001_postgresql_foundation -> 0002_identity_session_rbac (head)`. Revision 0002 reuses `users`, adds Argon2id credential/auth-version fields, and creates `user_profile`, `role`, `permission`, `user_role`, and `role_permission`; it deterministically seeds buyer/seller/admin and their fixed permissions. UUID PK/FKs, normalized unique email, one profile/role assignment per user, controlled role/source checks, UTC server timestamps/triggers, coin bounds, and role lookup indexes are enforced. Legacy rows map to profiles and `viewer` maps to `buyer`; unsupported legacy password hashes require reset.

The bounded Redis pool uses namespaced SHA-256 session keys, per-user session sets, server TTL, authentication version, HMAC-digested OTPs, attempt/rate/cooldown limits, and atomic OTP consumption. Browser sessions are host-only `HttpOnly; Secure; Path=/; SameSite=Lax` cookies; unsafe cookie requests require exact trusted Origin plus session-bound double-submit CSRF. Native clients request the same opaque session authority and keep it in Expo SecureStore. Ambiguous cookie/bearer identity is rejected. Login rotates/fixes no supplied token, logout is idempotent, revoke-all bumps `auth_version`, and disabled or role-changed users immediately lose existing access.

Registration creates no privileged role and writes the canonical user/profile/buyer role in one transaction only after atomic OTP verification. Generic login/reset responses prevent account-state disclosure. Current-user contracts exclude credential, OTP, Redis, provider, and unrestricted RBAC metadata. Existing seller boundary `storefront_id + authenticated canonical seller user ID + target identifier` and admin boundary `trusted canonical admin role + storefront_id + target identifier` remain unchanged; MR-01 isolation regressions pass.

Active Supabase Auth/JWT adapters, settings, dependencies, and runtime manifests were removed. The [offline import design](../../../docs/legacy-data-import-postgresql.md) and `migrate_supabase_identities.py` provide dry-run-only deterministic UUID preservation/UUIDv5 mapping, normalized email reconciliation, duplicate/unknown/privileged-role rejection, redaction, and password-reset decisions without network or database writes. Live import, production cutover, customer migration, social login, first-party proxy deployment, session/device management UI, granular storefront admin grants, and seller role-assignment workflows remain deferred.

## Verification

| Check | Result |
| --- | --- |
| Ruff changed Python/full backend | exit 0 |
| Focused MR-03 real PostgreSQL/Redis tests | exit 0; 41 tests |
| MR-01/MR-02 auth, isolation, transaction, readiness regressions | exit 0 |
| Empty database through 0001 to 0002 head | exit 0 |
| Second upgrade to head | exit 0; identical tables/constraints/indexes/revision fingerprint |
| Full backend pytest | exit 0; **293 passed** versus 252 baseline (+41) |
| PostgreSQL schema/Alembic validation | exit 0; one head `0002_identity_session_rbac` |
| OpenAPI and TypeScript generation | exit 0; second-run SHA-256 values identical |
| OpenAPI drift check | exit 0 |
| Shared API, seller/admin, storefront web/mobile type-check/build | exit 0 through workspace verification |
| Workspace type-check/lint/test/build | exit 0 |
| `pnpm verify` | exit 0 |
| Backend Python static typing | NOT CONFIGURED |
| `git diff --check` | exit 0 |

Tests used only disposable localhost `postgres:16.4-alpine` and `redis:7.4.1-alpine` Compose services with test-only values and disposable storage; Docker retrieved the pinned Redis image from its public registry when absent. No production database/Redis, Supabase, cloud, ERP, customer data, email/SMS, payment, shipping, storage, DNS, or deployed service was contacted or changed. No production import, migration execution, deployment, actual `.env`, credential value, password hash, token, OTP, private key, customer export, database dump, or persistent PostgreSQL/Redis data was inspected or committed.

Commit/push result: one commit with message `feat(auth): migrate identity and sessions` is pushed to `origin/mr-03-identity-session-migration`; the resolved commit and zero-divergence evidence are recorded in the final handoff.

## Exact files changed

```text
apps/portals/marketplace-admin/web/src/app/auth/page.tsx
apps/portals/marketplace-admin/web/src/app/users/page.tsx
apps/portals/marketplace-admin/web/src/components/layout/AdminShell.tsx
apps/portals/marketplace-admin/web/src/lib/api.ts
apps/portals/marketplace-admin/web/src/store/index.ts
apps/portals/seller/mobile/app/auth/index.tsx
apps/portals/seller/mobile/src/lib/api.ts
apps/portals/seller/mobile/src/store/index.ts
apps/portals/seller/web/src/app/auth/page.tsx
apps/portals/seller/web/src/components/layout/SellerShell.tsx
apps/portals/seller/web/src/lib/api.ts
apps/portals/seller/web/src/store/index.ts
apps/storefronts/mahila-madel/web/src/context/AuthContext.js
apps/storefronts/mahila-madel/web/src/utils/api.js
apps/storefronts/zolexora-shop/mobile/app/auth/index.tsx
apps/storefronts/zolexora-shop/mobile/src/lib/api.ts
apps/storefronts/zolexora-shop/mobile/src/store/index.ts
apps/storefronts/zolexora-shop/web/src/app/auth/page.tsx
apps/storefronts/zolexora-shop/web/src/lib/api.ts
apps/storefronts/zolexora-shop/web/src/store/index.ts
contracts/marketplace/openapi.json
docs/decisions/0004-secure-session-architecture.md
docs/legacy-data-import-postgresql.md
docs/memory.md
infrastructure/docker/postgres-test.compose.yml
packages/shared-api/src/auth.ts
packages/shared-api/src/client.ts
packages/shared-api/src/generated/types.ts
packages/shared-api/src/types.ts
docs/status/audits/mr-03-identity-session-migration.md
docs/status/current-status.md
docs/status/feature-matrix.md
docs/status/next-actions.md
scripts/check-openapi-drift.sh
scripts/validate-postgresql-schema.py
services/.env.example
services/marketplace-api/.env.example
services/marketplace-api/auth/router.py
services/marketplace-api/auth/schemas.py
services/marketplace-api/auth/services.py
services/marketplace-api/core/config.py
services/marketplace-api/core/deps.py
services/marketplace-api/core/security.py
services/marketplace-api/core/seed.py
services/marketplace-api/core/supabase_client.py (removed)
services/marketplace-api/database/engine.py
services/marketplace-api/database/models.py
services/marketplace-api/main.py
services/marketplace-api/migrations/postgresql_versions/0002_identity_session_rbac_identity_session_rbac.py
services/marketplace-api/pyproject.toml
services/marketplace-api/requirements.txt
services/marketplace-api/routers/auth.py (removed)
services/marketplace-api/routers/other.py
services/marketplace-api/scripts/migrate_supabase_identities.py
services/marketplace-api/shared/database/redis.py
services/marketplace-api/tests/test_admin_seed.py
services/marketplace-api/tests/test_identity_session_migration.py
services/marketplace-api/tests/test_postgres_user_source.py
services/marketplace-api/tests/test_postgresql_foundation.py
services/marketplace-api/tests/test_startup_config.py
services/marketplace-api/users/repositories.py
```
