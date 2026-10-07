# ADR 0014: PostgreSQL Marketplace persistence foundation

- **Status:** Accepted
- **Date:** 2026-08-01
- **Deciders:** Marketplace Architecture & Platform Core Engineering
- **Supersedes:** The active persistence direction in [ADR 0010](0010-oracle-marketplace-persistence-foundation.md); [ADR 0012](0012-marketplace-cloud-agnostic-baseline.md) remains the cloud-agnostic platform baseline.

## Context

MR-01 established canonical storefront, ownership, money, listing, inventory, order, fulfillment, and payment contracts. Marketplace now needs one transactional store that preserves those boundaries without coupling application contracts to a cloud vendor. The retained Oracle proof is historical; transitional MongoDB and Supabase data cannot remain competing relational authorities.

## Decision

PostgreSQL 16 or a compatible later supported PostgreSQL release is the canonical Marketplace transactional database. A standard `DATABASE_URL` is the only database endpoint contract, so the same application can use a self-hosted container, a VM, OCI Database with PostgreSQL, AWS RDS, or another managed PostgreSQL service without changing public or repository contracts.

Alembic owns one forward-only schema chain. Application startup never calls `metadata.create_all()`, applies migrations, or imports customer data. Deterministic UUID identifiers, timezone-aware UTC timestamps, server-controlled audit timestamps, integer minor-unit money, bounded integer inventory, relational foreign keys, controlled lifecycle checks, and storefront/seller compound constraints are database invariants.

The asyncpg pool is process-scoped and provider-neutral. Connections are request-scoped; multi-write application services declare one explicit transaction and low-level repositories neither commit nor return raw rows to public APIs. Liveness is process-only. Readiness requires connectivity and the current Alembic head.

Oracle drivers, configuration, SQL, and verification are removed from active Marketplace runtime paths. The superseded Oracle revision remains outside the active Alembic version location as historical evidence. Marketplace and the independent Zolexora ERP product continue to share no database or runtime dependency.

## Consequences

- PostgreSQL becomes the sole destination for new canonical Marketplace persistence.
- Existing MongoDB and Supabase records require a separately authorized, dry-run-first import before cutover; MR-02 performs no import or production migration.
- Feature repositories can converge incrementally behind the established compound ownership contracts. MR-02 proves the shared foundation and scoped catalog/inventory path rather than rewriting every router.
- Provider credentials, payment credentials, ERP synchronization, settlement rules, warehouse allocation, granular admin grants, and production import behavior remain outside this schema decision.

## Alternatives considered

- Continue Oracle: rejected because ADR 0012 removed the proprietary runtime target.
- Supabase-specific PostgreSQL APIs: rejected because they couple database configuration and lifecycle to one provider.
- SQLite validation: rejected because it cannot prove PostgreSQL constraints, types, transactional DDL, or driver behavior.
- Automatic startup migrations: rejected because schema ownership and application availability require separate operator-controlled boundaries.
