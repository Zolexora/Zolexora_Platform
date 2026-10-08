# ADR 0015: Persisted Storefront and Domain Authority in PostgreSQL

- **Status:** Accepted
- **Date:** 2026-08-01
- **Deciders:** Marketplace Architecture & Platform Core Engineering
- **Supersedes:** Runtime static authority in [ADR 0008](0008-storefront-context-resolution.md); static registry definitions in `services/marketplace-api/storefronts/registry.py` become bootstrap fallbacks.

## Context

Zolexora Marketplace operates multiple customer storefronts (`zolexora-shop` and `mahila-madel`) alongside shared application surface hosts (`api.zolexora.com`, `seller.zolexora.com`, `admin.marketplace.zolexora.com`). 

Previously, storefront host resolution relied on a static Python dictionary within `services/marketplace-api/storefronts/registry.py`. As the marketplace transitions to production persistence on PostgreSQL 16 (established in ADR 0014), storefront configuration—including active status, domain routing, currency, and locale—must be transactional, queryable, database-enforced, and independent of application code deployment cycles.

## Decision

1. **PostgreSQL 16 Relational Authority**: Relational tables `storefront` and `storefront_domain` in PostgreSQL 16 are the authoritative runtime source of truth for active storefronts, domains, locale, currency, and status.
2. **Deterministic Seed/Bootstrap Data**: Alembic migration `0003_persisted_storefront_domain_isolation` and runtime repository method `PostgresStorefrontRepository.bootstrap_storefronts()` deterministically insert and maintain canonical seed records for `zolexora-shop` (`60000000-0000-4000-4100-000000000001`) and `mahila-madel` (`60000000-0000-4000-4100-000000000002`) using fixed, immutable UUIDs.
3. **Surface Domain Exclusion**: Shared API (`api.zolexora.com`), Seller Portal (`seller.zolexora.com`), and Marketplace Admin (`admin.marketplace.zolexora.com`) domains are reserved application surface endpoints and are explicitly prevented from being registered as buyer storefront domains.
4. **Idempotency & Database Integrity**: Seed operations utilize PostgreSQL `ON CONFLICT (storefront_key)` and `ON CONFLICT (hostname)` clauses or check-before-insert semantics, guaranteeing that re-applying migrations or re-executing startup bootstrap generates zero duplicates, zero primary key collisions, and no unexpected state mutation.
5. **Static Registry Role Shift**: `services/marketplace-api/storefronts/registry.py` converges to load active configuration dynamically from PostgreSQL via `PostgresStorefrontRepository.load_registry()`, retaining static definitions only for compile-time constants and offline test bootstrapping.
6. **Immutability Invariants**: Triggers enforce the immutability of `storefront.storefront_key`, `storefront_domain.storefront_id`, and `marketplace_order.storefront_id`.

## Consequences

- Runtime request context resolution executes indexed database lookups (`SELECT s.*, d.* FROM storefront_domain d JOIN storefront s ON d.storefront_id = s.id WHERE d.hostname = :normalized_host AND d.is_active = TRUE AND s.is_active = TRUE`).
- Storefront activation/deactivation and domain alias additions occur dynamically via database transactions without requiring service redeployments.
- Application code cannot bypass database storefront boundaries; invalid, unknown, or disabled domains fail closed with structured HTTP 404 / resolution error.
- Downgrades are disabled; migration `0003` is strictly forward-only.

## Alternatives Considered

- **Retain Static Code Authority**: Rejected because domain changes required code releases, and relational integrity (foreign keys on orders, listings, carts) could not be verified by the database.
- **Dynamic File-Based Config (YAML/JSON)**: Rejected because file configuration lacks transactional isolation, relational foreign keys, and multi-node synchronization in containerized environments.
- **Runtime Automatic Schema Creation (`metadata.create_all()`)**: Rejected per ADR 0014; Alembic migrations own schema evolution and initial seeding.
