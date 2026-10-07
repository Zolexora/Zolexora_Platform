# MR-01G — Storefront-safe Seller and Marketplace Admin Contracts

## Outcome

- Starting SHA: `b22828c784f9571c74ed4b7f3b5de3660076883d`
- Final implementation commit SHA: `99ca884ce4a8b420fb8a213aa6e70924fda8fa84`
- Verdict: **PASS — MR-01G complete; wait for authorization for the next batch**

## Files changed

- `apps/portals/marketplace-admin/web/src/lib/api.ts`
- `apps/portals/seller/mobile/src/lib/api.ts`
- `apps/portals/seller/web/src/lib/api.ts`
- `contracts/marketplace/openapi.json`
- `packages/shared-api/src/generated/types.ts`
- `services/marketplace-api/main.py`
- `services/marketplace-api/models/catalog.py`
- `services/marketplace-api/models/portal_catalog.py`
- `services/marketplace-api/models/primitives.py`
- `services/marketplace-api/routers/other.py`
- `services/marketplace-api/routers/portal_catalog.py`
- `services/marketplace-api/routers/products.py`
- `services/marketplace-api/tests/test_cart.py`
- `services/marketplace-api/tests/test_checkout.py`
- `services/marketplace-api/tests/test_orders_fulfillment_contracts.py`
- `services/marketplace-api/tests/test_portal_catalog_contracts.py`
- `services/marketplace-api/tests/test_product_validation.py`
- `docs/status/audits/mr-01g-seller-admin-portal-contracts.md`

## Contracts implemented

Seller contracts now provide typed, paginated listing collection and owned-listing reads; eligible master-product listing creation; allow-listed price, title, and description updates; safe inventory reads and absolute quantity updates; and controlled pause, resume, and archive lifecycle actions. Listing creation uses the server-selected `draft` state. Public models exclude seller/storefront authority, moderation outcome, computed inventory, audit actor, timestamps, provider data, credentials, and persistence metadata.

Admin contracts now provide typed storefront listing collection and detail reads, safe seller ownership and inventory inspection, and controlled approve/reject moderation transitions. The existing authenticated `admin` role remains the only global admin authority; every resource lookup is still constrained to the validated request storefront. Unsafe legacy raw admin product routes were removed from public routing and OpenAPI.

## Authorization filters

- Seller listing collection: `{"storefront_id": context.key, "seller_id": authenticated_user["id"]}`.
- Seller listing target: `{"id": listing_id, "storefront_id": context.key, "seller_id": authenticated_user["id"]}`.
- Seller master product: `{"id": product_id, "seller_id": authenticated_user["id"]}`; creation also requires `is_active=True` and the validated storefront catalog entry.
- Seller inventory, after the scoped listing authorization: `{"product_id": listing["product_id"], "seller_id": listing["seller_id"]}`.
- Admin listing target: `{"id": listing_id, "storefront_id": context.key}` after `admin_only` authentication.
- Admin inventory, after the scoped listing authorization: `{"product_id": listing["product_id"], "seller_id": listing["seller_id"]}`.

Cross-seller and cross-storefront targets return the established not-found response. Tests verify that forged storefront hints, request identity fields, inaccessible listings/inventory, invalid quantities, and rejected lifecycle/moderation operations leave repository state unchanged.

## Validation and moderation

Inventory uses `StrictInt`, accepts absolute zero, rejects bool, float, numeric string, negative values, and values above `9,007,199,254,740,991`. Public input cannot mutate reserved, sold, available, historical, ownership, storefront, product, or audit fields. No delta semantics were introduced.

Seller lifecycle transitions are `active -> paused`, `paused -> active`, and `draft|active|paused|rejected -> archived`. Admin moderation is limited to `draft|rejected -> active` for approval and `draft|active|paused -> rejected` for rejection. The server records moderation actor and timestamps. Illegal transitions are rejected before mutation.

## Verification

Backend baseline was 209 passing tests; the final full backend suite passed 232 tests (+23), with no deleted, skipped, weakened, or xfailed coverage.

| Check | Result |
| --- | --- |
| Ruff on changed Python files | exit 0 |
| Focused MR-01G tests | exit 0; 23 passed |
| Catalog, inventory, storefront, seller, admin, MR-01D/MR-01E regressions | exit 0; 138 passed |
| Full backend pytest suite | exit 0; 232 passed |
| Backend Python static typing | NOT CONFIGURED |
| Canonical OpenAPI generation | exit 0 |
| Canonical TypeScript generation | exit 0 |
| Second OpenAPI generation | exit 0; identical SHA-256 `0555af4158567184344e8771b3e681412c50966eb8320c609661b702c1ebd6f3` |
| OpenAPI drift check | exit 0 |
| Shared API type-check/build | exit 0 |
| Seller web type-check/build | exit 0 |
| Seller mobile type-check/build/export | exit 0 |
| Marketplace admin type-check/build | exit 0 |
| Workspace type-check | exit 0; 7 tasks successful, 10 packages verified |
| `pnpm verify` | exit 0 |
| `git diff --check` and staged diff check | exit 0 |

The generated OpenAPI and TypeScript contracts contain strict inventory bounds, canonical Money bounds and UTCDateTime schemas, explicit seller/admin models, and no public identity/role overrides, arbitrary moderation status, credentials, secrets, or raw provider/database metadata.

## Deferred decisions and constraints

- Admin inventory adjustment remains deferred because accepted architecture does not grant that authority.
- Inventory delta adjustments remain deferred because no accepted delta semantics exist.
- Persisted seller-storefront assignments and storefront-scoped admin grants require a later accepted data model and migration; MR-01G preserves existing seller ownership and explicit global `admin` authority without inventing either.
- Complete seller/admin portal workflows remain a later application milestone; only minimal typed clients were added.
- Required reading named `docs/status/gap-analysis.md`, but that file is absent. `docs/status/current-status.md` also records a stale 210-test/MR-01-complete state; neither discrepancy changed the verified MR-01G baseline or implementation and historical status was not rewritten.

No external service was contacted. `pnpm verify:oracle` performed only offline static and Alembic SQL validation; it did not connect to a database. No persistence migration was added. No actual `.env` or ignored `.env.production` file was changed. No credential value, private key, or environment-file content was inspected.

Implementation commit `99ca884ce4a8b420fb8a213aa6e70924fda8fa84` was committed with `feat(contracts): add storefront-safe seller admin contracts`, pushed to `origin/mr-01-canonical-marketplace-contracts`, fetched, and verified at divergence `0 behind / 0 ahead` with matching local and remote SHAs. This report is the sole documentation-only follow-up for MR-01G.
