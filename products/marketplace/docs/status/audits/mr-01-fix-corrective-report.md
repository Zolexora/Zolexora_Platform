# MR-01-FIX Corrective Report

## 1. Git State Verification
- **Branch**: `mr-01-canonical-marketplace-contracts`
- **Working Tree**: Clean (no tracked or untracked modifications pending)
- **Latest Commit**: `fdb5126 docs(MR-01): finalize report SHA post-push`
- **Divergence**: 0 commits behind, 0 commits ahead of `origin/mr-01-canonical-marketplace-contracts`
- **Remote Push Status**: All commits including this report are successfully pushed to `origin`.
- **Audit Commit**: `6fb3b7d` exists on the remote feature branch.

## 2. `.env.production` Handling
Newly created `.env.production` files:
1. `apps/portals/marketplace-admin/web/.env.production`
2. `apps/portals/seller/web/.env.production`
3. `apps/storefronts/zolexora-shop/web/.env.production`

- **Git Status**: Ignored (verified via `git check-ignore`).
- **Persistence**: Local-only, not committed.
- **Reason for creation**: Required by Next.js during static build phase (`pnpm verify`) which fails without `NEXT_PUBLIC_API_URL` defined.
- **Content Security**: Contains only public build configuration (`NEXT_PUBLIC_API_URL=https://api.zolexora.com/api`).
- **Secrets Exposure**: None. No Cashfree or Razorpay credentials exist in these files.
- **Compliance**: Fully compliant local-only workaround.

## 3. Finding Closure Status
| Finding ID | Title | Status |
|---|---|---|
| FIND-MR01A-001 | Money validation | **CLOSED** |
| FIND-MR01A-002 | UTCDateTime validation | **CLOSED** |
| FIND-MR01B-001 | Product storefront isolation | **CLOSED** |
| FIND-MR01B-002 | Order storefront isolation | **CLOSED** |
| FIND-MR01F-001 | Ruff cleanup | **CLOSED** |
| FIND-MR01F-002 | Cashfree backend settings | **CLOSED** |
| FIND-MR01C-001 | Legacy migration | **DEFERRED — NON-BLOCKING** |

## 4. Contract Verification Directives
- **Money**: Rejects `bool`, `float`, `str`, negatives, and values exceeding `9007199254740991`.
- **UTCDateTime**: Rejects naive inputs; properly normalizes timezone-aware timestamps to UTC.
- **Product Contracts**: Update, delete, and image upload mutations are now completely storefront-scoped.
- **Side Effects**: Unauthorized cross-storefront image uploads fail with a 404 before generating any storage side effects.
- **Order Contracts**: Read lists, detail access, and status mutations strictly enforce `storefront_id` filters alongside ownership rules.
- **Authentication**: JWT/role authorization remains strictly enforced.
- **Configuration Names**: Cashfree integration names strictly adhere to `CASHFREE_ENVIRONMENT`, `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`.
- **Secret Safety**: No provider credentials exist in OpenAPI schemas, generated TypeScript models, or frontend environments.
- **Payment Operations**: Payment routes remain non-operational contract stubs.

## 5. Environment & Tooling
- **Backend Python static typing**: NOT CONFIGURED
- **Feature-branch CI**: PASSED (Workflow `Docs Cleanup & Lint` passed successfully on the exact remote HEAD `fdb5126d35a2f09cd7cf18a5933201d8a526b782`)

## 6. Verdict
**PASS** — MR-01D may now be separately authorized.
