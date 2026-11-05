# Full code scan — 2026-10-31

**Scope.** Every non-test source file in `services/marketplace-api` (27.7k lines), the Zolexora and Mahila storefronts (web and mobile, 15.8k), the seller and admin portals (7.4k), `packages/`, the product scripts, compose and nginx.

**Method.** Six parallel agents each read their area line by line. I re-checked the Critical findings marked ✔ against the code myself. The scan was read-only: no code was changed and no tests were run, because the Python dependencies are not installed in this environment.

Paths are relative to `services/marketplace-api/` unless they say otherwise.

## Headline

The status docs say MR-00 to MR-19 are complete. The code does not support that:

- **Two catalogs.** Live cart, checkout, orders and shipping still run on MongoDB (`routers/cart.py`, `routers/orders.py`, `shipping/`). The PostgreSQL modules (`inventory/`, `pricing/`, `tax/`, `promotions/`, `checkout_quote/`, `payment_orchestration/`, `cart/`, `wishlist/`, `address/`) are imported only by tests. Listings approved in the Postgres portal catalog can never be bought.
- **Account takeover and free orders.** Several Critical holes allow both today.
- **Broken core flows.** Order history (buyer and seller), seller product editing, bulk upload, every mobile write, admin sign-in and COD checkout are all broken against the current API.

## Critical

| # | Area | Finding | Evidence |
|---|---|---|---|
| C1 ✔ | Auth | `/auth/firebase` links an **unverified** Firebase email/password identity to an existing verified user and issues a session. This is account takeover, and a test locks the behaviour in (`test_firebase_password_exchange_accepts_marketplace_verified_email`). | `auth/services.py:306-313` |
| C2 ✔ | Auth | `/auth/complete-unified-registration` links the caller's Firebase identity to **any existing account** with the requested email. The phone provider never checks the email, and the password provider doesn't check `email_verified`. | `auth/router.py:342-361`, `auth/services.py:421-426` |
| C3 ✔ | Auth | The client can skip verification. `google_verified` from the request body skips the email OTP. `platform="android"` plus any `pnv_token` of 8+ characters skips phone verification. The web and mobile clients fabricate `PNV_ANDROID_SECURE_${Date.now()}`. | `auth/services.py:433,450-453`; `zolexora-shop/web/src/app/auth/page.tsx:641-647`; `mahila-madel/web/src/pages/Login.js:437-453` |
| C4 ✔ | Payments | `POST /cart/checkout/upi-paid` sets `payment_status:"paid"` for any UTR string the buyer submits. | `routers/cart.py:660-673` |
| C5 ✔ | Payments | `coins_to_use` is never checked against the coin balance and never deducted. Sending `coins_to_use=1e9` with `payment_method:"coins"` creates a free order marked paid. | `routers/cart.py:445,463,585-589` |
| C6 ✔ | Shipping | `discover-options`, `options`, `manual-book`, `request-pickup`, `cancel`, `retry-booking` and `sync` require only a login, with no order or shipment ownership check. Any user can cancel or book shipments and read buyers' addresses and phones. `ready-to-ship` doesn't check that the shipment belongs to the seller. | `shipping/router.py:81-199`, `shipping/service.py:266-271` |

## High

| # | Area | Finding | Evidence |
|---|---|---|---|
| H1 ✔ | Auth | Phone login and identity linking look users up by **any delivery-address phone**, so a gift recipient lands in the buyer's account. | `users/repositories.py:98-111`, `auth/services.py:291-301` |
| H2 ✔ | Auth | OTP race: when the verify script returns 0 (challenge deleted) and a 15-minute "verified" marker exists, verification succeeds. Parallel wrong guesses can log in as a victim. | `shared/sms/otp.py:115-126`, `shared/verification/email_otp.py:119-130` |
| H3 ✔ | Auth | The SMS OTP rate-limit key is `(purpose, "anon")`. `purpose` is free text, so SMS pumping is unlimited; with a fixed purpose, six requests lock out every registrant. | `shared/sms/otp.py:57,153`, `auth/router.py:270`, `auth/schemas.py:199` |
| H4 ✔ | Auth | OTPs are logged and reported as sent when SMS credentials are missing, and `APP_ENV` defaults to `development`. | `shared/sms/providers/smscountry.py:202-215`, `core/config.py:61`, `auth/services.py:59-60` |
| H5 ✔ | RBAC | `admin_only` ignores fine-grained admin permissions, so any admin can suspend users or approve grants. The legacy `/admin/users/{id}/role` and `/toggle` routes (used by the admin UI) have no permission check and no audit log. | `core/deps.py:128-131`, `routers/other.py:158,169` |
| H6 ✔ | Isolation | `require_storefront_grant` is never used. Any seller can publish on Mahila by sending `X-Storefront-Key`. Legacy product routes let sellers set listings `active` and skip moderation. | `seller_orgs/dependencies.py:89-105`, `routers/portal_catalog.py:35-39,180-230`, `routers/products.py:457,497,520` |
| H7 ✔ | ERP | The webhook secret is the literal `"erp_secret_key"`, compared with `==`, with in-memory replay protection. | `routers/erp_webhooks.py:8`, `integrations/zolexora_erp/adapter.py:32-41` |
| H8 ✔ | Payments | Razorpay verification passes when `RAZORPAY_KEY_SECRET` is empty (the default), and the update isn't scoped to the buyer, storefront or pending status. | `routers/cart.py:613-626`, `core/config.py:131` |
| H9 ✔ | Money | Checkout quotes are never consumed, so one quote creates unlimited orders. The quote and the legacy checkout disagree: the quote has 0 tax and shipping, the legacy checkout adds an 18% float tax and ₹49. The web UI shows a total that doesn't include the tax it charges. | `routers/orders.py:77`, `routers/cart.py:401-404,461-462`; `zolexora-shop/web/src/app/cart/page.tsx:253-258` |
| H10 ✔ | Inventory | Stock is never reserved or decremented on order, so products oversell. | `routers/cart.py:447-596`, `routers/orders.py:109-259` |
| H11 ✔ | Shipping | There is no guard against double booking, so a double-click or retry buys two AWBs. | `shipping/service.py:157-346` |
| H12 ✔ | Routing | `orders_router` is mounted before `admin_orders_router`, so `GET /orders/admin` matches `/{order_id}` and returns 404. | `main.py:143-144` |
| H13 ✔ | Seller KYC | Bank account, Aadhaar and PAN are stored as plain-text org metadata and returned to every org member. Verification is enforced only by a client-side redirect. Documents are never uploaded. | `seller/web/src/app/verification/page.tsx:280-282`, `seller_orgs/schemas.py:31` |
| H14 ✔ | Frontends | Order history is broken everywhere. `/orders/my` and `/orders/seller` return `order_id` and summaries, but the UIs read `id`, `items`, `total_paid` and `payment_status`. Mobile screens crash on `order.id.slice`, and the detail pages never find the order. | `models/orders.py:341`; storefront and seller `orders` pages |
| H15 ✔ | Frontends | Seller product Edit, Hide, Delete and image upload all 404, because `/products/my` returns master IDs while the write routes expect listing IDs. | `routers/products.py:369` vs `:423,482,550,566` |
| H16 ✔ | Frontends | Bulk upload and mobile product create/edit send `price` as a number, but the API requires a Money object, so they return 422. | `seller/web/.../products/bulk/page.tsx:370`, `seller/mobile/app/product-form/index.tsx:215` |
| H17 ✔ | Frontends | Every mobile write returns 403. Mobile uses the cookie session, but its CSRF header comes from `document.cookie`, which doesn't exist in React Native, and the token is never kept in SecureStore. The buyer apps store `"dummy-native-token"` as a fallback. | `packages/shared-api/src/client.ts:36`, `core/deps.py:73-77`, `zolexora-shop/mobile/app/auth/index.tsx:58` |
| H18 ✔ | Frontends | Admins can't sign in to the admin portal: it uses `/auth/login` (users table), but admins exist only in `public.admins` via `/auth/firebase`. | `marketplace-admin/web/src/app/auth/page.tsx:21` |
| H19 ✔ | Frontends | Mahila checkout fails for COD (it sends `cod` and `upi_qr`, which the server rejects). The UPI QR shows a hardcoded `mahilamadel@upi` payee before any order exists. The Zolexora QR is a random pattern that can't be scanned, and `upi_link` is undefined. | `mahila-madel/web/src/pages/Checkout.js:96,405-419,829-837`; `zolexora-shop/web/src/app/cart/page.tsx:49-66,283` |
| H20 ◐ | Frontends | The buyer mobile cart crashes because the response is treated as an array and price as a number. Mahila mobile can't build because `assets/` is missing and the EAS `projectId` is a placeholder. | `*/mobile/app/(tabs)/cart.tsx:37-47`, `mahila-madel/mobile/app.json` |

**Status 2026-11-05** (branch `fix/marketplace-auth-service`):
- H1–H4, H17, H18 went away with local sign-in. Every app signs in through the Zolexora auth service and sends a Bearer token, and admins are auth-service Track 3 accounts.
- H5: admin routes check the token's permissions (`require_permission`).
- H6: publishing checks for an approved storefront grant.
- H8: Razorpay verification returns 503 without the secret and only marks the buyer's own pending order paid.
- H9–H11: orders, stock and shipments are on PostgreSQL. A quote is used once, stock is reserved, and booking is claimed once.
- H13:
  - PAN and the account number are encrypted in `seller_kyc`; members see only the last four digits.
  - Organisations stay `PENDING_VERIFICATION` until an admin verifies them, enforced on the server.
  - Still open: KYC documents are not uploaded (only file names are sent).
- H20 ◐: the cart is fixed. The three marketplace mobile apps still need `assets/` (icon, splash) and a real EAS `projectId`.

## Medium (summary)

- **Auth and RBAC**
  - An org ADMIN can make itself OWNER and remove the real owner (`seller_orgs/repository.py:153-306`).
  - Admins with `rbac:write` can grant themselves any permission (`admin_management/router.py:149-161`).
  - The seed re-elevates `DEFAULT_ADMIN_EMAIL` to super_admin on every boot (`core/seed.py:43-47`).
  - The 60s user cache and 15s session cache keep suspended users and revoked sessions working.
  - The check-email and check-phone endpoints allow user enumeration and have no rate limit.
  - Org creation never upgrades a buyer to the seller role (`ON CONFLICT DO NOTHING`, `seller_orgs/repository.py:54-62`).
  - The org suspension and verification state machine is string-based and reactivates suspended orgs (`seller_orgs/router.py:436`).
- **Admin API**
  - `admin_management` endpoints return 500 because UUID and jsonb values aren't converted for Pydantic (`admin_management/router.py:117-185`).
  - CORS doesn't allow `PATCH` (`main.py:98`).
  - `/admin/users?limit=1000` returns 422 (cap is 100), so the admin Users page is empty.
- **Readiness and infra**
  - `/api/ready` always returns 503: `SCHEMA_HEAD` is `0010` while the real head is `0016` (`database/engine.py:3`). ✔
  - `compose.yaml` has no Redis service, hardcoded passwords and pepper, Mongo with no volume or auth, and an nginx→Mahila port mismatch (3000 vs 80).
  - uvicorn runs with `--forwarded-allow-ips=*`, and nginx doesn't overwrite `X-Forwarded-For`.
- **ERP outbox**: writes always fail silently (storefront key goes into a UUID column, `_id` isn't JSON-serialisable, random idempotency key). There is no worker.
- **Shipping**
  - Status mapping is by substring, so "Undelivered" becomes DELIVERED.
  - Courier webhooks share one secret and have no replay window.
  - The pickup-location update writes the raw request body.
  - The Shiprocket token is cached forever.
  - The pincode serviceability and address validation stubs always return yes.
- **Money**
  - The per-seller split truncates, so the split totals don't add up to the order total.
  - Return quantities are unbounded.
  - A partial cancellation cancels the whole order.
  - Paid cancellations get no refund.
  - The stale cart cache after checkout allows duplicate orders.
  - Legacy-checkout orders return 500 on the detail views.
  - Subscription checkout is missing an `await`, so it always returns 500 (`routers/other.py:117`).
  - The coin and discount-code deduction races.
  - Reels can be farmed for coins.
- **Search and media**
  - Catalog search accepts unescaped `$regex` (ReDoS), `limit` is unbounded, and the catalog cache is unbounded.
  - Media upload keys allow path traversal, `DummyS3Adapter` is hardwired, and completing an upload never HEAD-checks the object.
  - Draft listings are served publicly.
- **Migrations**
  - 0013 marks address phones as verified and can abort on a duplicate phone.
  - 0014 deletes admins despite RESTRICT foreign keys.
  - 0016 de-duplicates arbitrarily.
  - The models and migrations have drifted (`erp_outbox`, `erp_inbox`, `seller_storefront_grant`).
  - `verify:database` asserts the dropped `password_hash` column, so it can never pass.
- **Frontends**
  - The shop filters ignore URL changes, and category links aren't URL-encoded.
  - Mobile "load more" repeats page 1.
  - The mobile address form loses focus on every keystroke.
  - Prices show as "₹[object Object]".
  - Navbar hydration mismatch.
  - Profile sign-out doesn't clear state, and the seller settings sign-out never calls logout.
  - The CSRF cookie can't be read across sites under the README's hosting setup.
  - Seller dashboard revenue includes unpaid orders.
  - Mahila search and profile parameters don't match the API.
  - Mobile sign-up has no OTP entry screen.

## Dead code and cleanup

- **Password auth is dead.** The password hash is never stored, so `/auth/login`, `/register`, `/forgot-password` and `/reset-password` can't work. Note that `_DUMMY_HASH` would accept the literal dummy password if the 500 were "fixed" (`auth/services.py:20,101-110`).
- **Routers mounted twice.** Every router is mounted at both `/api` and `/`.
- **Unused or broken backend routes.** `routers/other.py` `orders_router` is never mounted. `routers/payments.py` handlers return `None`, so they 500. `issue_refund` can't be reached.
- **Unused backend modules.** The Postgres domain modules listed in the Headline are used only by tests. Their own defects:
  - The quote "signature" is an unkeyed SHA-256.
  - The payment orchestration FAILURE event overwrites CAPTURE.
  - The inventory write isn't transactional.
- **Unused files.** `shared/database/mongodb.py`, `models/documents.py`, `models/errors.py`, `shipping/adapters.py`, `scripts/setup_indexes.py`, `scripts/migrate_supabase_identities.py`, the Oracle `migrations/versions/*`, and the duplicate `nginx.conf`.
- **Dead config.** `JWT_*`, `SUPABASE_*`, `CLOUDFLARE_*`, `DEFAULT_ADMIN_PASSWORD`.
- **Frontends**
  - The Mahila admin pages can't be reached.
  - The admin stub pages (audit, catalog, inventory, payments, sellers, storefronts) contain `{{ }}` template leftovers.
  - The shared-api `services.ts` calls endpoints that don't exist (`PUT /orders/{id}/status`, `/admin/products*`).
  - The hand-written types disagree with `generated/types.ts`, which nothing imports.
- **Docs.** The Mahila README still lists `legacy-server/`.

## AGENTS.md Docker compliance

`compose.yaml` has no GHCR `image:` tags and no `pull_policy: missing`. The backend and nginx don't build from the monorepo root. There is no `scripts/docker-start.sh` and no `docker:zolexora-marketplace:*` root scripts.

## Gap-analysis re-verification

| Gap | Documented | Actual |
|---|---|---|
| BE-001 duplicate /auth | accepted | **Fixed**. Every router is still mounted twice. |
| BE-002 startup side effects | accepted | **Open** (`main.py:72-74`). |
| DATA-001 Mongo vs PG | accepted | **Partial**. Mongo still owns orders and shipping. |
| DATA-002 ledger / snapshots | accepted | **Open**. The ledger isn't wired in, and snapshots are rewritten. |
| AUTH-001 localStorage bearer | accepted | **Fixed (web)**. Mobile sessions are broken (H17). |
| AUTH-002 member / store permissions | accepted | **Open**. |
| SF-001 storefront isolation | accepted | **Partial**. On the shared API host with no Origin, `X-Storefront-Key` alone decides the storefront. |
| SF-002 seller publishes globally | accepted | **Open** (H6). |
| PAY-001 payment routing | accepted | **Partial**. The provider is chosen on the server, but credentials are global and the client picks the flow. |
| PAY-002 webhooks / refunds / idempotency | accepted | **Open**. |
| FE-001 shared client | accepted | **Partial**. Only the seller portal uses `shared-api`. |
| FE-002 / SEC-002 Mahila client totals | accepted | **Partial**. The legacy server is deleted and the server recomputes totals, but the UI shows different totals and coins are trusted. |
| SEC-001 OTP logged | accepted | **Partial**. Redis is clean, but SMS dev mode and `deliver_secret` still log OTPs. |
| SEC-004 forwarded headers | accepted | **Partial**. The resolver uses `TRUSTED_PROXIES`, but uvicorn and nginx trust all forwarded headers. |
| OCI-002 Cloudinary / Supabase | accepted | **Open**. |
| ERP-004 outbox workers | resolved | **Regressed / open**. Inserts always fail and there is no worker. |
| TEST-002 seller / admin tests | accepted | **Open**. There are no frontend tests for the portals. |
| DESIGN-001 Mahila icons | accepted | **Open, worse**. `assets/` is missing, so builds fail. |

## Suggested fix order

1. **Close the takeover and free-order holes (C1–C6, H1–H3).** These are small, local backend changes, each with a regression test.
2. **Secrets and defaults.** Load the ERP secret and require the Razorpay secret from config, default `APP_ENV` to production, and stop logging OTPs.
3. **Decide the commerce source of truth.** Either wire the Postgres modules into cart, checkout and orders, or delete them and harden the Mongo paths. Most H9–H11 money and inventory bugs follow from that decision.
4. **Fix the API↔UI contract breaks (H14–H20).** Generate types from `openapi.json` and have every app use `shared-api`.
5. **Update the status docs** so they reflect this scan.
