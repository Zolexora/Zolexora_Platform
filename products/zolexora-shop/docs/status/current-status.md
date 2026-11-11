# Current status

## Phase and verdict

MR-00 Architecture Reset and Clean Baseline is **COMPLETE**.
MR-01 Canonical Marketplace Contracts is **COMPLETE** on branch `mr-01-canonical-marketplace-contracts`.
MR-02 PostgreSQL Foundation and Data Convergence is **COMPLETE** on branch `mr-02-postgresql-foundation` with 252 backend tests passing (baseline 232).
MR-03 Identity & Session Migration is **COMPLETE** on branch `mr-03-identity-session-migration` with PostgreSQL RBAC and Redis opaque-session/OTP integration passing against disposable services.
MR-04 Persisted Storefront and Domain Isolation is **COMPLETE** on branch `main` with 306 backend tests passing.
MR-05 Seller Organizations and Storefront Grants is **COMPLETE** on branch `main` with 320 backend tests passing.
MR-06 Master Catalog, Listings and Media is **COMPLETE** on branch `main` with 325 backend tests passing.
MR-07 Inventory, Pricing, Tax and Promotions is **COMPLETE** on branch `main` with 336 backend tests passing.
MR-08 Cart, Wishlist and Checkout Quotation is **COMPLETE** on branch `main` with 350 backend tests passing.
MR-09 Order Capture and Payment Orchestration is **COMPLETE** on branch `main` with 352 backend tests passing.
MR-10 Orders, Fulfillment, Shipping, Returns and Refunds is **COMPLETE** on branch `main` with 352 backend tests passing.
MR-11 Seller Portal Completion is **COMPLETE** on branch `main`.

MR-12 Mobile Application Stabilization and Infrastructure Prep is **COMPLETE** on branch `main`.
MR-13 Storefront Web Completion is **COMPLETE** on branch `main`.
MR-14 Buyer Mobile Applications is **COMPLETE** on branch `main`.
MR-15 Mahila Legacy Server Retirement is **COMPLETE** on branch `main`.
MR-16 Independent ERP Integration is **COMPLETE** on branch `main`.

OpenAPI schema version 3.1.0 is generated cleanly and synced to `contracts/marketplace/openapi.json`. Application code remains cloud-agnostic and provider-neutral. The canonical admin domain `admin.marketplace.zolexora.com` is active. Storefronts use explicitly registered PostgreSQL isolation context.

## Application status

| Surface | Canonical path | Verified result |
| --- | --- | --- |
| Zolexora web/mobile | `apps/storefronts/zolexora-shop/web`, `mobile` | web build/fully integrated; mobile export/type-check pass |
| Mahila web/mobile | `apps/storefronts/mahila-madel/web`, `mobile` | web build/fully integrated; mobile export/type-check pass |
| Mahila legacy server | `apps/storefronts/mahila-madel/legacy-server` | legacy runtime disabled (`410 Gone`); dry-run complete |
| Seller web/mobile | `apps/portals/seller/web`, `mobile` | builds and applicable type-checks pass |
| Marketplace admin | `apps/portals/marketplace-admin/web` | domain `admin.marketplace.zolexora.com`; build/type-check pass |
| FastAPI | `services/marketplace-api` | PostgreSQL 16 identities/RBAC, Redis opaque sessions/OTP, scoped repositories, and existing contracts pass |
| ERP contract boundary | `contracts/zolexora-erp/v1`, `services/marketplace-api/integrations/zolexora_erp` | proposed schemas/examples and typed interfaces validate offline; no transport |
| Orders & Fulfillment Contracts | `services/marketplace-api/models/orders.py`, `routers/orders.py`, `routers/admin_orders.py` | ADR 0013 contracts, quote verification, multi-seller split, state machines, compound isolation pass |

Zolexora web/mobile send `zolexora-shop`; Mahila mobile sends `mahila-madel`; seller/admin applications have no fixed storefront. Production storefront context resolution enforces registered origins/hosts and fails closed for unknown/retired hostnames. PostgreSQL is the canonical Marketplace identity/RBAC and relational database. Redis owns only ephemeral opaque sessions and verification challenges. Supabase Auth is no longer runtime authority; offline identity import and customer cutover remain separately authorized work.

MR-17 Security, quality, observability and performance is **COMPLETE** on branch `main`.
MR-18 Container and CI release contract is **COMPLETE** on branch `main`.
MR-19 Marketplace repository release readiness is **COMPLETE** on branch `main`.

## Next action

All current phases completed.
