# Phase 1.6 test and build baseline

Date: 2026-07-14. Baseline commit: `87d751c455c6bd3dfd75d154389fb64745839e12`. Phase 0 results remain in `audits/phase-0-baseline-audit.md`.

| Command | Directory | Exit | Result | Classification | Gap |
|---|---|---:|---|---|---|
| `node --version`; `pnpm --version` | root | 0 | Node 24.18.0; pnpm 9.0.0 | Environment failure (informational) | — |
| `python --version`; `python3 --version` | root | 127 / 0 | `python` absent; Python 3.14.4 available as `python3` | Environment failure | — |
| `pnpm install --frozen-lockfile` | root | 0 | all 10 workspace projects including root; lockfile current | Pass | GAP-REP-001/002 resolved |
| `pnpm verify:workspace` | root | 0 | exactly nine required packages and paths verified | Pass | GAP-TEST-001 resolved |
| `pnpm list -r --depth -1` | root | 0 | root plus nine unique packages | Pass | GAP-REP-001 resolved |
| `pnpm build` | root | 0 | 7/7 tasks: three Next builds, two Expo exports, Mahila CRA, shared API | Pass with existing warnings | GAP-TEST-001 resolved |
| `pnpm type-check` | root | 0 | 6/6 TypeScript package tasks | Pass | GAP-TEST-001 resolved |
| `pnpm lint` | root | 0 | buyer Next lint + legacy server syntax + backend Ruff; two buyer warnings | Pass | GAP-TEST-001 resolved |
| `pnpm test` | root | 1 | continues through all suites: buyer mobile 5/5 pass; Mahila has zero tests and fails | Code failure | GAP-TEST-002 |
| `pnpm --filter @zolexora/storefront-zolexora-shop-mobile test` | root | 0 | 1 file, 6 tests pass after Phase 1.6 | Pass | GAP-TEST-002 |
| `PATH="$PWD/.venv/bin:$PATH" pnpm verify` | root | 1 | guard/type/lint pass; stops at honest Mahila zero-test failure | Code failure | GAP-TEST-002 |
| direct build for buyer/seller/admin web | root | 0 each | production builds pass | Pass with existing warnings | — |
| direct build for buyer/seller mobile | root | 0 each | Android Expo exports pass after correcting missing asset paths | Pass | — |
| direct Mahila client build | root | 0 | CRA production build passes; deprecation warning | Pass | GAP-FE-002 |
| direct shared API build/type-check | root | 0 | `tsc --noEmit` passes | Pass | GAP-FE-001 |
| `.venv/bin/python -m compileall -q services/marketplace-api` | root | 0 | compilation passes | Pass | — |
| `../../.venv/bin/python -m ruff check .` | `services/marketplace-api` | 0 | all checks pass | Pass | — |
| `TESTING=true ../../.venv/bin/python -m pytest -q` | `services/marketplace-api` | 0 | 59 passed at Phase 1 baseline; Phase 1.5 rerun recorded in its audit | Pass | GAP-BE-001 |
| `docker compose config --quiet` | root | 0 | all configured paths parse | Pass | GAP-REP-002 resolved |
| `docker buildx build --check --platform linux/arm64` (frontend/backend) | root | 0 each | structural checks pass without warnings | Pass (structural only) | GAP-OCI-003 |
| `docker compose build` | root | 130 | progressed through corrected manifest copies/frozen install and base-image downloads; stopped after ~10 minutes of slow network downloads before image completion | Environment failure | GAP-OCI-003 |

No placeholder tests or ignore flags were added. Mahila’s missing coverage remains visible.

Phase 1.5 reverified the canonical paths: frozen install, workspace guard, build, type-check, lint, backend compile/Ruff/59 tests, Compose parsing, and diff checks pass. `pnpm test` and `pnpm verify` retain exit 1 solely for Mahila’s zero-test condition.

Phase 1.6 resolves that blocker. Frozen install and the ten-package guard pass; root build is 8/8, type-check 7/7, lint 2/2 plus Ruff, and tests 3/3 suites (Zolexora mobile 6, Mahila mobile 2, Mahila web 1). Full `pnpm verify` passes, including FastAPI 59/59.

## Phase 2 baseline (2026-07-15)

- Focused storefront backend suite: 54 passed.
- Full FastAPI suite: 113 passed (up from 59).
- Buyer tests: Zolexora web 4, Zolexora mobile 7, Mahila mobile 3; existing Mahila web 1 remains green.
- Root workspace remains exactly ten packages. Root build passed 8/8 tasks, type-check 7/7, lint 2/2 plus Ruff, tests 4/4 suites with 15 client tests, and full `pnpm verify` passed.

## Phase 3 baseline (2026-07-15)

- Offline ERP contract validation: 12 JSON Schemas, 7 examples, and proposed OpenAPI 3.1 parsed and validated.
- Focused ERP contract/mapping tests: 18 passed.
- Full FastAPI suite: 131 passed (up from 113); compilation and Ruff pass.
- Frozen install and 10-package guard pass; root build 8/8, type-check 7/7, lint 2/2 plus Ruff, tests 4/4 suites with 15 client tests, and complete `pnpm verify` pass.

## Phase 4 baseline (2026-07-15)

- Starting baseline: 10 packages, 15 client tests, 131 FastAPI tests, and complete verify passed with `.venv/bin` on `PATH`.
- Offline Oracle validator, single Alembic head, and Oracle-dialect SQL generation pass; SQLite was not used.
- No Oracle DSN was available, so real migration/introspection/bootstrap constraint execution remains unverified.
- Focused storefront/Oracle suite: 69 passed. Full FastAPI: 146 passed (up from 131); Ruff and compilation pass.
- Frozen install, 10-package guard, 7/7 type-checks, 2/2 configured lint tasks plus Ruff, 4/4 client suites with 15 tests, 8/8 builds, and complete `pnpm verify` pass.
- Docker Compose parsing, `git diff --check`, single-lockfile, and broken-symlink checks pass after removing two stale generated `node_modules` links.

## Phase 5 baseline (2026-07-16)

- Disposable Oracle Database 23ai Free 23.9.0.25.07, AL32UTF8, x86_64/amd64 without emulation: empty-to-head in 1 second; second upgrade no-op; 13 tables plus Alembic, 14 PKs, 16 FKs, 10 unique constraints, five JSON checks, three function-based indexes, and immutable trigger introspected.
- Real Oracle verifier: 28 passed; controlled readiness/repository outage and recovery checks passed. Focused Oracle persistence: 18 passed; storefront resolver: 54 passed; combined focused: 72 passed.
- Full FastAPI: 149 passed, zero skipped; compilation and Ruff pass. Client suites: 15 passed, zero skipped.
- Frozen install, ten-package guard, 8/8 builds, 7/7 type-checks, 2/2 configured lint tasks plus Ruff, and complete `pnpm verify` pass with documented public API build variables.
- Both Compose configurations, one-lockfile search, zero broken symlinks, zero skipped markers, forbidden ERP coupling scan, secret signature scan, and `git diff --check` pass.

## MR-06 baseline (2026-08-14)

- Focused backend suite (Master Catalog, Listings, and Media): migrated `portal_catalog` to PostgreSQL.
- S3-compatible media adapter implemented with upload validation and PostgreSQL-backed lifecycle tracking.
- Full FastAPI backend tests: 325 passed, zero skipped.
- MR-06 acceptance gate met: one product can have independent listings across storefronts, cross-store listings do not leak, media authorization and validation pass.

## MR-07 baseline (2026-08-14)

- Inventory, Pricing, Tax, and Promotions schemas and Alembic migration `0006_inventory_pricing_tax_promotions` applied successfully.
- Focused backend test suites (inventory, pricing, tax, promotions) added covering idempotency, effective dates, currency validation, and concurrent row-level locks.
- Full FastAPI backend tests: 336 passed, zero skipped.
- MR-07 acceptance gate met: negative availability and overselling prevented; client commercial values ignored; promotion concurrency and storefront isolation pass.

## MR-08 baseline (2026-08-14)

- Cart, Wishlist, Address, and Checkout Quotation schemas and Alembic migration `0007_cart_wishlist_checkout_quote` applied successfully.
- Added comprehensive test suites across `cart`, `wishlist`, `address`, and `checkout_quote` modules ensuring guest-merging rules and storefront isolation.
- Implemented `checkout_quote` calculation engine ensuring prices are reproducible on the server and that stale inventory/pricing rejects the quote.
- Full FastAPI backend tests: 350 passed, zero skipped.
- MR-08 acceptance gate met: guest carts cannot cross storefronts; quote totals are strictly server-side calculated and client values are ignored; stale quotes trigger invalidation.

## MR-09 baseline (2026-08-14)

- Alembic migration `0008_order_capture_payment_orchestration` created, adding `payment_webhook_receipt` and `payment_transaction_ledger` schemas.
- `payment_orchestration` module tests verify correct processing of capture/failure lifecycles via a provider-neutral interface.
- Complete backend test suite passed with 352 passing tests, guaranteeing idempotent, ledger-backed handling of transactions and deterministic state machine transitions.

## MR-10 baseline (2026-08-14)

- Alembic migration `0009_orders_fulfillment_returns` added schemas for `order_state_history`, `fulfillment_record`, `shipment_line`, `shipment_tracking_event`, `return_request`, `return_authorization`, `dispute_reason`, and `dispute`.
- `shipping` module created with a `ShippingProviderAdapter` and `FakeShippingProvider`.
- Backend tests verify order creation, cancellation, fulfillment, returns, and dispute transitions map seamlessly to underlying postgresql schemas.
- Total of 352 integrated backend tests pass cleanly.

## MR-16 baseline (2026-08-15)

- Alembic migration `0010_erp_outbox_inbox` created for independent ERP integration outbox pattern.
- Transactional outbox logic integrated with `orders` creation and `adapter.py` created for fake ERP integration and webhook validation.
- All backend tests passed, resulting in 356 passing tests with zero skipped.
- OpenAPI schema 3.1.0 cleanly regenerated.
- `pnpm verify` full workspace verification passed successfully.
