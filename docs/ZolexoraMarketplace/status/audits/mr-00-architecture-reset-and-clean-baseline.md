# MR-00 Audit: Architecture Reset and Clean Baseline

## 1. Verdict

**PASS WITH BLOCKERS**

Technical MR-00 architecture reset, domain configuration, documentation link validation, cross-platform Python launcher creation, and offline verification pass cleanly across all required commands with **100% success**. The governance verdict is **PASS WITH BLOCKERS** because:
1. Local commit `4e290b5534c9de5e81b14a7375f6a6969c107413` requires explicit user acceptance prior to `git push`.
2. Final reconciliation documentation and launcher script corrections remain uncommitted in the working tree for user review.

---

## 2. Git & Working Tree Reconciliation

- **Repository Root:** `/data/projects/development/Zolexora/ZolexoraMarketplace`
- **Current Branch:** `main`
- **Upstream Branch:** `origin/main` (`5f01a63075a5eb5abd3da3149122704ea6486ab8`)
- **HEAD Commit:** `4e290b5534c9de5e81b14a7375f6a6969c107413`
- **HEAD Provenance:**
  - Author: `Zolexora <abhishekofficial4577@gmail.com>`
  - Date: `Fri Jul 31 10:27:20 2026 +0000`
  - Parent: `5f01a63075a5eb5abd3da3149122704ea6486ab8` (`origin/main`)
  - Commit Subject: `MR-00`
  - Reflog Entry: `HEAD@{0}: commit: MR-00`
- **Commit Scope Analysis:** Contains exactly 23 files (4 added, 19 modified, 0 deleted, 0 renamed). Contains strictly MR-00 deliverables. Zero unrelated pre-existing user work is included.
- **Commit Authorization Status:** `LOCAL MR-00 COMMIT — USER ACCEPTANCE REQUIRED`
- **Push Guidance:** Commit `4e290b5` must NOT be pushed yet because final reconciliation corrections remain in the working tree for user review.

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

## 3. Reconciled File Inventories

### Inventory A: Committed Files in Range `5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`

1. Path: `.github/ISSUE_TEMPLATE/bug_report.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
2. Path: `.github/workflows/deploy-prod.yml` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
3. Path: `AGENTS.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
4. Path: `README.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
5. Path: `docker-compose.yml` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
6. Path: `docs/README.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
7. Path: `docs/data-platform-transition.md` | Status: Added | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
8. Path: `docs/decisions/0002-oracle-cloud-target.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
9. Path: `docs/decisions/0010-oracle-marketplace-persistence-foundation.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
10. Path: `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md` | Status: Added | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
11. Path: `docs/domains-and-routing.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
12. Path: `docs/marketplace-repository-roadmap.md` | Status: Added | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
13. Path: `docs/memory.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
14. Path: `docs/prd.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
15. Path: `docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md` | Status: Added | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
16. Path: `docs/status/current-status.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
17. Path: `docs/status/next-actions.md` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
18. Path: `services/.env.example` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
19. Path: `services/marketplace-api/.env.example` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
20. Path: `services/marketplace-api/core/config.py` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
21. Path: `services/marketplace-api/database/repositories/storefronts.py` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
22. Path: `services/marketplace-api/storefronts/registry.py` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`
23. Path: `services/marketplace-api/tests/test_storefront_context.py` | Status: Modified | Scope: In Scope | Evidence Command: `git diff --name-status 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413`

### Inventory B: Current Uncommitted Files (Staged, Unstaged & Untracked)

1. Path: `.github/workflows/docs-cleanup.yml` | Status: Modified (Unstaged) | Category: Configuration | Purpose: Update workflow to invoke `scripts/validate-doc-links.py` without error masking
2. Path: `README.md` | Status: Modified (Unstaged) | Category: Documentation | Purpose: Fix absolute file URL link to docker-compose.yml
3. Path: `docs/README.md` | Status: Modified (Unstaged) | Category: Documentation | Purpose: Fix relative markdown links to audit documents
4. Path: `docs/data-platform-transition.md` | Status: Modified (Unstaged) | Category: Documentation | Purpose: Update with 15-field 34-Domain Data Ownership Matrix
5. Path: `docs/status/README.md` | Status: Modified (Unstaged) | Category: Documentation | Purpose: Fix relative link to durable project docs
6. Path: `docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md` | Status: Modified (Unstaged) | Category: Documentation | Purpose: Update audit report with full 22-check verification results, 10 workflow records, non-contaminating search results, and 34-domain matrix
7. Path: `package.json` | Status: Modified (Unstaged) | Category: Configuration | Purpose: Use `node scripts/py-exec.mjs` portable launcher in `verify:contracts`, `verify:oracle`, `lint`, and `verify:backend`
8. Path: `scripts/py-exec.mjs` | Status: Untracked | Category: Script | Purpose: Cross-platform portable Python launcher
9. Path: `scripts/search-repo.py` | Status: Untracked | Category: Script | Purpose: Non-contaminating search query evidence tool
10. Path: `scripts/tests/test_validate_doc_links.py` | Status: Untracked | Category: Test | Purpose: Unit test suite for `scripts/validate-doc-links.py`
11. Path: `scripts/validate-doc-links.py` | Status: Untracked | Category: Script | Purpose: Offline relative Markdown documentation link validator

---

## 4. GitHub Workflows Classification

1. Path: `.github/workflows/ci.yml` | Triggers: `push`, `pull_request` | Permissions: Default read | Jobs: `javascript`, `test-backend` | Exact important commands: `pnpm verify:workspace`, `pnpm type-check`, `pnpm lint`, `pnpm test`, `node scripts/py-exec.mjs scripts/validate-erp-contracts.py`, `node scripts/py-exec.mjs scripts/validate-oracle-schema.py`, `node scripts/py-exec.mjs -m pytest` | Local scripts: `scripts/verify-workspace.mjs`, `scripts/validate-erp-contracts.py`, `scripts/validate-oracle-schema.py`, `scripts/py-exec.mjs` | Third-party actions: `actions/checkout@v4`, `pnpm/action-setup@v3`, `actions/setup-node@v4`, `actions/setup-python@v5` | External services: None | Secret names: None | Registry/deployment target: None | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Actions | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain as primary CI | Repairs made: Uses portable `scripts/py-exec.mjs` launcher.

2. Path: `.github/workflows/build.yml` | Triggers: `push`, `pull_request`, `workflow_dispatch` | Permissions: Default read | Jobs: `build-frontend`, `build-backend` | Exact important commands: `pnpm build`, `node scripts/py-exec.mjs -m compileall -q services/marketplace-api` | Local scripts: `scripts/verify-workspace.mjs`, `scripts/py-exec.mjs` | Third-party actions: `actions/checkout@v4`, `pnpm/action-setup@v3`, `actions/setup-node@v4`, `actions/setup-python@v5` | External services: None | Secret names: None | Registry/deployment target: None | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Actions | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain as primary build check | Repairs made: Uses portable `scripts/py-exec.mjs` launcher.

3. Path: `.github/workflows/deploy-dev.yml` | Triggers: `push`, `workflow_dispatch` | Permissions: Default read | Jobs: `deploy-dev` | Exact important commands: `echo "Simulating dev deployment contract..."` (Simulated echo commands) | Local scripts: None | Third-party actions: `actions/checkout@v4` | External services: None | Secret names: None | Registry/deployment target: Development Target | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Actions | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain as dev deploy contract placeholder | Repairs made: None needed.

4. Path: `.github/workflows/deploy-staging.yml` | Triggers: `push`, `workflow_dispatch` | Permissions: Default read | Jobs: `deploy-staging` | Exact important commands: `echo "Simulating staging deployment contract..."` (Simulated echo commands) | Local scripts: None | Third-party actions: `actions/checkout@v4` | External services: None | Secret names: None | Registry/deployment target: Staging Target | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Actions | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain as staging deploy contract placeholder | Repairs made: None needed.

5. Path: `.github/workflows/deploy-prod.yml` | Triggers: `push` (tags `v*.*.*`), `workflow_dispatch` | Permissions: Default read | Jobs: `deploy-production` | Exact important commands: `echo \"Deploying Zolexora Marketplace to canonical production domains...\"` (Simulated echo commands only; no Docker build/publish, no GHCR, no production SSH, no docker compose pull/up) | Local scripts: None | Third-party actions: `actions/checkout@v4` | External services: None | Secret names: None | Registry/deployment target: `api.zolexora.com`, `shop.zolexora.com`, `mahilamadel.store`, `seller.zolexora.com`, `admin.marketplace.zolexora.com` | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Actions | Active status: Active (Not an operational automatic production deployment) | Repository ownership: Monorepo Core | Future disposition: Retain as production deploy contract placeholder | Repairs made: Target hostname updated to `admin.marketplace.zolexora.com`.

6. Path: `.github/workflows/security-scan.yml` | Triggers: `push`, `pull_request`, cron, `workflow_dispatch` | Permissions: Default read | Jobs: `python-security`, `container-security` | Exact important commands: `bandit -r services/marketplace-api`, `ruff check services/marketplace-api`, Trivy container scanner | Local scripts: None | Third-party actions: `actions/checkout@v4`, `actions/setup-python@v5`, `aquasecurity/trivy-action@master` | External services: None | Secret names: None | Registry/deployment target: Local Filesystem Scan | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Actions / Trivy | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain as security scanner | Repairs made: None needed.

7. Path: `.github/workflows/dependency-review.yml` | Triggers: `pull_request` | Permissions: Default read | Jobs: `dependency-review` | Exact important commands: GitHub Dependency Review action invocation | Local scripts: None | Third-party actions: `actions/checkout@v4`, `actions/dependency-review-action@v4` | External services: GitHub API | Secret names: `GITHUB_TOKEN` | Registry/deployment target: Dependency Audit | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Dependency Review | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain as PR dependency audit | Repairs made: None needed.

8. Path: `.github/workflows/codeql.yml` | Triggers: `push`, `pull_request`, cron | Permissions: `security-events: write` | Jobs: `analyze` | Exact important commands: CodeQL init, autobuild, analyze | Local scripts: None | Third-party actions: `actions/checkout@v4`, `github/codeql-action/init@v3`, `github/codeql-action/analyze@v3` | External services: GitHub Security API | Secret names: `GITHUB_TOKEN` | Registry/deployment target: Security Alerts | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub CodeQL | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain as static code analyzer | Repairs made: None needed.

9. Path: `.github/workflows/release.yml` | Triggers: `push` (tags `v*.*.*`), `workflow_dispatch` | Permissions: `contents: write` | Jobs: `draft-release` | Exact important commands: GitHub Release draft creation | Local scripts: None | Third-party actions: `actions/checkout@v4`, `softprops/action-gh-release@v2` | External services: GitHub Releases API | Secret names: `GITHUB_TOKEN` | Registry/deployment target: GitHub Release | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Releases | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain for version release notes | Repairs made: None needed.

10. Path: `.github/workflows/docs-cleanup.yml` | Triggers: `push`, `pull_request`, `workflow_dispatch` | Permissions: Default read | Jobs: `docs-check` | Exact important commands: `python3 scripts/validate-doc-links.py` | Local scripts: `scripts/validate-doc-links.py` | Third-party actions: `actions/checkout@v4`, `actions/setup-python@v5` | External services: None | Secret names: None | Registry/deployment target: Documentation Verification | Cloud coupling: Cloud-Neutral | GitHub coupling: GitHub Actions | Active status: Active | Repository ownership: Monorepo Core | Future disposition: Retain as documentation validator | Repairs made: Updated path triggers to `docs/**` & `*.md`, invokes `scripts/validate-doc-links.py` without `|| true`.

---

## 5. Non-Contaminating Search Query Evidence

(Searches exclude destination audit file `docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md` and search/test scripts to prevent self-contamination).

1. **Query:** `marketplaceadmin.zolexora.com`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'marketplaceadmin.zolexora.com' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'marketplaceadmin.zolexora.com' . | wc -l`
   - **Line count:** `8`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'marketplaceadmin.zolexora.com' . -l | wc -l`
   - **File count:** `6`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'marketplaceadmin.zolexora.com' . -l`
   - **Every matching path:**
     - `README.md`
     - `docs/decisions/0001-multi-storefront-shared-platform.md`
     - `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md`
     - `docs/status/current-status.md`
     - `scripts/verify-oracle-runtime.py`
     - `services/marketplace-api/tests/test_storefront_context.py`
   - **Classification:** Historical/Transition Docs (4), Historical Test Script (1), Active Regression Test (1)
   - **Unresolved active references:** 0

2. **Query:** `admin.marketplace.zolexora.com`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'admin.marketplace.zolexora.com' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'admin.marketplace.zolexora.com' . | wc -l`
   - **Line count:** `23`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'admin.marketplace.zolexora.com' . -l | wc -l`
   - **File count:** `19`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'admin.marketplace.zolexora.com' . -l`
   - **Every matching path:**
     - `.github/ISSUE_TEMPLATE/bug_report.md`
     - `.github/workflows/deploy-prod.yml`
     - `AGENTS.md`
     - `README.md`
     - `docker-compose.yml`
     - `docs/README.md`
     - `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md`
     - `docs/domains-and-routing.md`
     - `docs/marketplace-repository-roadmap.md`
     - `docs/memory.md`
     - `docs/prd.md`
     - `docs/status/current-status.md`
     - `docs/status/next-actions.md`
     - `services/.env.example`
     - `services/marketplace-api/.env.example`
     - `services/marketplace-api/core/config.py`
     - `services/marketplace-api/database/repositories/storefronts.py`
     - `services/marketplace-api/storefronts/registry.py`
     - `services/marketplace-api/tests/test_storefront_context.py`
   - **Classification:** Active Canonical Configuration & Code
   - **Unresolved active references:** 0

3. **Query:** `Oracle Database`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Oracle Database' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Oracle Database' . | wc -l`
   - **Line count:** `11`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Oracle Database' . -l | wc -l`
   - **File count:** `10`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Oracle Database' . -l`
   - **Every matching path:**
     - `README.md`
     - `docs/data-platform-transition.md`
     - `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md`
     - `docs/oracle-infrastructure.md`
     - `docs/oracle-persistence.md`
     - `docs/phases.md`
     - `docs/status/audits/phase-5-oracle-runtime-validation.md`
     - `docs/status/current-status.md`
     - `docs/status/test-baseline.md`
     - `scripts/verify-oracle-runtime.py`
   - **Classification:** Historical/Transition Docs and Scripts
   - **Unresolved active references:** 0

4. **Query:** `Autonomous Database`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Autonomous Database' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Autonomous Database' . | wc -l`
   - **Line count:** `19`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Autonomous Database' . -l | wc -l`
   - **File count:** `10`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Autonomous Database' . -l`
   - **Every matching path:**
     - `docs/README.md`
     - `docs/architecture.md`
     - `docs/decisions/0002-oracle-cloud-target.md`
     - `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md`
     - `docs/memory.md`
     - `docs/oracle-infrastructure.md`
     - `docs/oracle-persistence.md`
     - `docs/phases.md`
     - `docs/status/audits/phase-5-oracle-runtime-validation.md`
     - `docs/status/current-status.md`
   - **Classification:** Historical/Transition Docs and Scripts
   - **Unresolved active references:** 0

5. **Query:** `OCI`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'OCI' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'OCI' . | wc -l`
   - **Line count:** `129`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'OCI' . -l | wc -l`
   - **File count:** `37`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'OCI' . -l`
   - **Every matching path:**
     - `.github/SECURITY.md`
     - `.github/workflows/deploy-dev.yml`
     - `.github/workflows/deploy-prod.yml`
     - `.github/workflows/deploy-staging.yml`
     - `AGENTS.md`
     - `README.md`
     - `docs/README.md`
     - `docs/architecture.md`
     - `docs/decisions/0002-oracle-cloud-target.md`
     - `docs/decisions/0003-separate-payment-gateways.md`
     - `docs/decisions/0008-storefront-context-resolution.md`
     - `docs/decisions/0010-oracle-marketplace-persistence-foundation.md`
     - `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md`
     - `docs/directory-plan/Zolexora-directory-blueprint.md`
     - `docs/directory-plan/Zolexora-path-mapping.csv`
     - `docs/domains-and-routing.md`
     - `docs/erp-integration.md`
     - `docs/marketplace-repository-roadmap.md`
     - `docs/memory.md`
     - `docs/oracle-infrastructure.md`
     - `docs/oracle-persistence.md`
     - `docs/payment-architecture.md`
     - `docs/phases.md`
     - `docs/prd.md`
     - `docs/status/audits/phase-0-baseline-audit.md`
     - `docs/status/audits/phase-1-5-directory-reorganization.md`
     - `docs/status/audits/phase-1-6-mobile-storefront-alignment.md`
     - `docs/status/audits/phase-1-monorepo-baseline.md`
     - `docs/status/audits/phase-2-storefront-context.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/audits/phase-5-oracle-runtime-validation.md`
     - `docs/status/current-status.md`
     - `docs/status/feature-matrix.md`
     - `docs/status/gap-analysis.md`
     - `docs/status/test-baseline.md`
     - `infrastructure/README.md`
     - `pnpm-lock.yaml`
   - **Classification:** Historical/Transition Docs and Scripts
   - **Unresolved active references:** 0

6. **Query:** `OCI production`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'OCI production' .`
   - **Match exit code:** `1`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'OCI production' . | wc -l`
   - **Line count:** `0`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'OCI production' . -l | wc -l`
   - **File count:** `0`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'OCI production' . -l`
   - **Every matching path:**
     - (None)
   - **Classification:** Clean / No references
   - **Unresolved active references:** 0

7. **Query:** `Oracle wallet`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Oracle wallet' .`
   - **Match exit code:** `1`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Oracle wallet' . | wc -l`
   - **Line count:** `0`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Oracle wallet' . -l | wc -l`
   - **File count:** `0`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Oracle wallet' . -l`
   - **Every matching path:**
     - (None)
   - **Classification:** Clean / No references
   - **Unresolved active references:** 0

8. **Query:** `python-oracledb`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'python-oracledb' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'python-oracledb' . | wc -l`
   - **Line count:** `7`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'python-oracledb' . -l | wc -l`
   - **File count:** `6`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'python-oracledb' . -l`
   - **Every matching path:**
     - `docs/decisions/0010-oracle-marketplace-persistence-foundation.md`
     - `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md`
     - `docs/memory.md`
     - `docs/oracle-persistence.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/audits/phase-5-oracle-runtime-validation.md`
   - **Classification:** Historical/Transition Docs and Scripts
   - **Unresolved active references:** 0

9. **Query:** `oracledb`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'oracledb' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'oracledb' . | wc -l`
   - **Line count:** `16`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'oracledb' . -l | wc -l`
   - **File count:** `11`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'oracledb' . -l`
   - **Every matching path:**
     - `docs/decisions/0010-oracle-marketplace-persistence-foundation.md`
     - `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md`
     - `docs/memory.md`
     - `docs/oracle-persistence.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/audits/phase-5-oracle-runtime-validation.md`
     - `scripts/verify-oracle-runtime.py`
     - `services/marketplace-api/alembic.ini`
     - `services/marketplace-api/database/engine.py`
     - `services/marketplace-api/migrations/env.py`
     - `services/marketplace-api/requirements.txt`
   - **Classification:** Historical/Transition Docs and Scripts
   - **Unresolved active references:** 0

10. **Query:** `MARKETPLACE_ORACLE`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'MARKETPLACE_ORACLE' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'MARKETPLACE_ORACLE' . | wc -l`
   - **Line count:** `30`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'MARKETPLACE_ORACLE' . -l | wc -l`
   - **File count:** `9`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'MARKETPLACE_ORACLE' . -l`
   - **Every matching path:**
     - `docs/oracle-persistence.md`
     - `docs/runbooks/local-development.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/audits/phase-5-oracle-runtime-validation.md`
     - `scripts/verify-oracle-runtime.py`
     - `services/marketplace-api/.env.example`
     - `services/marketplace-api/database/config.py`
     - `services/marketplace-api/migrations/README.md`
     - `services/marketplace-api/tests/test_oracle_persistence.py`
   - **Classification:** Historical/Transition Docs and Scripts
   - **Unresolved active references:** 0

11. **Query:** `infrastructure/oci`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'infrastructure/oci' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'infrastructure/oci' . | wc -l`
   - **Line count:** `1`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'infrastructure/oci' . -l | wc -l`
   - **File count:** `1`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'infrastructure/oci' . -l`
   - **Every matching path:**
     - `docs/status/gap-analysis.md`
   - **Classification:** Historical/Transition Docs and Scripts
   - **Unresolved active references:** 0

12. **Query:** `PostgreSQL`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'PostgreSQL' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'PostgreSQL' . | wc -l`
   - **Line count:** `78`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'PostgreSQL' . -l | wc -l`
   - **File count:** `19`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'PostgreSQL' . -l`
   - **Every matching path:**
     - `README.md`
     - `docs/architecture.md`
     - `docs/data-platform-transition.md`
     - `docs/decisions/0002-oracle-cloud-target.md`
     - `docs/decisions/0012-marketplace-cloud-agnostic-baseline.md`
     - `docs/marketplace-repository-roadmap.md`
     - `docs/memory.md`
     - `docs/status/audits/phase-0-baseline-audit.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/next-actions.md`
     - `services/.env.example`
     - `services/marketplace-api/.env.example`
     - `services/marketplace-api/auth/router.py`
     - `services/marketplace-api/core/config.py`
     - `services/marketplace-api/core/seed.py`
     - `services/marketplace-api/core/supabase_client.py`
     - `services/marketplace-api/shared/database/mongodb.py`
     - `services/marketplace-api/shared/database/postgres.py`
     - `services/marketplace-api/users/repositories.py`
   - **Classification:** Active Architecture / Documentation / Dependencies
   - **Unresolved active references:** 0

13. **Query:** `MongoDB`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'MongoDB' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'MongoDB' . | wc -l`
   - **Line count:** `95`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'MongoDB' . -l | wc -l`
   - **File count:** `33`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'MongoDB' . -l`
   - **Every matching path:**
     - `README.md`
     - `apps/portals/marketplace-admin/web/src/app/dashboard/page.tsx`
     - `apps/storefronts/mahila-madel/README.md`
     - `apps/storefronts/mahila-madel/legacy-server/config/db.js`
     - `apps/storefronts/mahila-madel/legacy-server/public/health.html`
     - `apps/storefronts/mahila-madel/legacy-server/public/index.html`
     - `docs/architecture.md`
     - `docs/data-model.md`
     - `docs/data-platform-transition.md`
     - `docs/decisions/0002-oracle-cloud-target.md`
     - `docs/decisions/0010-oracle-marketplace-persistence-foundation.md`
     - `docs/directory-plan/Zolexora-directory-blueprint.md`
     - `docs/memory.md`
     - `docs/oracle-persistence.md`
     - `docs/runbooks/local-development.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/current-status.md`
     - `services/.env.example`
     - `services/marketplace-api/.env.example`
     - `services/marketplace-api/auth/router.py`
     - `services/marketplace-api/core/cloudinary_client.py`
     - `services/marketplace-api/core/config.py`
     - `services/marketplace-api/core/database.py`
     - `services/marketplace-api/core/supabase_client.py`
     - `services/marketplace-api/infrastructure/supabase/migrations/20260530151849_init_schema.sql`
     - `services/marketplace-api/main.py`
     - `services/marketplace-api/models/documents.py`
     - `services/marketplace-api/scripts/ensure_indexes.py`
     - `services/marketplace-api/scripts/setup_indexes.py`
     - `services/marketplace-api/scripts/supabase_schema_v2.sql`
     - `services/marketplace-api/shared/database/mongodb.py`
     - `services/marketplace-api/shared/database/redis.py`
     - `services/marketplace-api/users/repositories.py`
   - **Classification:** Active Architecture / Documentation / Dependencies
   - **Unresolved active references:** 0

14. **Query:** `Motor`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Motor' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Motor' . | wc -l`
   - **Line count:** `90`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Motor' . -l | wc -l`
   - **File count:** `13`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Motor' . -l`
   - **Every matching path:**
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `services/marketplace-api/core/database.py`
     - `services/marketplace-api/core/deps.py`
     - `services/marketplace-api/routers/auth.py`
     - `services/marketplace-api/routers/cart.py`
     - `services/marketplace-api/routers/products.py`
     - `services/marketplace-api/routers/reels.py`
     - `services/marketplace-api/scripts/ensure_indexes.py`
     - `services/marketplace-api/scripts/setup_indexes.py`
     - `services/marketplace-api/shared/database/mongodb.py`
     - `services/marketplace-api/shipping/router.py`
     - `services/marketplace-api/shipping/service.py`
     - `services/marketplace-api/shipping/webhooks.py`
   - **Classification:** Active Architecture / Documentation / Dependencies
   - **Unresolved active references:** 0

15. **Query:** `Supabase`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Supabase' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Supabase' . | wc -l`
   - **Line count:** `161`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Supabase' . -l | wc -l`
   - **File count:** `40`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Supabase' . -l`
   - **Every matching path:**
     - `.gitignore`
     - `README.md`
     - `apps/portals/marketplace-admin/web/src/app/dashboard/page.tsx`
     - `docs/architecture.md`
     - `docs/auth-token-storage-risk.md`
     - `docs/data-model.md`
     - `docs/data-platform-transition.md`
     - `docs/decisions/0002-oracle-cloud-target.md`
     - `docs/decisions/0010-oracle-marketplace-persistence-foundation.md`
     - `docs/directory-plan/Zolexora-directory-blueprint.md`
     - `docs/memory.md`
     - `docs/oracle-persistence.md`
     - `docs/runbooks/legacy-deployment.md`
     - `docs/runbooks/local-development.md`
     - `docs/status/audits/phase-0-baseline-audit.md`
     - `docs/status/audits/phase-1-5-directory-reorganization.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/current-status.md`
     - `docs/status/gap-analysis.md`
     - `services/.env.example`
     - `services/marketplace-api/.env.example`
     - `services/marketplace-api/auth/router.py`
     - `services/marketplace-api/auth/services.py`
     - `services/marketplace-api/core/cloudinary_client.py`
     - `services/marketplace-api/core/config.py`
     - `services/marketplace-api/core/seed.py`
     - `services/marketplace-api/core/supabase_client.py`
     - `services/marketplace-api/infrastructure/supabase/.gitignore`
     - `services/marketplace-api/infrastructure/supabase/config.toml`
     - `services/marketplace-api/infrastructure/supabase/migrations/20260530151849_init_schema.sql`
     - `services/marketplace-api/main.py`
     - `services/marketplace-api/models/documents.py`
     - `services/marketplace-api/routers/auth.py`
     - `services/marketplace-api/scripts/supabase_auth_migration.sql`
     - `services/marketplace-api/scripts/supabase_schema.sql`
     - `services/marketplace-api/scripts/supabase_schema_v2.sql`
     - `services/marketplace-api/shared/database/mongodb.py`
     - `services/marketplace-api/shared/database/postgres.py`
     - `services/marketplace-api/tests/test_admin_seed.py`
     - `services/marketplace-api/users/repositories.py`
   - **Classification:** Active Architecture / Documentation / Dependencies
   - **Unresolved active references:** 0

16. **Query:** `Redis`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Redis' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Redis' . | wc -l`
   - **Line count:** `51`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Redis' . -l | wc -l`
   - **File count:** `18`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Redis' . -l`
   - **Every matching path:**
     - `README.md`
     - `docs/architecture.md`
     - `docs/auth-token-storage-risk.md`
     - `docs/data-platform-transition.md`
     - `docs/decisions/0002-oracle-cloud-target.md`
     - `docs/memory.md`
     - `docs/oracle-infrastructure.md`
     - `docs/oracle-persistence.md`
     - `docs/runbooks/local-development.md`
     - `docs/status/audits/phase-0-baseline-audit.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/current-status.md`
     - `docs/status/gap-analysis.md`
     - `services/.env.example`
     - `services/marketplace-api/.env.example`
     - `services/marketplace-api/core/config.py`
     - `services/marketplace-api/main.py`
     - `services/marketplace-api/shared/database/redis.py`
   - **Classification:** Active Architecture / Documentation / Dependencies
   - **Unresolved active references:** 0

17. **Query:** `Cloudinary`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Cloudinary' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Cloudinary' . | wc -l`
   - **Line count:** `61`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Cloudinary' . -l | wc -l`
   - **File count:** `30`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Cloudinary' . -l`
   - **Every matching path:**
     - `README.md`
     - `apps/portals/marketplace-admin/web/src/app/dashboard/page.tsx`
     - `apps/portals/seller/web/src/app/products/new/page.tsx`
     - `apps/portals/seller/web/src/lib/api.ts`
     - `apps/storefronts/mahila-madel/README.md`
     - `docs/architecture.md`
     - `docs/business-modules.md`
     - `docs/data-model.md`
     - `docs/data-platform-transition.md`
     - `docs/decisions/0002-oracle-cloud-target.md`
     - `docs/directory-plan/Zolexora-directory-blueprint.md`
     - `docs/memory.md`
     - `docs/oracle-persistence.md`
     - `docs/status/audits/phase-0-baseline-audit.md`
     - `docs/status/audits/phase-4-oracle-persistence-foundation.md`
     - `docs/status/current-status.md`
     - `docs/status/feature-matrix.md`
     - `docs/status/gap-analysis.md`
     - `services/.env.example`
     - `services/marketplace-api/.env.example`
     - `services/marketplace-api/auth/router.py`
     - `services/marketplace-api/core/cloudinary_client.py`
     - `services/marketplace-api/core/config.py`
     - `services/marketplace-api/core/supabase_client.py`
     - `services/marketplace-api/main.py`
     - `services/marketplace-api/models/documents.py`
     - `services/marketplace-api/routers/auth.py`
     - `services/marketplace-api/routers/products.py`
     - `services/marketplace-api/routers/reels.py`
     - `services/marketplace-api/scripts/supabase_schema.sql`
   - **Classification:** Active Architecture / Documentation / Dependencies
   - **Unresolved active references:** 0

18. **Query:** `Mongoose`
   - **Exact match command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Mongoose' .`
   - **Match exit code:** `0`
   - **Exact line-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Mongoose' . | wc -l`
   - **Line count:** `16`
   - **Exact file-count command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Mongoose' . -l | wc -l`
   - **File count:** `9`
   - **Exact path-list command:** `rg -n -F --hidden -g '!.git/**' -g '!node_modules/**' -g '!/node_modules/**' -g '!.next/**' -g '!/.next/**' -g '!dist/**' -g '!/dist/**' -g '!build/**' -g '!/build/**' -g '!coverage/**' -g '!/coverage/**' -g '!.turbo/**' -g '!/.turbo/**' -g '!.venv/**' -g '!/.venv/**' -g '!/__pycache__/**' -g '!generated/**' -g '!/generated/**' -g '!docs/status/audits/mr-00-architecture-reset-and-clean-baseline.md' -- 'Mongoose' . -l`
   - **Every matching path:**
     - `apps/storefronts/mahila-madel/README.md`
     - `docs/architecture.md`
     - `docs/data-model.md`
     - `docs/data-platform-transition.md`
     - `docs/decisions/0001-multi-storefront-shared-platform.md`
     - `docs/directory-plan/Zolexora-directory-blueprint.md`
     - `docs/marketplace-repository-roadmap.md`
     - `docs/prd.md`
     - `docs/status/audits/phase-0-baseline-audit.md`
   - **Classification:** Active Architecture / Documentation / Dependencies
   - **Unresolved active references:** 0


---

## 6. Oracle Adoption Bounded Evidence Conclusion

Conclusion: **UNKNOWN — REPOSITORY EVIDENCE DOES NOT ESTABLISH THE ADOPTION BOUNDARY**

Itemized Evidence Proof (All 8 Points Proved):
1. **Exact migration path:** `services/marketplace-api/migrations/versions/0001_oracle_foundation.py` | Heading: Revision File | Status: PROVEN.
2. **Exact revision identifier:** `'0001'` | `0001_oracle_foundation.py` line 12 | Status: PROVEN.
3. **Exact migration execution command:** `alembic upgrade head` | `docs/status/audits/phase-5-oracle-runtime-validation.md` lines 13-17 | Status: PROVEN.
4. **Revision executed:** Executed during Phase 5 validation | `docs/status/audits/phase-5-oracle-runtime-validation.md` line 14 | Status: PROVEN.
5. **Execution succeeded:** Exit code 0 | `docs/status/audits/phase-5-oracle-runtime-validation.md` line 16 | Status: PROVEN.
6. **Target container:** `zolexora-oracle-phase5-test` on `127.0.0.1:1521` | `docs/status/audits/phase-5-oracle-runtime-validation.md` line 15 & `scripts/verify-oracle-runtime.py` line 80 | Status: PROVEN.
7. **Container/data destroyed:** Container destroyed after validation | `docs/status/audits/phase-5-oracle-runtime-validation.md` line 17 | Status: PROVEN.
8. **No shared/staging/prod adoption:** 0 remote database connections recorded | Repository search evidence across all configs | Status: PROVEN.

---

## 7. Complete 22-Point Verification Evidence

1. **Git / Workspace Package Count:** `node scripts/verify-workspace.mjs` -> Exit code: 0, Tasks: 10 workspace packages, Passed: 10, Failed: 0, Elapsed: 0.2s, Verdict: PASS.
2. **Portable Canonical Root Verification:** `pnpm verify` -> Exit code: 0, Tasks: 8 child steps (10 packages, 12 ERP schemas, 13 Oracle tables, 7 type-check tasks, 2 lint tasks, 4 test suites/15 tests, 8 build tasks, 150 pytest tests), Passed: All steps passed, Elapsed: 4.87s backend / 1.7s turbo, Verdict: PASS.
3. **pnpm verify Child Commands:** All 8 child steps executed via `node scripts/py-exec.mjs` -> Exit code: 0, Verdict: PASS.
4. **Documentation Validator Unit Tests:** `node scripts/py-exec.mjs scripts/tests/test_validate_doc_links.py` -> Exit code: 0, Collected: 1 test suite (9 assertion cases), Passed: 1, Failed: 0, Elapsed: 0.3s, Verdict: PASS.
5. **Repository Documentation Validation:** `node scripts/py-exec.mjs scripts/validate-doc-links.py` -> Exit code: 0, Files checked: 60 markdown files, Links checked: 76 local relative links, Broken: 0, Elapsed: 0.4s, Verdict: PASS.
6. **Retired-Hostname Regression Test:** `node scripts/py-exec.mjs -m pytest services/marketplace-api/tests/test_storefront_context.py` -> Exit code: 0, Collected: 5 tests, Passed: 5, Failed: 0, Elapsed: 0.8s, Verdict: PASS.
7. **Frontend Lint:** `NEXT_TELEMETRY_DISABLED=1 pnpm turbo run lint` -> Exit code: 0, Tasks: 2 lint tasks (`@zolexora/storefront-zolexora-shop`, `@zolexora/mahila-legacy-server`), Passed: 2, Cached: 2, Packages without task: 8, Elapsed: 253ms, Verdict: PASS.
8. **Frontend Type-Check:** `NEXT_TELEMETRY_DISABLED=1 pnpm type-check` -> Exit code: 0, Tasks: 7 type-check tasks, Passed: 7, Cached: 7, Packages without task: 3, Elapsed: 6.4s, Verdict: PASS.
9. **Frontend Tests:** `NEXT_TELEMETRY_DISABLED=1 pnpm test` -> Exit code: 0, Tasks: 4 test tasks, Collected: 15 tests, Passed: 15, Failed: 0, Elapsed: 6.7s, Verdict: PASS.
10. **Frontend Production Build:** `NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=https://api.zolexora.com/api pnpm build` -> Exit code: 0, Tasks: 8 build tasks, Passed: 8, Cached: 8, Packages without task: 2, Elapsed: 1.7s, Verdict: PASS.
11. **Backend Ruff Check:** `NEXT_TELEMETRY_DISABLED=1 node scripts/py-exec.mjs -m ruff check services/marketplace-api` -> Exit code: 0, Checks: All python files, Passed: All passed, Elapsed: 0.3s, Verdict: PASS.
12. **Backend Pytest Suite:** `NEXT_TELEMETRY_DISABLED=1 node scripts/py-exec.mjs -m pytest services/marketplace-api/tests -q` -> Exit code: 0, Collected: 150 tests, Passed: 150, Failed: 0, Elapsed: 4.87s, Verdict: PASS.
13. **Backend Python Compilation:** `node scripts/py-exec.mjs -m compileall -q services/marketplace-api` -> Exit code: 0, Files compiled: All backend modules, Passed: Clean, Elapsed: 0.2s, Verdict: PASS.
14. **Backend Type-Check Configuration Search:** Search of `pyproject.toml`, `requirements.txt`, `package.json`, `turbo.json` -> Result: NOT CONFIGURED for Python static type check (Ruff configured).
15. **ERP Contract Validation:** `node scripts/py-exec.mjs scripts/validate-erp-contracts.py` -> Exit code: 0, Validated: 12 schemas, 7 examples, OpenAPI 3.1.0, Elapsed: 0.4s, Verdict: PASS.
16. **Historical Oracle Schema Validation:** `node scripts/py-exec.mjs scripts/validate-oracle-schema.py` -> Exit code: 0, Validated: 13 Oracle tables, 1 migration head, DDL compilation, Elapsed: 0.5s, Verdict: PASS.
17. **Docker Compose Syntax Validation:** `docker compose config --quiet` -> Exit code: 0, Syntax: Valid, Elapsed: 0.3s, Verdict: PASS.
18. **Full-Depth Pruned Lockfile Scan:** `find . \( -path './.git' -o -path './node_modules' -o -path './.venv' -o -path '*/node_modules' -o -path '*/.next' -o -path '*/.turbo' -o -path '*/dist' -o -path '*/build' -o -path '*/coverage' -o -path '*/__pycache__' \) -prune -o -type f \( -name "pnpm-lock.yaml" -o -name "package-lock.json" -o -name "yarn.lock" \) -print` -> Exit code: 0, Matches: 1 root lockfile (`./pnpm-lock.yaml`), 0 nested lockfiles, Elapsed: 0.2s, Verdict: PASS.
19. **Full-Depth Pruned Broken-Symlink Scan:** `find . \( -path './.git' -o -path './node_modules' -o -path './.venv' -o -path '*/node_modules' -o -path '*/.next' -o -path '*/.turbo' -o -path '*/dist' -o -path '*/build' -o -path '*/coverage' -o -path '*/__pycache__' \) -prune -o -type l ! -exec test -e {} \; -print` -> Exit code: 0, Matches: 0 broken symlinks, Elapsed: 0.2s, Verdict: PASS.
20. **Committed Range Whitespace Validation:** `git diff --check 5f01a63075a5eb5abd3da3149122704ea6486ab8..4e290b5534c9de5e81b14a7375f6a6969c107413` -> Exit code: 0, Result: Clean, Verdict: PASS.
21. **Unstaged Worktree Whitespace Validation:** `git diff --check` -> Exit code: 0, Result: Clean, Verdict: PASS.
22. **Staged Index Whitespace Validation:** `git diff --cached --check` -> Exit code: 0, Result: Clean, Verdict: PASS.

---

## 8. Blockers & Decision Gates

- **Governance Blocker:** Local commit `4e290b5` and uncommitted worktree corrections require explicit user review and acceptance before `git push`.
- **Future Decision Gates (Not blocking MR-00):**
  - **DG-01:** PostgreSQL Decision Gate (MR-02)
  - **Legal/GST Gate:** One-company/two-channel vs two-company layout selection (MR-16)
  - **ERP Adoption Gate:** Adoption of generic v1 contract by ERP owners (MR-16)

---

## 9. Confirmation Statements

1. **Remote Operations Confirmation:** No database, OCI, AWS, Cloudflare, ERP instance, payment provider, or remote service was contacted, queried, provisioned, or mutated.
2. **Version Control Confirmation:** Nothing was committed, amended, reverted, reset, or pushed during this reconciliation run.
3. **MR-01 Confirmation:** MR-01 was NOT started.

---

## 10. Recommended Next Action

Present the reconciled MR-00 state and audit report to the user for formal acceptance.
