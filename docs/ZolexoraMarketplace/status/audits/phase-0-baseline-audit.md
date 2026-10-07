# Phase 0 baseline audit

Date: 2026-07-14. Verdict: **PASS WITH BLOCKERS**. Root `/home/chickenman/Documents/my_projects/ZolexoraMarcateplace`; branch `main`; commit `87d751c455c6bd3dfd75d154389fb64745839e12`; initial tree clean. No repository instructions (`AGENTS.md`, `.agents`, `.codex`) or equivalent knowledge/status corpus existed.

## Repository and applications

`rg --files` found 296 relevant files excluding dependencies/generated output. Principal tree: `backend/`; `apps/ZolexoraShop/web-app/{buyer,seller,adminpanal}`; `apps/ZolexoraShop/mobile-app/{buyer,seller}`; `apps/MahilaMadel/web-app/{client,server}`; `packages/{shared-api,shared-config}`; `supabase/`; root pnpm/Turbo/Docker/CI/docs.

| App/service | Actual stack and commands | Evidence/status |
|---|---|---|
| FastAPI | Python >=3.12, FastAPI 0.115/Uvicorn; 8000; pytest/Ruff | `backend/pyproject.toml:1-9`, `requirements.txt:31,153`; 59 tests pass |
| Buyer web | Next 15/React 19; dev 3000/build/type/Vitest config | `apps/ZolexoraShop/web-app/buyer/package.json:1-45`; workspace-blocked |
| Seller web | Next 15/React 19; dev 3001/build/type | `.../seller/package.json:1-39`; workspace-blocked/no test |
| Admin web | Next 15/React 19; dev 3002/build/type | `.../adminpanal/package.json:1-35`; misspelled path/workspace-blocked |
| Buyer mobile | Expo 54/RN 0.81; dev 8081/build/test/type | `.../mobile-app/buyer/package.json:1-49`; blocked |
| Seller mobile | Expo 54/RN 0.81; dev 8082/build/type | `.../mobile-app/seller/package.json:1-47`; blocked/no test |
| Mahila client | CRA/React 18; dev 3000/build/Jest runner | `apps/MahilaMadel/web-app/client/package.json:1-42`; build passes/zero tests |
| Mahila API/admin | Express 4/Mongoose 7; 5000; no test | `.../server/package.json:1-23`, `server.js:44-63`; duplicate/retire target |

Current domain references use `zolexora.com` and `admin.zolexora.com` rather than final customer/admin names (`backend/core/config.py:84-87`, `README.md:15-20`).

## Workspace and shared packages

`pnpm-workspace.yaml:1-3` includes only `apps/*` and `packages/*`; nested app manifests are invisible. Lock importers still name nonexistent flat paths (`pnpm-lock.yaml:31,125,216,280,374`). `Dockerfile.frontend:13-17`, Compose (`docker-compose.yml:45-100`), CI (`.github/workflows/ci.yml:69-70`), and README (`README.md:157-163,329-331`) use old paths. Root type/lint/build exit 0 with zero Turbo tasks.

`@zolexora/shared-api` exports client/auth/services/types but no app imports it (`packages/shared-api/package.json:5-14`, `src/index.ts:1-4`). Every app duplicates API clients. `@zolexora/shared-config` is also unused and has no scripts; its Tailwind config references undeclared `tailwindcss-animate` (`packages/shared-config/tailwind.config.js:60`).

## Backend routes and lifecycle

Startup validates config; initializes Redis, asyncpg/Supabase and Mongo; creates indexes/seeds; shutdown closes stores (`backend/main.py:38-59`). Local uploads are created/mounted (`main.py:34-35,88-89`). Health always returns `status: ok` plus flags (`main.py:114-129`).

Mounted under `/api`: two `/auth` implementations (`backend/main.py:93-100`); `/users` (`users/router.py:30-175`); products (`routers/products.py:10,227-375`); reels (`routers/reels.py:13,24-108`); cart/checkout/payment verify (`routers/cart.py:71-270`); orders/coins/subscriptions/admin (`routers/other.py:13-259`); shipping (`shipping/router.py:13,22-224`); seven shipping webhooks (`shipping/webhooks.py:13,82-150`). Roles are viewer/seller/admin with centralized guards (`core/deps.py:44-53`). No worker/scheduler manifest exists.

## Current data ownership

| Domain | Active owner | Conflict/gap |
|---|---|---|
| users/addresses | Supabase Auth + PostgreSQL repository | legacy Mongo auth/users remain |
| seller profiles | PostgreSQL DDL only | no active repository/workflow |
| products | Mongo | no master/listing split/storefront |
| media | Cloudinary/local fallback | target Object Storage |
| carts | Mongo | user/product only, no storefront |
| wishlists | Mahila user document only | FastAPI missing |
| orders/items | Mongo embedded | PostgreSQL DDL also defines them but inactive |
| payments | IDs/status on Mongo orders; subscription transactions Mongo | comments/DDL claim PostgreSQL ledger |
| refunds | none | missing |
| subscriptions | split PG user fields/Mongo transaction/PG DDL | no clear owner |
| reels/views/coins/discounts | Mongo; user coin balance PostgreSQL | cross-store transaction not atomic |
| shipping/pickups | Mongo collections | background ownership unclear |
| sessions/reset/OTP | Supabase Auth + Redis helpers | legacy Mongo collections remain; memory fallback |

Evidence: ownership comments/settings (`backend/core/config.py:16-36`), active Mongo checkout (`routers/cart.py:125-217`), PostgreSQL DDL (`scripts/supabase_schema_v2.sql:15-150`), Redis namespaces/fallback (`shared/database/redis.py:6-15,38-166`).

## Authentication and security

New auth uses Supabase Auth and PostgreSQL profiles (`backend/auth/services.py:37-216`); duplicate Mongo/JWT auth shares paths. Web buyer/seller/admin/shared/Mahila persist bearer tokens in localStorage (`packages/shared-api/src/client.ts:55-78`, respective `src/lib/api`/stores); mobile uses SecureStore. Redis logs generated OTP values (`backend/shared/database/redis.py:207-220`). Mahila independently verifies JWT and boolean admin (`server/middleware/auth.js:1-37`).

Security blockers: client-selected payment method; missing payment webhook/refund/idempotency; Mahila client-submitted totals (`client/src/pages/Checkout.js:30-42`, `server/controllers/orderController.js:8-19`); duplicate auth; localStorage; per-process Redis fallback; `--forwarded-allow-ips=*` (`backend/Dockerfile:11`); committed demo credentials/destructive Mahila seed (`server/seed.js:9-12,30-40,67-69`); critical/high npm findings. No tracked real `.env` was found; ignored env files were inventoried by names only.

## Multi-storefront readiness

No implemented `storefront`, `storefront_id`, tenant/channel, product listing, publishing channel, or merchant-account model was found. Products have one price/stock; carts key user/product; orders lack immutable origin; permissions are role-only; discounts/analytics/reels are global. Therefore visibility, listing prices, carts, wishlists, orders, payments, refunds, promotions, analytics, and content cannot be reliably isolated between Zolexora Shop and Mahila Madel (`backend/models/documents.py:57-117`, `packages/shared-api/src/types.ts:31-87`).

Required logical entities are documented in `docs/data-model.md`, including storefronts/domains, master products/listings, seller permissions, inventory ledger, scoped commerce aggregates, payment attempts/refunds, sessions/media/audit.

## Payment evidence

Current methods are global Razorpay, manual UPI and coins; Mahila shows COD/UPI/Card/NetBanking as UI simulation (`apps/MahilaMadel/web-app/client/src/pages/Checkout.js:120-145`). Checkout accepts browser `payment_method` (`backend/routers/cart.py:26-29,115-123`). Razorpay creation uses one global pair (`core/payments.py:4-9`); browser HMAC verification checks signature/ownership and partly handles repeats (`routers/cart.py:223-250`). No payment webhook is mounted, despite a configured webhook secret; no refund, capture/status adapter, reconciliation, settlement or provider/account-scoped uniqueness exists. Manual UPI takes a user UTR for admin approval without a unique constraint (`cart.py:253-270`, `other.py:197-235`).

Target interface/configuration and secure flows are in `docs/payment-architecture.md`. The backend must derive provider/account from persisted order/storefront and refunds must use the original attempt.

## Mahila preserve/migrate/retire

| Preserve | Migrate | Retire |
|---|---|---|
| independent visual language and useful catalog/cart/checkout/order/profile/wishlist UX (`client/src/index.css:1-73`, `App.js:35-50`) | customer functions into shared FastAPI/contracts with Mahila storefront context | Express/Mongoose API, duplicate models/JWT/admin/static explorer, destructive seed/demo credentials/ShopKart branding |

The server exposes duplicate auth/products/orders/users/cart/wishlist (`server/server.js:44-51`); seed contains placeholder images and deletes all core collections (`server/seed.js:15-40`); payment is explicitly UI-only (`client/src/pages/Checkout.js:138-145`). Production blockers include no tests, client-trusted prices, localStorage, vulnerable dependencies, demo content, and dual truth.

## OCI readiness

Target map: hosting→Compute; images→Registry; Mongo/Supabase→Autonomous AI Database; Cloudinary→Object Storage; Redis→OCI Cache/Valkey; edge→LB/WAF/DNS/Certificates; secrets→Vault; operations→Logging/Monitoring/Notifications; email→Email Delivery; IaC→Terraform/Resource Manager.

Current deployment docs prescribe Vercel/Northflank/Cloudflare (`DEPLOYMENT.md:5-16,68-100`). Backend has local durable-volume assumptions (`backend/main.py:34-35,88-89`; `docker-compose.yml:42-43`), Supabase AWS pooler hardcoding (`shared/database/postgres.py:146-182`), and overly broad proxy trust. ARM64 Dockerfile checks pass structurally, but full builds are unproven with native Python pins. No Terraform exists; Next apps are not proven static-exportable.

## Environment names

Tracked examples cover: `APP_ENV`, `TESTING`, `SKIP_STARTUP_ENV_VALIDATION`, Mongo/DB, Supabase URL/service/DSN/password, Redis, JWT, admin seed, Cloudinary, Resend/sender, Google IDs, Razorpay keys/webhook, UPI merchant, CORS and application URLs, shipping webhook, public API/Google/Razorpay frontend variables. Ignored local files additionally name provider-specific Delhivery/NimbusPost/Shiprocket/Pickrr/DTDC/Bluedart/India Post settings. No values were copied.

## Commands and results

Complete command/exits/classifications are in `../test-baseline.md`. Summary: tools available except `python`; frozen root install scopes only three projects; root checks execute zero tasks; all direct Zolexora app checks are workspace-blocked; Mahila npm installs/build pass but client has zero tests and server no test; backend compile/Ruff and 59 tests pass; ARM64 Dockerfile checks pass but no full image build. npm reported root 2, client 51, server 7 vulnerabilities, including critical/high. No fixes/upgrades occurred.

## Documentation mismatches

Root docs/CI/Docker use flat old paths, old domains, and old providers (`README.md:157-163,417-451`; `DEPLOYMENT.md:5-16`; `.github/workflows/ci.yml:69-70`). README includes machine-local file links and default credential prose (`README.md:64,133,503,511-513`). Code returns `supabase_pg` health while docs show `supabase`. `adminpanal` is misspelled.

## Ranked blockers and Phase 1 recommendation

- P0: GAP-REP-001/002, DATA-001/002, BE-001, SF-001/002, PAY-001/002, FE-002, TEST-001, SEC-001/002.
- P1: secure sessions/RBAC, Oracle/OCI adapters/Terraform/secrets/observability, full ARM64, dependency remediation, meaningful coverage/readiness.
- P2: shared-client adoption, rendering optimization, branding/docs cleanup, advanced analytics/audit.

Exact Phase 1: align actual package paths across workspace/lock/root scripts/Turbo/Docker/Compose/CI/docs; make frozen install discover every intended app and every root command execute real tasks; add only focused regression checks needed for safe organization. Do not implement storefront/payment/data migration or deploy.

Phase 0 acceptance: actual tree/apps/routes/storage/auth/Mahila/storefront/payment/OCI/security evidence recorded; all safe baselines attempted; no source/config/database/remote/deploy/commit/push action; documentation-only allowed diff.
