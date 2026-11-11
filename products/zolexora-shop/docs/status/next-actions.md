# Next actions

| ID | Priority/status | Objective and scope | Expected files | Required tests | Dependencies / stop condition |
|---|---|---|---|---|---|
| ACT-MR00 | P0 / Complete | MR-00 Architecture Reset and Clean Baseline: provider-neutral baseline, `admin.marketplace.zolexora.com` adoption, datastore classification | core config, registry, docker-compose, ADR 0012, MR-00 audit, roadmap, transition record | workspace 10-package guard, python compileall, pytest storefront context (21 tests pass) | completed 2026-07-31; evidence in MR-00 audit |
| ACT-MR01 | P0 / Complete | MR-01 Canonical Marketplace Contracts: type-safe seller/admin/cart/checkout/order/fulfillment contracts and isolation | `contracts/marketplace/`, backend contract models/routers, ADR 0013 | 232 backend tests, OpenAPI 3.1.0 export | completed 2026-08-01; evidence in MR-01 audits |
| ACT-MR02 | P0 / Complete | Provider-neutral PostgreSQL foundation and data convergence design | ADR 0014, Alembic `0001_postgresql_foundation`, database models/repositories, import design | 38 focused real-PostgreSQL tests; 252 full backend tests; `pnpm verify` | completed 2026-08-01; wait for explicit MR-03 authorization |
| ACT-MR03 | P0 / Complete | Canonical PostgreSQL identity/RBAC and Redis opaque sessions/OTP | ADR 0004, Alembic `0002_identity_session_rbac`, auth/repository/Redis/client convergence, offline Supabase mapper | real PostgreSQL/Redis identity tests; full backend and workspace verification | completed 2026-08-01; evidence in MR-03 audit |
| ACT-MR04 | P0 / Complete | Persisted storefront and domain isolation | PostgreSQL `storefronts`, Alembic `0003`, trusted proxies, storefront query boundaries | 306 focused backend tests, router isolation tests | completed 2026-08-02; wait for explicit MR-05 authorization |
| ACT-MR05 | P0 / Complete | Seller organizations and storefront grants | PostgreSQL `seller_organization`, `seller_storefront_grant`, Alembic `0004` | 320 focused backend tests | completed |
| ACT-MR06 | P0 / Complete | Master Catalog, Listings and Media | PostgreSQL product tables, Alembic `0005`, adapter models | 325 backend tests | completed |
| ACT-MR07 | P0 / Complete | Inventory, Pricing, Tax and Promotions | PostgreSQL ledger tables, price resolution logic | 336 backend tests | completed |
| ACT-MR08 | P0 / Complete | Cart, Wishlist and Checkout Quotation | Storefront-scoped cart states, snapshot rules, reliable quote computation | 350 backend tests | completed |
| ACT-MR09 | P0 / Complete | Order Capture and Payment Orchestration | Payment orchestration, immutable orders, state machines | 352 backend tests | completed |
| ACT-MR10 | P0 / Complete | Orders, Fulfillment, Shipping, Returns and Refunds | Immutable orders, fulfillment workflows, shipping adapter, returns | backend workflow tests | completed |
| ACT-MR11 | P0 / Complete | Seller Portal Completion | Connect web/mobile apps to backend | frontend build pass, tests pass | completed |
| ACT-MR12 | P0 / Complete | Marketplace Admin Completion | - | - | completed |
| ACT-MR13 | P0 / Complete | Storefront Web Completion | Zolexora/Mahila storefront logic | frontend build pass, tests pass | completed |
| ACT-MR14 | P0 / Complete | Buyer Mobile Applications | Zolexora/Mahila distinct mobile logic | frontend build pass, tests pass | completed |
| ACT-MR15 | P0 / Complete | Mahila Legacy Server Retirement | legacy API mapped, runtime disabled | dry-run parity checked | completed |
| ACT-MR16 | P0 / Complete | Independent ERP Integration | `services/marketplace-api/integrations/zolexora_erp/`, `erp_outbox` | backend tests pass | completed |
| ACT-MR17 | P0 / Complete | Security, quality, observability and performance | - | - | completed |
