# Project memory

This file is the shortest durable context for anyone resuming work on the repository. It records stable intent and constraints, not daily progress.

## Product identity

- The product is a shared marketplace platform serving two customer brands.
- Zolexora Shop runs at `shop.zolexora.com`.
- Mahila Madel runs at `mahilamadel.store`.
- Sellers use one shared portal at `seller.zolexora.com`.
- Marketplace operators use one shared admin panel at `admin.marketplace.zolexora.com`.
- The common API should be exposed at `api.zolexora.com`.

## Non-negotiable architecture rules

1. One shared backend owns marketplace business rules.
2. Every storefront-scoped record carries a stable `storefront_id`.
3. Order origin is captured at checkout and never changed afterward.
4. The server resolves storefront identity from a trusted host-to-store registry; a client-supplied storefront value is only a consistency check.
5. A master product is distinct from a storefront listing. Publication, price, merchandising, and availability may differ by storefront.
6. Inventory is shared by default, with explicit allocation only if the business later requires it.
7. Zolexora Shop and Mahila Madel use different payment gateway configurations or merchant accounts.
8. The client cannot select an arbitrary gateway, merchant account, price, tax, discount, or final total.
9. Payment webhooks, idempotency, refunds, and reconciliation are first-class backend responsibilities.
10. Web authentication moves to Secure, HttpOnly cookies. Mobile authentication uses the platform secure store.
11. Hosting remains cloud-agnostic; product-local containers and standard provider services must not change application contracts, and secrets are never committed.
12. The existing Mahila Madel visual experience may be reused, but its separate Express backend, duplicate admin logic, and client-trusted checkout totals are transitional.
13. Zolexora ERP and Marketplace are independent companies/products. Marketplace is one ERP customer; no database, authentication, source, secret, deployment, or synchronous-checkout coupling is allowed.
14. Generic ERP contracts contain tenant/organization references; Marketplace owns storefront translation. The legal one-company versus two-company layout is unresolved.

## Repository reality after Phase 1.6

- The main API is FastAPI under `services/marketplace-api/`.
- Canonical relational persistence is PostgreSQL through a standard `DATABASE_URL`; MongoDB and Supabase data sources remain transitional pending an authorized import.
- Zolexora Shop is under `apps/storefronts/zolexora-shop/web`; shared portals are under `apps/portals/`.
- Zolexora and Mahila buyer Expo apps live beside their storefronts; shared seller mobile lives at `apps/portals/seller/mobile`.
- Mahila web and its transitional Express server are separated under `apps/storefronts/mahila-madel/`.
- Shared TypeScript packages are under `packages/`.
- The root pnpm workspace owns exactly ten packages and rejects missing canonical paths.
- FastAPI has a dynamic PostgreSQL-backed storefront resolver using `TRUSTED_PROXIES` for secure proxy/forwarded-host extraction.
- Existing MongoDB collections (products, carts, orders, reels) enforce strict query-level storefront isolation on all read and write operations.
- PostgreSQL migration chain up through `0010_erp_outbox_inbox` owns the canonical relational, identity/RBAC, multitenant isolation foundation, seller grants, master catalog, storefront listings, inventory ledgers, pricing, taxes, promotions, shopping carts, wishlists, checkout quotations, payment webhook receipts, payment transaction ledgers, order history, fulfillment records, returns, disputes, and asynchronous ERP integration patterns (outbox/inbox). Redis holds only expiring opaque sessions and verification state. The Oracle proof and revision are retained only as historical evidence.

## Target ownership

| Concern | Owner |
| --- | --- |
| Storefront recognition | API edge/storefront resolver |
| Users, sessions, roles | Shared identity module |
| Product truth | Master catalog |
| Per-store publication and price | Storefront listing module |
| Sellable quantity | Shared inventory module |
| Cart and checkout totals | Shared commerce backend |
| Gateway selection | Payment orchestration service |
| Order origin | Immutable order field |
| Seller permissions | Shared seller access policy |
| Cross-store operations | Common admin panel and admin APIs |
| Binary assets | OCI Object Storage through a storage adapter |
| Secrets | OCI Secret Management/Vault-compatible integration |

## Decision records

- [ADR 0001](decisions/0001-multi-storefront-shared-platform.md): shared platform with two storefronts.
- [ADR 0002](decisions/0002-oracle-cloud-target.md): OCI is the final infrastructure target.
- [ADR 0003](decisions/0003-separate-payment-gateways.md): storefronts use separate gateway configurations.
- [ADR 0004](decisions/0004-secure-session-architecture.md): secure session handling for web and mobile.
- [ADR 0005](decisions/0005-canonical-pnpm-workspace.md): pnpm and the root lockfile own all JavaScript packages.
- [ADR 0006](decisions/0006-canonical-repository-layout.md): capability-oriented repository paths are canonical.
- [ADR 0007](decisions/0007-separate-buyer-mobile-apps.md): each storefront owns a buyer mobile binary and seller mobile remains shared.
- [ADR 0008](decisions/0008-storefront-context-resolution.md): request context uses exact registered signals, conflict rejection, and no default.
- [ADR 0009](decisions/0009-independent-erp-customer-integration.md): independent ERP customer contract and asynchronous integration boundary.
- [ADR 0010](decisions/0010-oracle-marketplace-persistence-foundation.md): SQLAlchemy/Alembic/python-oracledb, forward-only Oracle migrations, persisted fail-closed storefront resolution, and reliability schema.
- [ADR 0012](decisions/0012-marketplace-cloud-agnostic-baseline.md): provider-neutral application and infrastructure baseline; Oracle/OCI targets superseded.
- [ADR 0014](decisions/0014-postgresql-marketplace-foundation.md): provider-independent PostgreSQL, forward-only Alembic ownership, explicit transactions, and no active Oracle runtime.

## Working discipline

- Read [phases.md](phases.md) and complete its gate before moving to a later phase.
- Preserve user work and keep each change inside the requested phase.
- Add tests for storefront isolation, server-side totals, authorization, payment routing, and idempotency as those capabilities are introduced.
- Do not commit, push, deploy, migrate production data, or rotate live secrets unless explicitly authorized.
