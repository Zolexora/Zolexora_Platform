# MR-02 — PostgreSQL Foundation and Data Convergence

## Outcome

- Starting SHA: `b405b4a8f25dcf638d8f7cd88068597b98776fb8`.
- Final SHA: the single MR-02 commit containing this report (`HEAD` after commit); its resolved SHA and remote equality are recorded in the final handoff because a commit cannot contain its own hash.
- Verdict: **PASS — MR-02 complete; wait for authorization for MR-03**.

## Decision and implementation

[ADR 0014](../../../docs/decisions/0014-postgresql-marketplace-foundation.md) establishes PostgreSQL 16+ as the canonical provider-independent Marketplace transactional database, configured only through a standard `DATABASE_URL`. Alembic is the forward-only schema authority; startup performs no schema creation or migration. Runtime uses one bounded asyncpg pool, graceful shutdown, request-scoped connections, explicit transaction contexts, schema-current readiness, and database-independent liveness.

Active revision chain: `base -> 0001_postgresql_foundation (head)`. The superseded Oracle revision remains historical and outside the active `version_locations`.

Canonical tables: `users`, `buyer_address`, `storefront`, `storefront_domain`, `product`, `listing`, `inventory_balance`, `cart`, `cart_item`, `marketplace_order`, `order_item`, `payment_record`, `refund_record`, `shipment`, `idempotency_record`, `integration_outbox`, `external_reference`, and `audit_event`.

The schema uses explicit UUID PK/FKs and deliberate delete behavior; UTC `timestamptz` defaults and server update triggers; bigint minor-unit money and inventory bounded by `9,007,199,254,740,991`; generated available inventory; controlled status checks; scoped unique/composite foreign keys; partial active-cart/default-address/primary-domain indexes; seller/storefront listing indexes; buyer/seller order indexes; and idempotency, outbox, audit, shipment, and provider-neutral reference indexes. No credential columns exist.

`PostgresCatalogRepository` proves deterministic pagination and the seller boundary `storefront_id + seller_id + listing_id`; inventory mutation first resolves that exact listing scope and joins inventory by `product_id + seller_id`. Admin access remains authenticated by the existing role dependency and resource reads remain `storefront_id + target identifier`; MR-02 does not weaken MR-01G filters. Low-level repositories do not commit. Multi-write address handling and the shared transaction context commit on success and rollback on failure.

## Real PostgreSQL evidence

Tests use pinned `postgres:16.4-alpine` in an isolated localhost-only Compose service with fixed test-only credentials and tmpfs storage. The fixture drops/recreates only its disposable `public` schema, upgrades an empty database to head, fingerprints tables/constraints/indexes, upgrades to head again, and proves the fingerprint is unchanged.

- Empty database to head: passed; current revision `0001_postgresql_foundation`.
- Second upgrade: passed as a schema no-op.
- Focused PostgreSQL suite: 38 passed.
- Full backend: 252 passed versus baseline 232 (+20).
- Real constraints: invalid FK, duplicate scoped listing, cross-store cart/listing relation, negative/overflow inventory, invalid lifecycle, and money bounds rejected.
- Transactions: atomic commit, failed multi-write rollback, explicit rollback, reusable connection, and rejected scoped mutation with no side effect passed.
- Repositories/readiness: owned scope, cross-store/seller not-found, deterministic pagination, pool lifecycle/bounds, current-schema readiness, safe unavailable readiness, and database-independent liveness passed.

## Verification

| Command/check | Result |
| --- | --- |
| Ruff on changed Python and full backend | exit 0 |
| Focused PostgreSQL tests | exit 0; 38 passed |
| MR-01 contract/isolation regressions | exit 0; 117 passed |
| Full backend pytest | exit 0; 252 passed |
| `pnpm verify:database` | exit 0; one PostgreSQL head and deterministic offline SQL |
| Workspace `pnpm type-check` | exit 0; 7 tasks, 10 packages verified |
| `pnpm verify` | exit 0; lint, tests, builds, backend, database, contracts, and OpenAPI drift passed |
| OpenAPI/TypeScript generation | not required; no public schema changed; drift check exit 0 |
| Affected applications | type-check/build exit 0 through workspace verification |
| Backend Python static typing | NOT CONFIGURED |
| `git diff --check` | exit 0 |

## Convergence and deferrals

`oracledb` and Oracle configuration/SQL/readiness were removed from active runtime code and dependencies; Oracle-only active validators/tests were retired. The historical Oracle migration and documentation remain for evidence. Supabase database DSN fallback was removed; Supabase Auth and legacy SQL definitions remain transitional, not canonical database initialization paths.

[Legacy import design](../../../docs/legacy-data-import-postgresql.md) defines deterministic UUIDv5 mapping, conflicts, dry-run, reconciliation, transactional import, and rollback. MongoDB/Supabase import tooling, customer-data import, dual-write, production cutover, commission/settlement, warehouse allocation/reservations, granular admin grants, ERP synchronization, and admin inventory authority remain explicitly unimplemented/deferred.

No production database, customer data, cloud provider, MongoDB/Supabase service, Oracle, ERP, payment, shipping, storage, DNS, or deployed environment was contacted or changed. Only the disposable localhost PostgreSQL test container was used; Docker retrieved the pinned public PostgreSQL image when absent. No actual `.env`, ignored production environment file, credential value, key, database dump, migration source data, deployment, or cloud resource was inspected or changed. Commit/push and exact zero-divergence evidence follow immediately after this report is staged and are recorded in the final handoff.

## Exact files changed

- `docker-compose.yml`
- `docs/decisions/0014-postgresql-marketplace-foundation.md`
- `docs/legacy-data-import-postgresql.md`
- `docs/memory.md`
- `infrastructure/docker/postgres-test.compose.yml`
- `package.json`
- `docs/status/audits/mr-02-postgresql-foundation-data-convergence.md`
- `docs/status/current-status.md`
- `docs/status/next-actions.md`
- `scripts/validate-oracle-schema.py` (removed)
- `scripts/validate-postgresql-schema.py`
- `scripts/verify-oracle-runtime.py` (removed)
- `services/.env.example`
- `services/marketplace-api/.env.example`
- `services/marketplace-api/alembic.ini`
- `services/marketplace-api/core/config.py`
- `services/marketplace-api/database/__init__.py`
- `services/marketplace-api/database/config.py`
- `services/marketplace-api/database/engine.py`
- `services/marketplace-api/database/models.py`
- `services/marketplace-api/database/repositories/__init__.py`
- `services/marketplace-api/database/repositories/catalog.py`
- `services/marketplace-api/database/repositories/storefronts.py`
- `services/marketplace-api/database/session.py`
- `services/marketplace-api/main.py`
- `services/marketplace-api/migrations/README.md`
- `services/marketplace-api/migrations/env.py`
- `services/marketplace-api/migrations/postgresql_versions/0001_postgresql_foundation_postgresql_foundation.py`
- `services/marketplace-api/requirements.txt`
- `services/marketplace-api/scripts/bootstrap_storefronts.py`
- `services/marketplace-api/shared/database/postgres.py`
- `services/marketplace-api/storefronts/dependencies.py`
- `services/marketplace-api/tests/test_oracle_persistence.py` (removed)
- `services/marketplace-api/tests/test_postgresql_foundation.py`
- `services/marketplace-api/tests/test_startup_config.py`
- `services/marketplace-api/users/repositories.py`
- `services/marketplace-api/users/router.py`
