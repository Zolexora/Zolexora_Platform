# Project: ZolexoraMarketplace Roadmap Execution

## Architecture
- Modular FastAPI Monolith (`services/marketplace-api/`)
- Canonical Database: PostgreSQL (`0001_postgresql_foundation`, `0002_identity_session_rbac`, `0003_persisted_storefront_domain_isolation`)
- Customer Storefronts: Zolexora Shop (`shop.zolexora.com`), Mahila Madel (`mahilamadel.store`)
- Portals: Seller Portal (`seller.zolexora.com`), Marketplace Admin (`admin.marketplace.zolexora.com`)
- Provider-Neutral Adapters: Payments, Shipping, Media (S3), Search, ERP

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Baseline Baseline Reconciliation | Verify Git state, MR-00..MR-04 baseline & tests | MR-00..MR-04 | R2 |
| 2 | Seller Organizations & Grants | Shared seller org, members, roles, explicit storefront grants, suspension control | MR-05 | Roadmap §10 |
| 3 | Master Catalog & Media | Master products, variants, seller/storefront listings, S3 media adapter | MR-06 | Roadmap §11 |
| 4 | Inventory, Pricing & Promotions | Server-calculated offer totals, stock reservations, tax boundary, coupon concurrency | MR-07 | Roadmap §12 |
| 5 | Cart & Quotation | Storefront-isolated carts, wishlists, address management, checkout quote | MR-08 | Roadmap §13 |
| 6 | Separate Payment Gateways | Storefront-based merchant account routing, signed webhooks, idempotent capture ledger | MR-09 | Roadmap §14 |
| 7 | Orders & Fulfillment | Immutable order snapshots, seller splits, shipping adapter, returns/refunds | MR-10 | Roadmap §15 |
| 8 | Seller Portal | Connect seller web & mobile to shared API | MR-11 | Roadmap §16 |
| 9 | Marketplace Admin | Operational control plane at admin.marketplace.zolexora.com | MR-12 | Roadmap §17 |
| 10 | Storefront Web | Zolexora Shop & Mahila Madel web buyer journeys on shared API | MR-13 | Roadmap §18 |
| 11 | Buyer Mobile Applications | Zolexora Shop & Mahila Madel buyer mobile apps | MR-14 | Roadmap §19 |
| 12 | Mahila Legacy Server Retirement | Parity proof, dry-run migration, retire duplicate Express/Mongoose backend | MR-15 | Roadmap §20 |
| 13 | Independent ERP Integration | Outbox/inbox, versioned contracts, fake ERP adapter, failure isolation | MR-16 | Roadmap §21 |
| 14 | Security & Observability | Threat model, rate limits, PII controls, metrics, load & concurrency tests | MR-17 | Roadmap §22 |
| 15 | Container & CI Contract | Multi-stage Dockerfiles, Compose dev stack, GitHub Actions release workflows | MR-18 | Roadmap §23 |
| 16 | Marketplace Release Readiness | Certification, end-to-end regression across all surfaces & fake providers | MR-19 | Roadmap §24 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | Pre-Flight Reconciliation | Verify MR-00..MR-04 baseline & tests | None | DONE |
| 1 | MR-05 | Seller Orgs & Storefront Grants | Baseline | IN_PROGRESS |
| 2 | MR-06 | Master Catalog, Listings & Media | MR-05 | PLANNED |
| 3 | MR-07 | Inventory, Pricing, Tax & Promotions | MR-06 | PLANNED |
| 4 | MR-08 | Cart, Wishlist & Checkout Quotation | MR-07 | PLANNED |
| 5 | MR-09 | Separate Payment Gateways & Ledger | MR-08 | PLANNED |
| 6 | MR-10 | Orders, Fulfillment, Shipping, Returns & Refunds | MR-09 | PLANNED |
| 7 | MR-11 | Seller Portal Completion | MR-10 | PLANNED |
| 8 | MR-12 | Marketplace Admin Completion | MR-10 | PLANNED |
| 9 | MR-13 | Storefront Web Completion | MR-10 | PLANNED |
| 10 | MR-14 | Buyer Mobile Applications | MR-13 | PLANNED |
| 11 | MR-15 | Mahila Legacy Server Retirement | MR-13 | PLANNED |
| 12 | MR-16 | Independent ERP Integration | MR-10 | PLANNED |
| 13 | MR-17 | Security, Quality, Observability & Performance | MR-16 | PLANNED |
| 14 | MR-18 | Container and CI Release Contract | MR-17 | PLANNED |
| 15 | MR-19 | Marketplace Repository Release Readiness | MR-18 | PLANNED |

## Interface Contracts
- Shared API Contract: `packages/shared-api/`
- Shared Config Contract: `packages/shared-config/`
- ERP Contract: `contracts/zolexora-erp/v1/`

## Code Layout
- `apps/storefronts/zolexora-shop/web`, `mobile`
- `apps/storefronts/mahila-madel/web`, `mobile`, `legacy-server`
- `apps/portals/seller/web`, `mobile`
- `apps/portals/marketplace-admin/web`
- `services/marketplace-api/`
