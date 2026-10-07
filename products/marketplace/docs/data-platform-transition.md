# Data Platform Transition Record

## Overview

This record documents the data architecture, datastore inventory, ownership boundaries, and transition path for Zolexora Marketplace following the MR-00 architecture reset.

**Explicit Statement:** No database migration, data copy, DDL execution, schema transformation, or datastore deletion occurred during MR-00.

---

## 1. Current Datastore Inventory

1. **MongoDB Atlas**
   - Type: Document Store
   - Current Role / Scope: Master products, storefront listings, orders, order items, carts, wishlists, reels, reel views, coin transactions, pending OTP registrations, password reset tokens, shipping manifests, fulfillment status.
   - Transition Target: Migration to Canonical PostgreSQL (MR-02 through MR-10).

2. **Supabase PostgreSQL**
   - Type: Relational Database
   - Current Role / Scope: Users (`auth.users`), user profiles (`public.users`), roles (`role`), subscriptions, payment transactions.
   - Transition Target: Migration to Canonical PostgreSQL (MR-02/MR-03).

3. **Redis**
   - Type: In-Memory Cache
   - Current Role / Scope: Transient cache, OTP tokens, unwired session storage adapter module (`services/marketplace-api/shared/database/redis.py`).
   - Transition Target: Retain as provider-neutral caching layer.

4. **Cloudinary**
   - Type: Binary Asset Store
   - Current Role / Scope: Product images, reel videos, user avatars.
   - Transition Target: Provider-neutral Storage Adapter.

5. **Mahila Express / Mongoose**
   - Type: Transitional DB
   - Current Role / Scope: Legacy Mahila product catalog & order data.
   - Transition Target: Retirement in MR-15.

6. **Oracle Database 23ai Free**
   - Type: Historical Proof DB
   - Current Role / Scope: Schema migration `0001_oracle_foundation` ran only on disposable test container (`zolexora-oracle-phase5-test`).
   - Transition Target: Historical evidence retained; candidate for replacement in MR-02 under DG-01.

---

## 2. Complete 34-Domain Data Ownership Matrix

1. **Domain: Identities**
   - Current persistence status: DURABLY PERSISTED
   - Current durable datastore: Supabase Auth (`auth.users`)
   - Current durable authoritative writer: Supabase Auth API
   - Runtime handler: FastAPI Auth Controller (`services/marketplace-api/routers/auth.py`)
   - External provider: Supabase Auth
   - Code-defined configuration source: None
   - Mirrors or secondary stores: MongoDB `users` mirror
   - Implemented but non-authoritative schemas: None
   - Evidence confidence: PROVEN
   - Exact runtime evidence: `services/marketplace-api/database/repositories/users.py`
   - Target direction: Canonical PostgreSQL `users` table
   - Responsible future MR or decision gate: MR-03
   - Phase rationale: MR-03 is the Identity & Session Migration phase.
   - Migration or reconciliation requirement: Migration required from Supabase Auth to PostgreSQL.

2. **Domain: User Profiles**
   - Current persistence status: DURABLY PERSISTED
   - Current durable datastore: Supabase PostgreSQL (`public.users`)
   - Current durable authoritative writer: FastAPI User Repository Engine (`services/marketplace-api/users/repositories.py`)
   - Runtime handler: FastAPI User Router (`services/marketplace-api/users/repositories.py`)
   - External provider: Supabase PostgreSQL
   - Code-defined configuration source: None
   - Mirrors or secondary stores: MongoDB `users` mirror
   - Implemented but non-authoritative schemas: None
   - Evidence confidence: PROVEN
   - Exact runtime evidence: `services/marketplace-api/users/repositories.py` lines 45-89
   - Target direction: Canonical PostgreSQL `user_profiles` table
   - Responsible future MR or decision gate: MR-03
   - Phase rationale: MR-03 owns all User Profile and RBAC migration tasks.
   - Migration or reconciliation requirement: Reconciliation and migration required.

3. **Domain: Roles & Permissions**
   - Current persistence status: DURABLY PERSISTED
   - Current durable datastore: Supabase PostgreSQL (`role` column in `public.users`)
   - Current durable authoritative writer: FastAPI User Repository Engine
   - Runtime handler: FastAPI Auth Module (`services/marketplace-api/core/auth.py`)
   - External provider: None
   - Code-defined configuration source: None
   - Mirrors or secondary stores: None
   - Implemented but non-authoritative schemas: None
   - Evidence confidence: PROVEN
   - Exact runtime evidence: `services/marketplace-api/core/auth.py` lines 34-62
   - Target direction: Canonical PostgreSQL `user_roles` & RBAC tables
   - Responsible future MR or decision gate: MR-03
   - Phase rationale: MR-03 establishes RBAC schema and role enforcement.
   - Migration or reconciliation requirement: Direct schema mapping from Supabase `role` column.

4. **Domain: Sessions**
   - Current persistence status: NOT PERSISTED
   - Current durable datastore: NOT PERSISTED (Stateless JWT in HTTP Headers)
   - Current durable authoritative writer: NOT APPLICABLE
   - Runtime handler: FastAPI Auth Middleware (`services/marketplace-api/core/config.py`)
   - External provider: None
   - Code-defined configuration source: None
   - Mirrors or secondary stores: None
   - Implemented but non-authoritative schemas: Redis Session Adapter (`services/marketplace-api/shared/database/redis.py`, unwired in active middleware)
   - Evidence confidence: PROVEN
   - Exact runtime evidence: `services/marketplace-api/core/config.py` lines 12-25
   - Target direction: Redis Session Store + HttpOnly Secure Cookies
   - Responsible future MR or decision gate: MR-03
   - Phase rationale: MR-03 migrates authentication from stateless JWT to Redis-backed session management.
   - Migration or reconciliation requirement: Session infrastructure migration required.

5. **Domain: OTP & Verification Data**
   - Current persistence status: DURABLY PERSISTED
   - Current durable datastore: Redis (`redis://localhost:6379`) & MongoDB (`pending_registrations`)
   - Current durable authoritative writer: FastAPI Auth Controller
   - Runtime handler: FastAPI Auth Router (`services/marketplace-api/routers/auth.py`)
   - External provider: Twilio / SMS Gateway
   - Code-defined configuration source: None
   - Mirrors or secondary stores: None
   - Implemented but non-authoritative schemas: None
   - Evidence confidence: PROVEN
   - Exact runtime evidence: `services/marketplace-api/routers/auth.py` lines 78-112
   - Target direction: Redis OTP Store with strict TTL auto-eviction
   - Responsible future MR or decision gate: MR-03
   - Phase rationale: MR-03 consolidates transient verification tokens into Redis.
   - Migration or reconciliation requirement: None (transient data).

6. **Domain: Seller Organizations**
   - Current persistence status: NOT IMPLEMENTED
   - Current durable datastore: NOT PERSISTED
   - Current durable authoritative writer: NOT APPLICABLE
   - Runtime handler: FastAPI Seller Module (embedded role check)
   - External provider: None
   - Code-defined configuration source: None
   - Mirrors or secondary stores: MongoDB `users` (embedded seller role flag)
   - Implemented but non-authoritative schemas: Oracle DDL (`EXTERNAL_ORGANIZATION` in `services/marketplace-api/database/models.py`)
   - Evidence confidence: PROVEN ABSENCE
   - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
   - Target direction: Canonical PostgreSQL `seller_organizations` table
   - Responsible future MR or decision gate: MR-05
   - Phase rationale: MR-05 is the Seller Portal & Organization Data Migration phase.
   - Migration or reconciliation requirement: Migration required from embedded seller fields in MongoDB `users`.

7. **Domain: Seller-to-Storefront Grants**
   - Current persistence status: NOT IMPLEMENTED
   - Current durable datastore: NOT PERSISTED
   - Current durable authoritative writer: NOT APPLICABLE
   - Runtime handler: Static Admin Authorization check
   - External provider: None
   - Code-defined configuration source: None
   - Mirrors or secondary stores: None
   - Implemented but non-authoritative schemas: Oracle DDL (`STOREFRONT_ERP_MAPPING` in `services/marketplace-api/database/models.py`)
   - Evidence confidence: PROVEN ABSENCE
   - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
   - Target direction: Canonical PostgreSQL `seller_storefront_grants` table
   - Responsible future MR or decision gate: MR-05
   - Phase rationale: MR-05 establishes multi-storefront authorization grants for sellers.
   - Migration or reconciliation requirement: Grant creation required.

8. **Domain: Storefronts**
   - Current persistence status: NOT PERSISTED
   - Current durable datastore: NOT APPLICABLE
   - Current durable authoritative writer: NOT APPLICABLE
   - Runtime handler: FastAPI Storefront Resolver (`services/marketplace-api/storefronts/registry.py`)
   - External provider: None
   - Code-defined configuration source: `services/marketplace-api/storefronts/registry.py`
   - Mirrors or secondary stores: None
   - Implemented but non-authoritative schemas: Oracle DDL (`STOREFRONT` in `services/marketplace-api/database/models.py`)
   - Evidence confidence: PROVEN
   - Exact runtime evidence: `services/marketplace-api/storefronts/registry.py`
   - Target direction: Canonical PostgreSQL `storefronts` table
   - Responsible future MR or decision gate: MR-04
   - Phase rationale: MR-04 is the Storefront Registry & Domain Routing phase.
   - Migration or reconciliation requirement: Static registry migration required to PostgreSQL table.

9. **Domain: Domains**
   - Current persistence status: NOT PERSISTED
   - Current durable datastore: NOT APPLICABLE
   - Current durable authoritative writer: NOT APPLICABLE
   - Runtime handler: FastAPI Domain Resolver (`services/marketplace-api/database/repositories/storefronts.py`)
   - External provider: None
   - Code-defined configuration source: `services/marketplace-api/database/repositories/storefronts.py`
   - Mirrors or secondary stores: None
   - Implemented but non-authoritative schemas: Oracle DDL (`STOREFRONT_DOMAIN` in `services/marketplace-api/database/models.py`)
   - Evidence confidence: PROVEN
   - Exact runtime evidence: `services/marketplace-api/database/repositories/storefronts.py`
   - Target direction: Canonical PostgreSQL `storefront_domains` table
   - Responsible future MR or decision gate: MR-04
   - Phase rationale: MR-04 establishes domain binding and validation tables.
   - Migration or reconciliation requirement: Static domain registry migration required.

10. **Domain: Master Products**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`products` collection)
    - Current durable authoritative writer: FastAPI Catalog Module
    - Runtime handler: FastAPI Products Router (`services/marketplace-api/routers/products.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: Mahila Express Mongoose (`apps/storefronts/mahila-madel/legacy-server`)
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/products.py`
    - Target direction: Canonical PostgreSQL `master_products` table
    - Responsible future MR or decision gate: MR-06
    - Phase rationale: MR-06 is the Master Catalog & Storefront Listing Separation phase.
    - Migration or reconciliation requirement: Data consolidation and schema migration required.

11. **Domain: Storefront Listings**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`products` collection)
    - Current durable authoritative writer: FastAPI Catalog Module
    - Runtime handler: FastAPI Products Router (`services/marketplace-api/routers/products.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/products.py`
    - Target direction: Canonical PostgreSQL `storefront_listings` table
    - Responsible future MR or decision gate: MR-06
    - Phase rationale: MR-06 separates storefront listings from master product definitions.
    - Migration or reconciliation requirement: Separation and migration required from embedded product fields.

12. **Domain: Media**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (metadata) and Cloudinary API (binary storage)
    - Current durable authoritative writer: FastAPI Products/Reels Routers (metadata) and Cloudinary Client (binary)
    - Runtime handler: FastAPI Media Adapter (`services/marketplace-api/core/cloudinary_client.py`)
    - External provider: Cloudinary
    - Code-defined configuration source: None
    - Mirrors or secondary stores: Local `uploads/` directory (temporary fallback)
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/core/config.py`
    - Target direction: Provider-neutral Storage Adapter (S3/GCS/Cloudinary compatible)
    - Responsible future MR or decision gate: MR-06
    - Phase rationale: MR-06 standardizes media asset attachments for products and reels.
    - Migration or reconciliation requirement: Asset verification and adapter migration required.

13. **Domain: Inventory**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`products.stock` field)
    - Current durable authoritative writer: FastAPI Catalog Engine
    - Runtime handler: FastAPI Inventory Controller (`services/marketplace-api/routers/products.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/products.py`
    - Target direction: Shared Inventory Ledger in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-07
    - Phase rationale: MR-07 is the Inventory Ledger & Pricing Engine phase.
    - Migration or reconciliation requirement: Reconciliation and migration required from product stock fields.

14. **Domain: Prices**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`products.price` field)
    - Current durable authoritative writer: FastAPI Catalog Module
    - Runtime handler: FastAPI Products Router (`services/marketplace-api/routers/products.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: Mahila Express Mongoose (`apps/storefronts/mahila-madel/legacy-server`)
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/products.py`
    - Target direction: Storefront Listing Price Rules in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-07
    - Phase rationale: MR-07 implements storefront-isolated price rules.
    - Migration or reconciliation requirement: Migration required from embedded product price fields.

15. **Domain: Tax**
    - Current persistence status: NOT PERSISTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: FastAPI Checkout Engine (`services/marketplace-api/routers/cart.py`, hardcoded 18% GST calculation)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/cart.py`
    - Target direction: Canonical PostgreSQL `tax_rules` table
    - Responsible future MR or decision gate: MR-07
    - Phase rationale: MR-07 implements configurable tax calculation rules.
    - Migration or reconciliation requirement: Rule engine creation (No data migration from NOT PERSISTED).

16. **Domain: Promotions**
    - Current persistence status: NOT IMPLEMENTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: FastAPI Discount Router (`services/marketplace-api/routers/discount.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN ABSENCE
    - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
    - Target direction: Canonical PostgreSQL `promotions` table
    - Responsible future MR or decision gate: MR-07
    - Phase rationale: MR-07 integrates promotions into the pricing engine.
    - Migration or reconciliation requirement: Migration required from MongoDB `discount_codes`.

17. **Domain: Carts**
    - Current persistence status: NOT IMPLEMENTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: FastAPI Cart Router (`services/marketplace-api/routers/cart.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN ABSENCE
    - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
    - Target direction: Storefront-isolated Carts table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-08
    - Phase rationale: MR-08 is the Cart, Wishlist & Checkout Quotation phase.
    - Migration or reconciliation requirement: Transient clear / migration required.

18. **Domain: Wishlists**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`wishlist` collection)
    - Current durable authoritative writer: FastAPI User Controller
    - Runtime handler: FastAPI Wishlist Router (`services/marketplace-api/routers/wishlist.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/wishlist.py`
    - Target direction: Storefront-isolated Wishlists table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-08
    - Phase rationale: MR-08 establishes storefront-isolated wishlist management.
    - Migration or reconciliation requirement: Migration required from MongoDB `wishlist`.

19. **Domain: Checkout Quotations**
    - Current persistence status: NOT PERSISTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: FastAPI Checkout Engine (`services/marketplace-api/routers/cart.py`, memory quote response)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: Memory / API Response
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/cart.py`
    - Target direction: Server-Authoritative Quote Ledger in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-08
    - Phase rationale: MR-08 implements server-authoritative checkout quote locking.
    - Migration or reconciliation requirement: None (transient calculation).

20. **Domain: Orders**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`orders` collection)
    - Current durable authoritative writer: FastAPI Order Engine
    - Runtime handler: FastAPI Orders Router (`services/marketplace-api/routers/orders.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: Mahila Express Mongoose (`apps/storefronts/mahila-madel/legacy-server`)
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/orders.py`
    - Target direction: Immutable Orders Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-10
    - Phase rationale: MR-10 is the Order Engine, Fulfillment & Shipping phase.
    - Migration or reconciliation requirement: Migration & audit required from MongoDB `orders`.

21. **Domain: Order Items**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`orders.items` array)
    - Current durable authoritative writer: FastAPI Order Engine
    - Runtime handler: FastAPI Orders Router (`services/marketplace-api/routers/orders.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/orders.py`
    - Target direction: Normalized `order_items` table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-10
    - Phase rationale: MR-10 normalizes order line items for split fulfillment.
    - Migration or reconciliation requirement: Normalization required from embedded order arrays.

22. **Domain: Payments**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: Supabase PostgreSQL (`payment_transactions`)
    - Current durable authoritative writer: FastAPI Payment Router (`services/marketplace-api/routers/payment.py`)
    - Runtime handler: Payment Webhooks / Gateway Integration
    - External provider: Razorpay
    - Code-defined configuration source: None
    - Mirrors or secondary stores: MongoDB `orders` payment status fields
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/payment.py`
    - Target direction: Payment Ledger Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-09
    - Phase rationale: MR-09 is the Payment Gateway Integration & Storefront Routing phase.
    - Migration or reconciliation requirement: Audit & ledger reconciliation required.

23. **Domain: Payment Attempts**
    - Current persistence status: NOT PERSISTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: Razorpay Gateway Integration (`services/marketplace-api/routers/payment.py`)
    - External provider: Razorpay
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: Supabase PostgreSQL (`payment_transactions`)
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/payment.py`
    - Target direction: Payment Attempts Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-09
    - Phase rationale: MR-09 records failed and pending payment attempts.
    - Migration or reconciliation requirement: Attempt logging creation.

24. **Domain: Refunds**
    - Current persistence status: NOT PERSISTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: Razorpay Gateway Integration (`services/marketplace-api/routers/payment.py`)
    - External provider: Razorpay
    - Code-defined configuration source: None
    - Mirrors or secondary stores: Razorpay API
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/payment.py`
    - Target direction: Refund Ledger Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-10
    - Phase rationale: MR-10 handles order cancellations, returns, and refund ledger recording under the approved roadmap.
    - Migration or reconciliation requirement: Refund ledger creation.

25. **Domain: Returns**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`orders` status flags)
    - Current durable authoritative writer: FastAPI Fulfillment Module
    - Runtime handler: FastAPI Orders Router (`services/marketplace-api/routers/orders.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/orders.py`
    - Target direction: Returns & Exchanges Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-10
    - Phase rationale: MR-10 is the Order Engine, Fulfillment & Returns phase under the approved roadmap.
    - Migration or reconciliation requirement: Migration required from MongoDB order return flags.

26. **Domain: Subscriptions**
    - Current persistence status: NOT IMPLEMENTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: FastAPI Subscription Router (`services/marketplace-api/routers/subscription.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN ABSENCE
    - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
    - Target direction: Subscriptions Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-03
    - Phase rationale: MR-03 handles user, seller, and subscription database schema migrations.
    - Migration or reconciliation requirement: Direct migration required from Supabase `subscriptions`.

27. **Domain: Reels & Content**
    - Current persistence status: NOT IMPLEMENTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: FastAPI Reels Router (`services/marketplace-api/routers/reels.py`)
    - External provider: Cloudinary (video binary files)
    - Code-defined configuration source: None
    - Mirrors or secondary stores: Cloudinary
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN ABSENCE
    - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
    - Target direction: Content & Reels Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-06
    - Phase rationale: MR-06 manages media attachments and social catalog content.
    - Migration or reconciliation requirement: Migration & media audit required.

28. **Domain: Coins & Loyalty**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`coin_transactions` collection)
    - Current durable authoritative writer: FastAPI Rewards Engine
    - Runtime handler: FastAPI Coins Router (`services/marketplace-api/routers/coins.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: MongoDB `users.coins` cached balance
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/coins.py`
    - Target direction: Coins Ledger Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-07
    - Phase rationale: MR-07 integrates coin rewards into checkout pricing calculations.
    - Migration or reconciliation requirement: Balance audit & migration required.

29. **Domain: Shipping**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`orders.shipping` embedded field)
    - Current durable authoritative writer: FastAPI Shipping Module (`services/marketplace-api/shipping/service.py`)
    - Runtime handler: Shiprocket Courier Webhooks
    - External provider: Shiprocket
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/shipping/service.py`
    - Target direction: Shipping Manifests Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-10
    - Phase rationale: MR-10 integrates courier APIs and shipping tracking into order fulfillment.
    - Migration or reconciliation requirement: Migration required from MongoDB order shipping fields.

30. **Domain: Fulfillment**
    - Current persistence status: DURABLY PERSISTED
    - Current durable datastore: MongoDB (`orders.fulfillment` embedded field)
    - Current durable authoritative writer: FastAPI Fulfillment Module
    - Runtime handler: FastAPI Orders Router (`services/marketplace-api/routers/orders.py`)
    - External provider: None
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: None
    - Evidence confidence: PROVEN
    - Exact runtime evidence: `services/marketplace-api/routers/orders.py`
    - Target direction: Item-level Fulfillment Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-10
    - Phase rationale: MR-10 establishes item-level seller fulfillment workflows.
    - Migration or reconciliation requirement: Normalization required from embedded order fulfillment fields.

31. **Domain: ERP Mappings**
    - Current persistence status: NOT IMPLEMENTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: NOT IMPLEMENTED
    - External provider: Zolexora ERP
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: Oracle DDL (`STOREFRONT_ERP_MAPPING` in `services/marketplace-api/database/models.py`)
    - Evidence confidence: PROVEN ABSENCE
    - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
    - Target direction: ERP Mapping Tables in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-16
    - Phase rationale: MR-16 is the dedicated ERP Integration & Contract Adoption phase.
    - Migration or reconciliation requirement: Mapping creation.

32. **Domain: Integration Inbox**
    - Current persistence status: NOT IMPLEMENTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: NOT IMPLEMENTED
    - External provider: External Event Publishers
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: Oracle DDL (`INTEGRATION_INBOX` in `services/marketplace-api/database/models.py`)
    - Evidence confidence: PROVEN ABSENCE
    - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
    - Target direction: Integration Inbox Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-16
    - Phase rationale: MR-16 implements reliable event ingestion from external systems.
    - Migration or reconciliation requirement: Event schema validation.

33. **Domain: Integration Outbox**
    - Current persistence status: NOT IMPLEMENTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: NOT IMPLEMENTED
    - External provider: External Event Consumers
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: Oracle DDL (`INTEGRATION_OUTBOX` in `services/marketplace-api/database/models.py`)
    - Evidence confidence: PROVEN ABSENCE
    - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
    - Target direction: Integration Outbox Table in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-16
    - Phase rationale: MR-16 implements transactional outbox pattern for async event publishing.
    - Migration or reconciliation requirement: Event schema validation.

34. **Domain: Reconciliation Records**
    - Current persistence status: NOT IMPLEMENTED
    - Current durable datastore: NOT PERSISTED
    - Current durable authoritative writer: NOT APPLICABLE
    - Runtime handler: NOT IMPLEMENTED
    - External provider: Zolexora ERP
    - Code-defined configuration source: None
    - Mirrors or secondary stores: None
    - Implemented but non-authoritative schemas: Oracle DDL (`RECONCILIATION_RUN` in `services/marketplace-api/database/models.py`)
    - Evidence confidence: PROVEN ABSENCE
    - Exact runtime evidence: Missing from all DI, router registration, and backend execution paths
    - Target direction: Reconciliation Engine Tables in Canonical PostgreSQL
    - Responsible future MR or decision gate: MR-16
    - Phase rationale: MR-16 builds cross-system mismatch detection and resolution engines.
    - Migration or reconciliation requirement: Engine creation.

---

## 3. Data Ownership & Dual-Writer Risks

1. **User Profile Mirroring Risk:** User creation currently writes to Supabase Auth/PostgreSQL and mirrors to MongoDB. Dual-writing introduces sync drift risk during network failures.
2. **Catalog & Order Dual-Store Risk:** Product and order data exist in MongoDB Atlas while user profiles and payments reside in Supabase. Cross-datastore transaction isolation is impossible without single-database relational persistence.
3. **Mahila Legacy Server Persistence Risk:** The transitional Mahila Express server maintains separate MongoDB collections, creating data duplication with the main FastAPI backend.

---

## 4. Oracle Historical Status & PostgreSQL Decision Gate (DG-01)

- **Oracle Historical Status:** Revision `0001_oracle_foundation.py` and associated tests represent historical validation evidence from Phase 5 (`docs/status/audits/phase-5-oracle-runtime-validation.md`). It ran only against a temporary, disposable local container (`zolexora-oracle-phase5-test`). No durable database was migrated or altered.
- **PostgreSQL Recommendation:** PostgreSQL is recommended as the future single canonical relational database.
- **Decision Gate DG-01 Requirement:** Formal implementation of PostgreSQL requires passing Decision Gate DG-01, including:
  1. Formal ADR approval for PostgreSQL driver and Alembic migration structure.
  2. Data migration plan from MongoDB/Supabase with dry-run verification.
  3. Zero-downtime dual-read / single-write transition strategy.
  4. Backup, point-in-time recovery, and rollback procedures.

---

## 5. Required Transition & Validation Gates for Future Phases

Future data transition phases (MR-02 onwards) must enforce:
- **Migration & Rollback Gates:** Every Alembic migration must have a tested forward upgrade and clean downgrade script.
- **Reconciliation Gates:** Automated scripts to detect and resolve data imbalances between legacy stores and the new PostgreSQL database before cutover.
- **Mahila Legacy Data Handling:** Export, sanitize, and map legacy Mahila ShopKart records into the canonical master catalog and storefront listings prior to MR-15 retirement.
