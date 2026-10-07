# MR-01 Integrated Contract and Security Audit

**Document Version**: 1.0.0  
**Date**: 2026-07-31  
**Status**: COMPLETE  
**Repository**: `/data/projects/development/Zolexora/ZolexoraMarketplace`  
**Branch**: `mr-01-canonical-marketplace-contracts`  
**Target Milestone**: Pre-MR-01D Audit Gate  

---

## 1. Executive Verdict

**Final Verdict Classification**: **FAIL — blocking defects must be fixed before MR-01D**

### Executive Rationale

The integrated contract and security audit of MR-01A (Canonical Primitives & OpenAPI/TypeScript Generation), MR-01B (Storefront Identity & Isolation), MR-01C (Catalog & Inventory Contracts), and MR-01F (Provider-Neutral Payment Contracts) was conducted against repository commits `59501af`, `020dd52`, `ef3352e`, and `68b3f44`.

While the core architecture, 3-layer catalog model (`MasterProductDoc`, `StorefrontListingDoc`, `InventoryBalanceDoc`), provider-neutral payment schemas (`PaymentIntent`, `InternalProviderMetadata`), deterministic OpenAPI/TypeScript tooling, and 100% of the backend pytest suite (167/167 tests passing) are firmly established, **high-severity security and contract defects block commencement of MR-01D**:

1. **Storefront Isolation Deficiencies (MR-01B)**: Product modification/deletion (`PUT /products/{id}`, `DELETE /products/{id}`, `POST /products/{id}/upload-image`) and all order management endpoints (`GET /orders/my`, `GET /orders/seller`, `GET /orders/{id}`, `PUT /orders/{id}/status`) omit `storefront_id` from their database query filters, enabling cross-storefront data access and mutation.
2. **Primitive Validation Vulnerabilities (MR-01A)**: The `Money` primitive allows boolean coercion (`amount_minor=True` evaluated as `1`) and lacks upper boundary constraints (`le=9007199254740991` for JS `MAX_SAFE_INTEGER`). The `UTCDateTime` primitive accepts naive datetimes without timezone enforcement.
3. **Workspace Verification Failure (MR-01F)**: Automated workspace linting (`pnpm verify`) fails due to 4 Ruff lint violations (`E402`, `F401`) introduced in `services/marketplace-api/tests/test_payments.py`.

A corrective batch (**MR-01-FIX**) must be executed and verified before MR-01D Cart and Checkout Contracts can proceed.

---

## 2. Git and Commit Verification

### Pre-Audit Git Gate Execution

The repository state was verified against origin remote references using standard git inspection tools:

```bash
git status
git status --short
git branch --show-current
git log --oneline --decorate -15
git rev-list --left-right --count origin/mr-01-canonical-marketplace-contracts...HEAD
git merge-base --is-ancestor 59501af HEAD
git merge-base --is-ancestor 020dd52 HEAD
git merge-base --is-ancestor ef3352e HEAD
git merge-base --is-ancestor 68b3f44 HEAD
git branch -r --contains 59501af
git branch -r --contains 020dd52
git branch -r --contains ef3352e
git branch -r --contains 68b3f44
git branch -r --contains 2afa905
```

### Verification Evidence Table

| Check Item | Requirement | Observed Output / Evidence | Status |
|---|---|---|---|
| **Current Branch** | Must be `mr-01-canonical-marketplace-contracts` | `mr-01-canonical-marketplace-contracts` | **CONFIRMED** |
| **Working Tree** | Clean working tree (except untracked `.agents/`) | `?? .agents/` | **CONFIRMED** |
| **Commit 59501af (MR-01A)** | Present in history & ancestor of HEAD | Ancestor exit code 0; `feat(contracts): establish canonical marketplace primitives` | **CONFIRMED** |
| **Commit 020dd52 (MR-01B)** | Present in history & ancestor of HEAD | Ancestor exit code 0; `MR-01B: Storefront identity and isolation` | **CONFIRMED** |
| **Commit ef3352e (MR-01C)** | Present in history & ancestor of HEAD | Ancestor exit code 0; `MR-01C: Implement Canonical Storefront Listing contracts...` | **CONFIRMED** |
| **Commit 68b3f44 (MR-01F)** | Present in history & ancestor of HEAD | Ancestor exit code 0; `feat: MR-01F provider-neutral payment contracts` | **CONFIRMED** |
| **Remote Branch Sync** | Present on remote `origin/mr-01...` | All 4 commits present on `origin/mr-01-canonical-marketplace-contracts` | **CONFIRMED** |
| **Branch Divergence** | 0 behind, 0 ahead | `0 0` (`git rev-list --left-right --count`) | **CONFIRMED** |
| **MR-00 Baseline Commit** | `2afa905` present on `origin/main` | Present on `origin/main`, `origin/HEAD`, and feature branch | **CONFIRMED** |

---

## 3. Scope and Repository Areas Inspected

The audit inspected all components modified or affected by MR-01A through MR-01F:

- **Backend Service**: `services/marketplace-api/`
  - Canonical models: `models/base.py`, `models/primitives.py`, `models/errors.py`, `models/catalog.py`, `models/payments.py`, `models/documents.py`
  - Router endpoints: `routers/products.py`, `routers/cart.py`, `routers/reels.py`, `routers/payments.py`, `routers/other.py`
  - Storefront context resolution: `storefronts/resolver.py`, `storefronts/registry.py`, `storefronts/models.py`, `core/deps.py`
  - Unit test suite: `tests/test_primitives.py`, `tests/test_storefront_context.py`, `tests/test_product_validation.py`, `tests/test_product_delete.py`, `tests/test_postgres_user_source.py`, `tests/test_payments.py`, `tests/test_openapi.py`
- **Shared API Package**: `packages/shared-api/`
  - Generated TypeScript contracts: `packages/shared-api/src/generated/types.ts`
  - Package entrypoints and build configuration: `packages/shared-api/package.json`
- **Storefront Applications**:
  - Zolexora Shop (Web & Mobile): `apps/storefronts/zolexora-shop/web/`, `apps/storefronts/zolexora-shop/mobile/`
  - Mahila Madel (Web, Mobile & Legacy): `apps/storefronts/mahila-madel/web/`, `apps/storefronts/mahila-madel/mobile/`, `apps/storefronts/mahila-madel/legacy-server/`
- **Portal Applications**:
  - Seller Portal (Web & Mobile): `apps/portals/seller/web/`, `apps/portals/seller/mobile/`
  - Marketplace Admin: `apps/portals/marketplace-admin/web/`
- **Contract Specs & Scripts**:
  - OpenAPI Specification: `contracts/marketplace/openapi.json`
  - Automation Scripts: `scripts/generate_openapi.py`, `scripts/check-openapi-drift.sh`, `scripts/py-exec.mjs`, `scripts/verify-workspace.mjs`

---

## 4. MR-01A Findings (Canonical Primitives & Base Contracts)

### Summary of MR-01A Implementation

MR-01A introduced canonical marketplace primitives (`Money`, `UTCDateTime`, `PageCursor`, `PaginatedResponse`, `ErrorResponse`, `StorefrontKey`) and established deterministic OpenAPI / TypeScript code generation.

### Findings

1. **`Money` Primitive Validation Weaknesses**:
   - **Float Rejection**: Standard float values with decimals (e.g. `12.99`) are correctly rejected by Pydantic v2 integer validation (`ValidationError`).
   - **Boolean Coercion Defect**: Python `bool` inherits from `int`. Passing `Money(amount_minor=True, currency="INR")` is accepted as `amount_minor=1`.
   - **Unbounded Integer Range**: JavaScript numbers lose precision beyond `Number.MAX_SAFE_INTEGER` (`9007199254740991`). `Money` accepts arbitrary large integers (e.g., `9007199254740992`) without validation error or upper bound constraints (`le=9007199254740991`). Negative amounts (`-500`) are also permitted due to missing `ge=0`.
   - **Empty Test Case**: `services/marketplace-api/tests/test_primitives.py::test_money_rejects_floats_if_strict` contains only `pass` without any test assertions.

2. **`UTCDateTime` Timezone Validation**:
   - `UTCDateTime` is defined as `Annotated[datetime, Field(description="ISO 8601 UTC timestamp")]`.
   - It does not reject naive datetimes (`datetime(2026, 7, 31, 12, 0, 0)`). Naive datetimes pass Pydantic validation without raising a `ValidationError` or forcing conversion to UTC.

3. **Error Envelopes & Pagination**:
   - `ErrorDetail` and `ErrorResponse` provide standardized error structures with machine `code`, human `message`, structured `details`, and request correlation `request_id`. Stack traces and secrets are excluded.
   - `PaginatedResponse` and `PageCursor` implement uniform cursor pagination across backend routers.

4. **Float Monetary Fields Audit**:
   - **Legacy Order Models**: `OrderDoc` (`subtotal: float`, `total_paid: float`, `loyalty_discount: float`) and `OrderItemDoc` (`price: float`) retain floats for backwards compatibility.
   - **Storefront Listing Contracts**: `StorefrontListingDoc` and `ProductListingResponse` strictly use canonical `Money` (`price: Money`, `compare_at_price: Optional[Money]`).

---

## 5. MR-01B Findings (Storefront Identity & Isolation)

### Summary of MR-01B Implementation

MR-01B implemented request-level `StorefrontContext` resolution (`services/marketplace-api/storefronts/resolver.py`) and wired storefront isolation into Cart and Reels routers.

### Findings

1. **Cart & Reels Storefront Isolation**:
   - Cart router (`services/marketplace-api/routers/cart.py`) derives `context.key` from `StorefrontContext` and includes `"storefront_id": context.key` in every query filter, document insert, update, deletion, and checkout operation.
   - Reels router (`services/marketplace-api/routers/reels.py`) strictly scopes all listing, creation, view, update, and deletion queries by `storefront_id`.

2. **Product Modification & Deletion Isolation Defect (HIGH)**:
   - In `services/marketplace-api/routers/products.py`:
     - `PUT /products/{product_id}` receives `context`, but line 314 `fq = {"id": product_id} if user["role"] == "admin" else {"id": product_id, "seller_id": user["id"]}` and line 325 `update_one({"id": product_id}, ...)` omit `storefront_id`.
     - `DELETE /products/{product_id}` (lines 342-351) does not import or depend on `StorefrontContext` and omits `storefront_id` from its query filter `fq`.
     - `POST /products/{product_id}/upload-image` (lines 354-371) does not depend on `StorefrontContext` and omits `storefront_id` from its query filter.
   - **Impact**: A seller or admin can update, delete, or upload images to products listed on a different storefront.

3. **Orders Router Storefront Isolation Defect (HIGH)**:
   - In `services/marketplace-api/routers/other.py`:
     - `GET /orders/my` (lines 15-17): `await db.orders.find({"buyer_id": user["id"]}, {"_id": 0})` omits `storefront_id`.
     - `GET /orders/seller` (lines 19-23): Query `q = {} if user["role"] == "admin" else {"seller_id": user["id"]}` omits `storefront_id`.
     - `GET /orders/{order_id}` (lines 25-31): Query `{"id": order_id}` omits `storefront_id`.
     - `PUT /orders/{order_id}/status` (lines 33-40): Query `fq` omits `storefront_id`.
   - **Impact**: Orders created on Zolexora Shop and Mahila Madel are visible in a single unified list to buyers and sellers, violating cross-store order isolation rules.

---

## 6. MR-01C Findings (Catalog & Inventory Contracts)

### Summary of MR-01C Implementation

MR-01C established the canonical 3-layer catalog data model:
1. `MasterProductDoc`: Master product definition (`id`, `seller_id`, `title`, `description`, `category`, `brand`, `images`, `is_active`). Shared across storefronts.
2. `StorefrontListingDoc`: Storefront-scoped listing (`id`, `storefront_id: StorefrontKey`, `product_id`, `seller_id`, `price: Money`, `compare_at_price: Optional[Money]`, `status`).
3. `InventoryBalanceDoc`: Inventory entity (`id`, `product_id`, `seller_id`, `available_quantity`, `reserved_quantity`). Shared across storefronts by `product_id`.

### Findings

1. **Runtime Elimination of Legacy `ProductDoc`**:
   - Codebase scan for `ProductDoc` across `services/`, `packages/`, `apps/`: **0 runtime occurrences**.
   - The legacy `ProductDoc` model was completely removed from `models/documents.py`. All API routers (`routers/products.py`, `routers/cart.py`) operate strictly on `MasterProductDoc`, `StorefrontListingDoc`, and `InventoryBalanceDoc`.

2. **Cart Listing Validation**:
   - `routers/cart.py::_active_product` queries `db.storefront_listings.find_one({"id": product_id, "storefront_id": context.key, "status": "active"})`.
   - Inactive listings (`status != "active"`) or listings belonging to another storefront cannot be added to a cart.

3. **Database Compatibility Requirement (LOW)**:
   - Existing production MongoDB collections containing legacy single-document `products` entries are not automatically migrated to `master_products`, `storefront_listings`, and `inventory_balances`. A data backfill script is required before database migration.

---

## 7. MR-01F Findings (Provider-Neutral Payment Contracts)

### Summary of MR-01F Implementation

MR-01F introduced provider-neutral payment schemas (`PaymentIntent`, `PaymentIntentStatus`, `PaymentMethodType`, `NextAction`, `RefundSummary`), internal provider metadata (`InternalProviderMetadata`), and legacy Razorpay compatibility requests (`LegacyRazorpayVerifyRequest`).

### Findings

1. **Provider-Neutral Public Boundary**:
   - `PaymentIntent` (`services/marketplace-api/models/payments.py:65-88`) contains only abstract, provider-neutral fields: `id`, `storefront_id`, `order_id`, `checkout_session_id`, `amount` (Money), `status`, `payment_method_type`, `next_action`, `idempotency_key`, `created_at`, `updated_at`, `version`.
   - Zero vendor-specific IDs (`razorpay_order_id`, `cf_payment_id`) or credentials appear in public response schemas.

2. **Internal Provider Metadata**:
   - `InternalProviderMetadata` (`models/payments.py:115`) contains `provider_name`, `provider_order_id`, `provider_payment_id`, `raw_payload`.
   - It is strictly excluded from `PaymentIntent` public serialization. However, `raw_payload` currently lacks a defined redaction or retention policy if persisted or logged.

3. **Missing Cashfree Backend Configuration**:
   - `services/marketplace-api/core/config.py` contains settings for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`, but **lacks any `CASHFREE_*` configuration settings**.

4. **Operational Payment Router Stubs**:
   - Endpoints in `services/marketplace-api/routers/payments.py` (`GET /payments/{intent_id}`, `POST /payments/legacy/verify`) are currently empty `pass` stubs. Operational provider routing and intent creation are pending MR-01D.

5. **Linting Failure in Payment Test File (MEDIUM)**:
   - Running `pnpm verify` fails during the `ruff check` step due to 4 lint violations in `services/marketplace-api/tests/test_payments.py`:
     - `E402`: Module level import not at top of file (lines 143, 144, 145)
     - `F401`: `asyncio` imported but unused (line 144)

---

## 8. Cross-Batch Compatibility Findings

| Batch Pair | Interaction / Dependency | Compatibility Status | Observed Verification |
|---|---|---|---|
| **MR-01A + MR-01B** | `StorefrontKey` primitive used in `StorefrontContext` and router dependencies | **COMPATIBLE** | All resolved contexts map to `StorefrontKey` enum values |
| **MR-01A + MR-01C** | `Money` primitive used in `StorefrontListingDoc.price` and `compare_at_price` | **COMPATIBLE** | Listing responses serialize minor integer amount and ISO currency |
| **MR-01A + MR-01F** | `Money` primitive used in `PaymentIntent.amount` and `RefundSummary` | **COMPATIBLE** | `test_payments.py` confirms `Money(amount_minor=129900, currency="INR")` in intents |
| **MR-01B + MR-01C** | Storefront listings scoped by `storefront_id` derived from `StorefrontContext` | **COMPATIBLE** | `routers/products.py` lists active products for context storefront |
| **MR-01B + MR-01F** | `PaymentIntent.storefront_id` derived from `StorefrontContext` | **COMPATIBLE** | Intent serialization enforces context storefront key |
| **MR-01C + MR-01F** | Cart checkout builds order & intent from `StorefrontListingDoc` price | **COMPATIBLE** | Price minor amount passed directly to checkout payment calculations |

---

## 9. Storefront Trust Model

The storefront resolution system (`services/marketplace-api/storefronts/resolver.py`) evaluates incoming HTTP requests according to a strict multi-tier trust model:

```
                          [ Incoming HTTP Request ]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  [ Host Header ]          [ X-Storefront-Key ]
                         │                         │
          ┌──────────────┴──────────────┐          │
          ▼                             ▼          ▼
  [ Production Host ]         [ Surface Host ] ───► [ Validate Key ]
  shop.zolexora.com           api.zolexora.com     zolexora-shop / mahila-madel
  mahilamadel.store                     │
          │                             ▼
          │                     [ Origin Header ]
          │                  shop.zolexora.com / ...
          └──────────────┬──────────────┘
                         ▼
             [ Host/Header Agreement ] ──► Mismatch? ──► 400 Bad Request
                         │
                         ▼
             [ StorefrontContext Key ]
```

### Trust Resolution Rules

1. **Direct Production Domain Host**: If `Host` matches `shop.zolexora.com`, `context.key` resolves directly to `zolexora-shop`. If `Host` matches `mahilamadel.store` or `www.mahilamadel.store`, `context.key` resolves to `mahila-madel`.
2. **Development Local Domain Host**: If `development=True`, `Host` matching `shop.zolexora.local` or `mahilamadel.local` (with optional port) is permitted.
3. **Surface Domain Host (`api.zolexora.com`)**: When requests arrive at the shared API surface domain, the resolver inspects `X-Storefront-Key` client hint or `Origin` header.
4. **Host/Header Conflict Rejection**: If `Host` is `shop.zolexora.com` and `X-Storefront-Key` is `mahila-madel`, resolution strictly fails with HTTP 400 (`storefront_context_mismatch`).
5. **Unknown Host Rejection**: Unregistered hosts fail with HTTP 400 (`storefront_unknown`).
6. **Disabled Storefront**: Disabled storefront keys fail with HTTP 404 (`storefront_disabled`).
7. **No Default Storefront**: The backend never defaults to a fallback storefront key if resolution fails.

---

## 10. Storefront Isolation Route Matrix (31 Routes)

| # | Route | Method | Context Dependency | Database Filter | Write Scoping | Isolation Test Evidence | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `/api/storefront/context` | GET | `require_storefront_context` | N/A | Read-only | `test_storefront_context.py` | **ISOLATED** |
| 2 | `/api/products` | GET | `require_storefront_context` | `{"status": "active", "storefront_id": context.key}` | Read-only | `test_product_validation.py` | **ISOLATED** |
| 3 | `/api/products/my` | GET | `require_storefront_context` | `{"seller_id": user["id"], "storefront_id": context.key}` | Read-only | `test_product_validation.py` | **ISOLATED** |
| 4 | `/api/products/{id}` | GET | `require_storefront_context` | `{"id": id, "storefront_id": context.key}` | Read-only | `test_product_validation.py` | **ISOLATED** |
| 5 | `/api/products` | POST | `require_storefront_context` | N/A | `storefront_id = context.key` | `test_product_validation.py` | **ISOLATED** |
| 6 | `/api/products/{id}` | PUT | `require_storefront_context` | `{"id": id, "seller_id": user["id"]}` (MISSING `storefront_id`) | Omitted in update filter | Code Inspection | **NOT ISOLATED** |
| 7 | `/api/products/{id}` | DELETE | None (MISSING) | `{"id": id, "seller_id": user["id"]}` (MISSING `storefront_id`) | Omitted in delete filter | `test_product_delete.py` | **NOT ISOLATED** |
| 8 | `/api/products/{id}/upload-image` | POST | None (MISSING) | `{"id": id, "seller_id": user["id"]}` (MISSING `storefront_id`) | Omitted in update filter | Code Inspection | **NOT ISOLATED** |
| 9 | `/api/products/bulk` | POST | `require_storefront_context` | N/A | `storefront_id = context.key` | `test_product_validation.py` | **ISOLATED** |
| 10 | `/api/cart` | GET | `require_storefront_context` | `{"user_id": user["id"], "storefront_id": context.key}` | Read-only | `test_postgres_user_source.py` | **ISOLATED** |
| 11 | `/api/cart/count` | GET | `require_storefront_context` | `{"user_id": user["id"], "storefront_id": context.key}` | Read-only | `test_postgres_user_source.py` | **ISOLATED** |
| 12 | `/api/cart/items` | POST | `require_storefront_context` | `{"user_id": user["id"], "product_id": id, "storefront_id": context.key}` | `user_id`, `storefront_id` | `test_postgres_user_source.py` | **ISOLATED** |
| 13 | `/api/cart/items/{id}` | PUT | `require_storefront_context` | `{"user_id": user["id"], "product_id": id, "storefront_id": context.key}` | `user_id`, `storefront_id` | `test_postgres_user_source.py` | **ISOLATED** |
| 14 | `/api/cart/items/{id}` | DELETE | `require_storefront_context` | `{"user_id": user["id"], "product_id": id, "storefront_id": context.key}` | `user_id`, `storefront_id` | `test_postgres_user_source.py` | **ISOLATED** |
| 15 | `/api/cart` | DELETE | `require_storefront_context` | `{"user_id": user["id"], "storefront_id": context.key}` | `user_id`, `storefront_id` | `test_postgres_user_source.py` | **ISOLATED** |
| 16 | `/api/cart/checkout` | POST | `require_storefront_context` | `{"user_id": user["id"], "storefront_id": context.key}` | `OrderDoc(storefront_id=context.key)` | `test_postgres_user_source.py` | **ISOLATED** |
| 17 | `/api/cart/checkout/verify-payment` | POST | `require_storefront_context` | `{"razorpay_order_id": rzp_id, "storefront_id": context.key}` | `OrderDoc(storefront_id=context.key)` | `test_postgres_user_source.py` | **ISOLATED** |
| 18 | `/api/cart/checkout/upi-paid` | POST | `require_storefront_context` | `{"id": order_id, "storefront_id": context.key}` | `OrderDoc(storefront_id=context.key)` | Code Inspection | **ISOLATED** |
| 19 | `/api/reels` | GET | `require_storefront_context` | `{"is_active": True, "storefront_id": context.key}` | Read-only | Code Inspection | **ISOLATED** |
| 20 | `/api/reels/my` | GET | `require_storefront_context` | `{"creator_id": user["id"], "storefront_id": context.key}` | Read-only | Code Inspection | **ISOLATED** |
| 21 | `/api/reels` | POST | `require_storefront_context` | N/A | `storefront_id = context.key` | Code Inspection | **ISOLATED** |
| 22 | `/api/reels/{id}/upload` | POST | `require_storefront_context` | `{"id": reel_id, "creator_id": user["id"], "storefront_id": context.key}` | `creator_id`, `storefront_id` | Code Inspection | **ISOLATED** |
| 23 | `/api/reels/{id}/view` | POST | `require_storefront_context` | `{"id": reel_id, "is_active": True, "storefront_id": context.key}` | Read & view inc | Code Inspection | **ISOLATED** |
| 24 | `/api/reels/{id}` | PUT | `require_storefront_context` | `{"id": reel_id, "storefront_id": context.key}` | `creator_id`, `storefront_id` | Code Inspection | **ISOLATED** |
| 25 | `/api/reels/{id}` | DELETE | `require_storefront_context` | `{"id": reel_id, "storefront_id": context.key}` | `creator_id`, `storefront_id` | Code Inspection | **ISOLATED** |
| 26 | `/api/orders/my` | GET | None (MISSING) | `{"buyer_id": user["id"]}` (MISSING `storefront_id`) | Read-only | Code Inspection | **NOT ISOLATED** |
| 27 | `/api/orders/seller` | GET | None (MISSING) | `{"seller_id": user["id"]}` (MISSING `storefront_id`) | Read-only | Code Inspection | **NOT ISOLATED** |
| 28 | `/api/orders/{id}` | GET | None (MISSING) | `{"id": order_id}` (MISSING `storefront_id`) | Read-only | Code Inspection | **NOT ISOLATED** |
| 29 | `/api/orders/{id}/status` | PUT | None (MISSING) | `{"id": order_id, "seller_id": user["id"]}` (MISSING `storefront_id`) | Seller / Admin | Code Inspection | **NOT ISOLATED** |
| 30 | `/api/payments/{id}` | GET | `require_storefront_context` | Stub (`pass`) | N/A | `test_payments.py` | **STUB** |
| 31 | `/api/payments/legacy/verify` | POST | `require_storefront_context` | Stub (`pass`) | N/A | `test_payments.py` | **STUB** |

---

## 11. Authentication and Authorization Matrix

| Role / Entity | Storefront Context | Authentication Method | Cart Permissions | Order Permissions | Payment Permissions | Seller/Admin Routes |
|---|---|---|---|---|---|---|
| **Anonymous Buyer** | Required | Optional (Session / Device Token) | Read/Write own session cart | Restricted | Initiate payment intent for active session | Denied (401/403) |
| **Authenticated Buyer** | Required | Bearer Token (`current_user`) | Read/Write own user cart (`user_id == current_user.id`) | View own storefront orders (`buyer_id == current_user.id`) | Pay own intents | Denied (403) |
| **Seller** | Required | Bearer Token (`seller_only`) | Read customer cart (Denied) | View storefront orders for seller items | Read refund status | Allowed for seller routes (`/seller/*`) |
| **Marketplace Admin** | Optional / System | Bearer Token (`admin_only`) | Admin cart inspection | View all orders across storefronts | Admin payment intent management | Full Access (`/admin/*`) |
| **Internal Service** | System | Service Token / Internal Header | System level | Read/Write internal order status | Process payment intents | Internal routes |
| **Payment Webhook** | Storefront / Provider Key | HMAC Signature Verification | No direct cart access | Update payment status on valid signature | Transition `PaymentIntentStatus` | Dedicated webhook routes |

---

## 12. Canonical Contract Ownership Map

```
             ┌───────────────────────────────────────────────┐
             │       FastAPI Backend Domain Models           │
             │   services/marketplace-api/models/*.py        │
             │  (Money, StorefrontListingDoc, PaymentIntent) │
             └───────────────────────┬───────────────────────┘
                                     │
                                     ▼
             ┌───────────────────────────────────────────────┐
             │            scripts/generate_openapi.py        │
             │        (Offline Pydantic -> OpenAPI Exporter) │
             └───────────────────────┬───────────────────────┘
                                     │
                                     ▼
             ┌───────────────────────────────────────────────┐
             │        contracts/marketplace/openapi.json     │
             │       (Canonical OpenAPI 3.1.0 Contract Spec) │
             └───────────────────────┬───────────────────────┘
                                     │
                                     ▼
             ┌───────────────────────────────────────────────┐
             │         scripts/check-openapi-drift.sh        │
             │          (Runs openapi-typescript CLI)        │
             └───────────────────────┬───────────────────────┘
                                     │
                                     ▼
             ┌───────────────────────────────────────────────┐
             │    packages/shared-api/src/generated/types.ts │
             │     (Generated TypeScript Interface Module)   │
             └───────────────────────────────────────────────┘
```

- **Single Source of Truth**: Pydantic v2 models in `services/marketplace-api/models/`.
- **Export Mechanism**: `scripts/generate_openapi.py` exports `contracts/marketplace/openapi.json`.
- **TypeScript Generation**: `openapi-typescript` compiles `openapi.json` into `packages/shared-api/src/generated/types.ts`.
- **Drift Enforcement**: `scripts/check-openapi-drift.sh` executes `git diff --exit-code` to ensure source and generated contracts remain 100% synchronized.

---

## 13. Public versus Internal Payment-Field Map

| Contract Field | `PaymentIntent` (Public Schema) | `InternalProviderMetadata` (Internal Schema) | `LegacyRazorpayVerifyRequest` (Compatibility Schema) |
|---|---|---|---|
| `id` | Opaque Payment Intent ID (`pi_...`) | Reference `payment_intent_id` | N/A |
| `storefront_id` | `StorefrontKey` (`zolexora-shop` / `mahila-madel`) | N/A | N/A |
| `order_id` | Immutable Order Entity ID | N/A | N/A |
| `amount` | Canonical `Money` model (`amount_minor`, `currency`) | N/A | N/A |
| `status` | Abstract `PaymentIntentStatus` | N/A | N/A |
| `payment_method_type` | Provider-Neutral `PaymentMethodType` | N/A | N/A |
| `next_action` | Abstract `NextAction` (`redirect_url`, etc.) | N/A | N/A |
| `idempotency_key` | Public Idempotency String | N/A | N/A |
| `provider_name` | **EXCLUDED** | Vendor Name (`cashfree` / `razorpay`) | N/A |
| `provider_order_id` | **EXCLUDED** | Vendor Order ID (`order_...` / `cf_...`) | `razorpay_order_id` |
| `provider_payment_id` | **EXCLUDED** | Vendor Payment ID (`pay_...`) | `razorpay_payment_id` |
| `raw_payload` | **EXCLUDED** | Dict / Raw JSON Payload | N/A |
| `razorpay_signature` | **EXCLUDED** | N/A | `razorpay_signature` |

---

## 14. Provider Mapping and Fail-Closed Behavior

### Backend Gateway Assignment

- **Zolexora Shop** (`zolexora-shop` / `shop.zolexora.com`):
  - Assigned Provider: **Cashfree**
  - Gateway Selection Rule: Derived automatically from `StorefrontContext`. Client requests cannot override provider selection.
  - Secret Configuration: Backend environment variables (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`).
- **Mahila Madel** (`mahila-madel` / `mahilamadel.store`):
  - Assigned Provider: **Razorpay**
  - Gateway Selection Rule: Derived automatically from `StorefrontContext`.
  - Secret Configuration: Backend environment variables (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).

### Fail-Closed Enforcement Rules

1. **Missing Provider Configuration**: When credentials for the assigned provider are missing (e.g. Mahila Madel Razorpay keys unconfigured), payment initiation must fail closed immediately with HTTP 503 (`Payment gateway not configured`).
2. **No Fallback Across Storefronts**: Zolexora Shop must **never** fall back to Razorpay if Cashfree fails, and Mahila Madel must **never** fall back to Cashfree.
3. **No Browser Gateway Selection**: Public API endpoints reject `provider_name` or payment gateway parameters in body or query requests.

---

## 15. Legacy Compatibility Inventory

| Component / Artifact | Legacy Path / Reference | Compatibility Purpose | Deprecation / Retirement Plan |
|---|---|---|---|
| `VerifyRazorpayReq` | `services/marketplace-api/routers/cart.py:242` | Existing cart checkout payment verification | Retire in MR-01D / MR-01I |
| `LegacyRazorpayVerifyRequest` | `services/marketplace-api/models/payments.py:126` | Transition schema for legacy Razorpay web/mobile clients | Retire in MR-01I |
| `OrderDoc.razorpay_order_id` | `services/marketplace-api/models/documents.py:87` | Deprecated document field for legacy order lookup | Deprecated; migrate to `InternalProviderMetadata` |
| `OrderDoc.razorpay_payment_id` | `services/marketplace-api/models/documents.py:88` | Deprecated document field for legacy payment lookup | Deprecated; migrate to `InternalProviderMetadata` |
| `Product.price: number` | `apps/storefronts/zolexora-shop/web/src/lib/api.ts:35` | Legacy web client float price field | Replace with `price: Money` in MR-01I |
| `Mahila Express Backend` | `apps/storefronts/mahila-madel/legacy-server/` | Transitional Express backend server | Retire upon full FastAPI storefront migration |

---

## 16. OpenAPI and TypeScript Synchronization Findings

1. **Deterministic OpenAPI Generation**:
   - `python3 scripts/generate_openapi.py` executed twice produced identical output.
   - `git diff --exit-code contracts/marketplace/openapi.json` returned exit code 0 (zero drift).
2. **TypeScript Type Compilation**:
   - `pnpm generate:client` successfully compiled `openapi.json` into `packages/shared-api/src/generated/types.ts` using `openapi-typescript 7.13.0`.
3. **Automated Drift Check**:
   - Running `./scripts/check-openapi-drift.sh` passed cleanly with exit code 0.
4. **Monorepo Workspace Type-Checking**:
   - Running `pnpm type-check` verified all 10 packages in the workspace with 0 TypeScript compilation errors:
     - `@zolexora/shared-api`
     - `@zolexora/shared-config`
     - `@zolexora/storefront-zolexora-shop` (Web)
     - `@zolexora/storefront-zolexora-shop-mobile` (Mobile)
     - `@zolexora/storefront-mahila-madel` (Web)
     - `@zolexora/storefront-mahila-madel-mobile` (Mobile)
     - `@zolexora/mahila-legacy-server`
     - `@zolexora/seller-portal` (Web)
     - `@zolexora/seller-portal-mobile` (Mobile)
     - `@zolexora/marketplace-admin`

---

## 17. Test-Coverage Matrix

| Audit Area | Security / Contract Requirement | Target Test File | Existing Test Status | Missing Test Coverage |
|---|---|---|---|---|
| **MR-01A** | Money float rejection | `test_primitives.py` | `test_money_rejects_floats_if_strict` contains `pass` | Need assertions for `float`, `bool`, `MAX_SAFE_INTEGER`, `ge=0` |
| **MR-01A** | UTCDateTime timezone enforcement | `test_primitives.py` | Partial (field schema metadata tested) | Rejection of naive `datetime` without `tzinfo` |
| **MR-01B** | Context Host / Origin resolution | `test_storefront_context.py` | **100% PASSED** (14 cases) | Host/Header mismatch, invalid origin, unknown host covered |
| **MR-01B** | Cart storefront isolation | `test_postgres_user_source.py` | **100% PASSED** | Cross-storefront cart line lookups and updates covered |
| **MR-01B** | Product modification isolation | `test_product_validation.py` | **FAILED / MISSING** | Need cross-storefront `PUT /products/{id}`, `DELETE`, `upload-image` tests |
| **MR-01B** | Order list/get storefront isolation | `test_postgres_user_source.py` | **FAILED / MISSING** | Need cross-storefront `GET /orders/my`, `GET /orders/seller` tests |
| **MR-01C** | 3-Layer catalog model validation | `test_product_validation.py` | **100% PASSED** | `MasterProductDoc`, `StorefrontListingDoc`, `InventoryBalanceDoc` creation |
| **MR-01C** | Inactive listing cart rejection | `test_postgres_user_source.py` | **100% PASSED** | Attempting to add inactive storefront listing raises 400/404 |
| **MR-01F** | PaymentIntent provider neutrality | `test_payments.py` | **100% PASSED** (10 cases) | Schema exclusion of provider secrets verified |
| **MR-01F** | Payment status state transitions | `test_payments.py` | **100% PASSED** | Invalid state transitions (e.g. `captured -> created`) rejected |
| **MR-01F** | Cashfree webhook signature check | N/A | **UNIMPLEMENTED** | Cashfree raw body HMAC signature & replay protection tests |

---

## 18. All CRITICAL / HIGH / MEDIUM / LOW Findings

### Finding Table Summary

| Finding ID | Batch | Domain | Severity | Confidence | Affected File(s) | Summary Rationale | MR-01D Blocker |
|---|---|---|---|---|---|---|---|
| **FIND-MR01B-001** | MR-01B | Storefront Isolation | **HIGH** | High | `routers/products.py` | `PUT`, `DELETE`, `upload-image` product endpoints omit `storefront_id` query filters | **YES** |
| **FIND-MR01B-002** | MR-01B | Storefront Isolation | **HIGH** | High | `routers/other.py` | `GET /orders/my`, `seller`, `{id}`, `PUT status` omit `storefront_id` query filters | **YES** |
| **FIND-MR01A-001** | MR-01A | Primitives | **MEDIUM** | High | `models/primitives.py` | `Money` allows `bool` coercion, lacks upper bound `le=9007199254740991` & `ge=0` | **YES** |
| **FIND-MR01A-002** | MR-01A | Primitives | **MEDIUM** | High | `models/primitives.py` | `UTCDateTime` accepts naive datetimes without timezone validation | **YES** |
| **FIND-MR01F-001** | MR-01F | Quality & Linting | **MEDIUM** | High | `tests/test_payments.py` | 4 Ruff lint violations (`E402`, `F401`) cause `pnpm verify` workspace check to fail | **YES** |
| **FIND-MR01F-002** | MR-01F | Configuration | **MEDIUM** | High | `core/config.py` | Cashfree backend configuration parameters missing from `Settings` model | **NO** |
| **FIND-MR01C-001** | MR-01C | Persistence | **LOW** | Medium | `models/documents.py` | Migration script missing for backfilling legacy single-doc MongoDB `products` | **NO** |

---

### Detailed Findings Narrative

#### FIND-MR01B-001: Missing Storefront Isolation Filters on Product Modification & Deletion
- **ID**: `FIND-MR01B-001`
- **Batch**: MR-01B
- **Domain**: Storefront Isolation / Catalog Router
- **Severity**: **HIGH**
- **Confidence**: High (100% verified via code inspection)
- **Affected Files**: `services/marketplace-api/routers/products.py`
- **Repository Evidence**:
  - Line 314: `fq = {"id": product_id} if user["role"] == "admin" else {"id": product_id, "seller_id": user["id"]}`
  - Line 325: `await db.storefront_listings.update_one({"id": product_id}, ...)`
  - Lines 342-351 (`delete_product`): `fq` omits `storefront_id`.
  - Lines 354-371 (`upload_product_image`): `fq` omits `storefront_id`.
- **Current Behavior**: Product updates, deletions, and image uploads search and mutate `storefront_listings` solely by `id` and `seller_id`, omitting `storefront_id: context.key`.
- **Security Impact**: Cross-storefront listing modification and deletion by a seller or admin.
- **Required Correction**: Inject `context: StorefrontContext = Depends(require_storefront_context)` into `delete_product` and `upload_product_image`. Add `"storefront_id": context.key` to all database search filters `fq` and `update_one` / `delete_one` operations.
- **Proposed Test**: `tests/test_product_validation.py::test_update_delete_product_cross_storefront_blocked`
- **MR-01D Blocker**: **YES**

#### FIND-MR01B-002: Missing Storefront Isolation Filters on Orders Router Endpoints
- **ID**: `FIND-MR01B-002`
- **Batch**: MR-01B
- **Domain**: Storefront Isolation / Orders Router
- **Severity**: **HIGH**
- **Confidence**: High (100% verified via code inspection)
- **Affected Files**: `services/marketplace-api/routers/other.py`
- **Repository Evidence**:
  - Line 16 (`get_my_orders`): `await db.orders.find({"buyer_id": user["id"]}, {"_id": 0})`
  - Line 21 (`get_seller_orders`): `q = {} if user["role"] == "admin" else {"seller_id": user["id"]}`
  - Line 27 (`get_order_by_id`): `await db.orders.find_one({"id": order_id}, {"_id": 0})`
  - Line 35 (`update_order_status`): `fq = {"id": order_id} if user["role"] == "admin" else {"id": order_id, "seller_id": user["id"]}`
- **Current Behavior**: Buyer order list, seller order list, single order retrieval, and order status updates query `orders` collection without filtering by `storefront_id`.
- **Security Impact**: Buyers and sellers can view and manage orders originating from other storefronts, breaching multi-tenant data isolation.
- **Required Correction**: Inject `context: StorefrontContext = Depends(require_storefront_context)` across all `orders_router` endpoints and add `"storefront_id": context.key` to all database queries.
- **Proposed Test**: `tests/test_postgres_user_source.py::test_orders_storefront_isolation`
- **MR-01D Blocker**: **YES**

#### FIND-MR01A-001: Money Primitive Allows Boolean Coercion and Unbounded Large Integers
- **ID**: `FIND-MR01A-001`
- **Batch**: MR-01A
- **Domain**: Canonical Primitives
- **Severity**: **MEDIUM**
- **Confidence**: High (Verified via Python interpreter execution)
- **Affected Files**: `services/marketplace-api/models/primitives.py`
- **Repository Evidence**:
  - `Money(amount_minor=True, currency="INR")` returns `Money(amount_minor=1, currency="INR")`.
  - `Money(amount_minor=9007199254740992, currency="INR")` succeeds without error.
- **Current Behavior**: Python `bool` subclasses `int` and passes Pydantic `int` validation. `amount_minor` has no `StrictInt` constraint, upper limit (`le=9007199254740991`), or non-negative check (`ge=0`).
- **Impact**: Potential precision loss in frontend JavaScript clients handling amounts > `MAX_SAFE_INTEGER` and invalid boolean amounts in order repricing.
- **Required Correction**: Add `@field_validator("amount_minor")` or `StrictInt` with `ge=0, le=9007199254740991` constraints to `Money`.
- **Proposed Test**: `tests/test_primitives.py::test_money_strict_validation`
- **MR-01D Blocker**: **YES**

#### FIND-MR01A-002: UTCDateTime Accepts Naive Datetimes Without Timezone Validation
- **ID**: `FIND-MR01A-002`
- **Batch**: MR-01A
- **Domain**: Canonical Primitives
- **Severity**: **MEDIUM**
- **Confidence**: High (Verified via Python interpreter execution)
- **Affected Files**: `services/marketplace-api/models/primitives.py`
- **Repository Evidence**: `UTCDateTime` is a field metadata annotation alias (`Annotated[datetime, Field(...)]`) without custom timezone validation logic.
- **Current Behavior**: Instantiating models with `datetime(2026, 7, 31, 12, 0, 0)` succeeds with `tzinfo=None`.
- **Impact**: Potential timezone ambiguity across database timestamps and event logs.
- **Required Correction**: Add custom Pydantic validator ensuring `v.tzinfo is not None` and converting naive timestamps or raising a `ValidationError`.
- **Proposed Test**: `tests/test_primitives.py::test_utcdatetime_rejects_naive`
- **MR-01D Blocker**: **YES**

#### FIND-MR01F-001: Payment Unit Test File Violates Ruff Lint Rules Causing `pnpm verify` Failure
- **ID**: `FIND-MR01F-001`
- **Batch**: MR-01F
- **Domain**: Quality Assurance & Workspace Build
- **Severity**: **MEDIUM**
- **Confidence**: High (Verified via `pnpm verify` execution)
- **Affected Files**: `services/marketplace-api/tests/test_payments.py`
- **Repository Evidence**: Lines 143-145 place imports (`from httpx import ASGITransport`, `import asyncio`, `from main import app`) after test function definitions. `asyncio` is imported but unused.
- **Current Behavior**: `pnpm verify` fails at `ruff check` with exit code 1.
- **Impact**: CI/CD workspace verification pipeline fails.
- **Required Correction**: Re-order imports to the top of `test_payments.py` and remove unused `asyncio` import.
- **Proposed Test**: `pnpm verify`
- **MR-01D Blocker**: **YES**

---

## 19. Verification Commands and Exact Results

All verification commands specified in `AGENTS.md` and `ORIGINAL_REQUEST.md` were executed from `/data/projects/development/Zolexora/ZolexoraMarketplace`.

### Command Results Summary Table

| # | Command | Scope / Target | Exit Code | Result Summary | Status |
|---|---|---|---|---|---|
| 1 | `PYTHONPATH=services/marketplace-api:.venv/lib/python3.14/site-packages .venv/bin/python3 -m pytest services/marketplace-api/tests` | Full Pytest Suite | `0` | **167 passed, 394 warnings in 5.18s** | **PASSED** |
| 2 | `./scripts/check-openapi-drift.sh` | OpenAPI Exporter & Client | `0` | **OpenAPI drift check passed** (0 diff) | **PASSED** |
| 3 | `.venv/bin/python3 scripts/generate_openapi.py && git diff --exit-code contracts/marketplace/openapi.json` | Deterministic Generation | `0` | **0 diff** (Deterministic schema output) | **PASSED** |
| 4 | `pnpm verify` | Workspace Build & Lint | `1` | Workspace packages verified (10/10), Turbo build passed, **Failed at Ruff lint check on `test_payments.py`** | **FAILED** |
| 5 | `pnpm generate:openapi && pnpm generate:client` | OpenAPI & TypeScript | `0` | OpenAPI schema & TypeScript `types.ts` generated successfully | **PASSED** |
| 6 | `pnpm type-check` | Monorepo TypeScript | `0` | **7/7 Turbo tasks succeeded** (10 packages verified) | **PASSED** |
| 7 | `git diff --check` | Git Whitespace Check | `0` | **0 whitespace / conflict errors** | **PASSED** |
| 8 | `git status --short` | Working Tree Check | `0` | `?? .agents/` (Clean working tree) | **PASSED** |
| 9 | `grep -En "cashfree|Cashfree|razorpay|Razorpay|provider_secret|raw_payload|api_key|client_secret|webhook_secret|payment_provider" -r services packages apps contracts docs` | Secret Leakage Scan | `0` | 336+ matches classified (Config names, legacy docs, test mocks). **0 exposed production secret values**. | **PASSED** |

### Static Typing & CI Declarations

- **Backend Python Static Typing**: **NOT CONFIGURED**
- **Feature-Branch CI Status**: **NOT VERIFIED** (No remote CI status reporting API available in repository environment).

---

## 20. Required Corrective Batches

Before starting MR-01D, the following corrective batch (**MR-01-FIX**) must be created and executed:

```
                          ┌────────────────────────────────┐
                          │    MR-01-FIX Corrective Batch   │
                          └───────────────┬────────────────┘
                                          │
       ┌──────────────────────────────────┼──────────────────────────────────┐
       ▼                                  ▼                                  ▼
┌───────────────┐                  ┌───────────────┐                  ┌───────────────┐
│  MR-01A-FIX   │                  │  MR-01B-FIX   │                  │  MR-01F-FIX   │
│ Primitives    │                  │ Isolation     │                  │ Linting       │
│ StrictInt     │                  │ products.py   │                  │ test_payments │
│ MAX_SAFE_INT  │                  │ other.py      │                  │ config.py     │
│ UTC timezone  │                  │ filters       │                  │ Ruff clean    │
└───────────────┘                  └───────────────┘                  └───────────────┘
```

1. **MR-01A-FIX**:
   - Update `models/primitives.py::Money` with `StrictInt` validator, `ge=0`, and `le=9007199254740991`.
   - Update `models/primitives.py::UTCDateTime` with timezone validation checking `v.tzinfo is not None`.
   - Update `tests/test_primitives.py::test_money_rejects_floats_if_strict` with explicit assertions.
2. **MR-01B-FIX**:
   - Update `routers/products.py`: Add `StorefrontContext` dependency and `"storefront_id": context.key` query filters to `PUT /products/{id}`, `DELETE /products/{id}`, and `POST /products/{id}/upload-image`.
   - Update `routers/other.py`: Add `StorefrontContext` dependency and `"storefront_id": context.key` query filters across `GET /orders/my`, `GET /orders/seller`, `GET /orders/{id}`, and `PUT /orders/{id}/status`.
3. **MR-01F-FIX**:
   - Fix Ruff lint errors in `tests/test_payments.py` (move imports to top, remove unused `asyncio`).
   - Add Cashfree backend settings (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`) to `core/config.py`.

---

## 21. MR-01D Readiness Decision

**Decision**: **BLOCKED — Do Not Begin MR-01D**

### Readiness Rationale

MR-01D (Cart and Checkout Contracts) depends directly on reliable, tamper-proof storefront isolation and strictly validated monetary primitives. Proceeding with MR-01D while product modification and order queries lack `storefront_id` filters would result in building checkout contracts on top of vulnerable data boundaries.

Once **MR-01-FIX** is committed and `pnpm verify` passes with 0 lint errors and 100% pytest pass rate, MR-01D may be authorized.

---

## 22. Remaining MR-01 Batches

- **MR-01D**: Cart and Checkout Contracts (Storefront-isolated carts, repricing, session management).
- **MR-01E**: Orders, Fulfillment, Cancellation, and Returns Contracts.
- **MR-01G**: Seller and Admin Portal Contracts (Storefront-aware product and inventory management).
- **MR-01H**: ERP Integration and Event-Driven Synchronization Contracts.
- **MR-01I**: Final OpenAPI and Frontend Contract Synchronization (Clean up duplicate frontend types and deprecate legacy Razorpay interfaces).

---

## 23. Decisions Requiring User Approval

1. **Authorization of Corrective Batch MR-01-FIX**: Approval to execute MR-01A-FIX, MR-01B-FIX, and MR-01F-FIX to resolve blocking defects before starting MR-01D.
2. **MongoDB Production Data Migration Strategy**: Approval for creating an offline database migration script (`scripts/migrate_legacy_products.py`) to convert existing legacy `products` single-doc collections to `master_products`, `storefront_listings`, and `inventory_balances`.
3. **Cashfree Environment Variable Naming**: Approval of standard environment variable names `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` for backend secret resolution in OCI Secret Management.

---
