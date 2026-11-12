# ADR 0010: Oracle Marketplace persistence foundation

- Status: Superseded by [ADR 0012](0012-marketplace-cloud-agnostic-baseline.md)
- Date: 2026-07-15

## Context

Marketplace needs durable storefront identity and reliable asynchronous integration records without copying transitional MongoDB/Supabase data or coupling to independent Zolexora ERP internals.

## Decision

Use SQLAlchemy 2.x, Alembic, and python-oracledb thin mode as the single Oracle persistence and migration stack. Use forward-only migrations, repository-backed production storefront resolution, explicit idempotent bootstrap, JSON CLOB checks, and separate liveness/readiness. Storefront-to-ERP mapping remains inactive configuration and supports one or two ERP organizations.

## Reasons

The stack is mature, Oracle-aware, testable offline, and keeps database models separate from public contracts. Repository injection preserves fail-closed request handling without import-time connections.

## Consequences

Oracle access is synchronous and must run outside the event loop. An Oracle outage makes storefront-required routes and readiness unavailable without selecting a fallback. SQLite cannot prove compatibility. Oracle DDL repairs are forward-only.

## Alternatives considered

- Raw SQL only: rejected because it duplicates model and repository metadata.
- `metadata.create_all()`: rejected because it provides no reviewable migration history.
- Async Oracle claims: rejected because the current stack does not establish an accepted async architecture.
- Persisting in MongoDB/Supabase first: rejected as throwaway migration work.

## Affected modules

Database infrastructure, storefront resolution, health/readiness, ERP reliability records, CI, and local runbooks.

## Implementation phase

Phase 4. Real Oracle execution and OCI provisioning remain blocked/deferred.
