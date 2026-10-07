# Phase 4 Oracle persistence foundation audit

## Verdict

PASS WITH BLOCKERS. Code, one forward migration head, offline Oracle compilation, repository behavior, fail-closed tests, and root verification pass. No explicit disposable Oracle DSN was available, so real migration/introspection and constraint execution are unverified.

## Starting state

- Branch: `main`
- Commit: `abb2b0a52b5ccd3411273ee05c7f51fb003cbdd8`
- Worktree: clean
- Baseline: 10 packages, 15 client tests, 131 FastAPI tests, full verify passed with `.venv/bin` on PATH.

## Current versus new storage

MongoDB/Motor, Supabase Auth/PostgreSQL/asyncpg, Redis, and Cloudinary remain active transitional dependencies. Phase 4 adds Oracle only for persisted storefront/domain and integration reliability foundations; it imports no legacy data.

## Implementation evidence

- Stack: SQLAlchemy 2.0.51, Alembic 1.18.5, python-oracledb 3.4.2 thin mode.
- Migration head: `0001_oracle_foundation`.
- Tables: storefront, storefront_domain, external_system, external_tenant, external_organization, external_entity_mapping, storefront_erp_mapping, integration_outbox, integration_inbox, integration_delivery_attempt, integration_dead_letter, reconciliation_run, reconciliation_issue.
- Exact domain uniqueness, active-primary function index, JSON checks, tenant/event and outbox idempotency uniqueness, non-cascading history FKs, claim index, and mapping-period rules are represented.
- Bootstrap is explicit, dry-run by default, idempotent, conflict-detecting, and ERP-mapping-free.
- Production dependencies use `OracleStorefrontRepository`; static registry is test/bootstrap fixture only.
- Oracle absence returns safe readiness/storefront failures without credentials.

## Validation

`scripts/validate-oracle-schema.py`, Alembic head inspection, and Oracle-dialect offline SQL generation passed. SQLite was not used. Real Oracle execution was not run because no `MARKETPLACE_ORACLE_DSN` was present.

- Focused storefront/Oracle tests: 69 passed.
- Full FastAPI suite: 146 passed; compilation and Ruff passed.
- Root: frozen install, 10 packages, 7/7 type-checks, 2/2 configured lint tasks, 15 client tests, 8/8 builds, and complete verify passed.
- Compose parsing, diff whitespace, one lockfile, and source symlink checks passed.

## Decision gates

The business owner must provide GST/legal evidence for one-company versus two-company configuration, including warehouse, invoice/tax, and payment-account consequences. Status remains unresolved and blocks production mapping activation. ERP v1 adoption and ERP commercial tenant isolation also remain unverified.

## Scope confirmation

No live ERP, worker, webhook, data import, payment, authentication, commerce migration, OCI provisioning, backup, deployment, or remote mutation was performed.
