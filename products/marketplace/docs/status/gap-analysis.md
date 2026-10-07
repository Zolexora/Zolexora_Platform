# Gap analysis

Each row supplies ID, severity, current/required state, evidence, risk, dependency, phase, and expected files.

## Repository structure

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-REP-001 | P0 resolved | Explicit workspace now discovers ten required packages; guard rejects omissions | `pnpm-workspace.yaml`; `scripts/verify-workspace.mjs`; frozen install and guard pass | ADRs 0005/0007; completed P1.6 |
| GAP-REP-002 | P0 resolved | Root lock, Docker, Compose, CI and active README paths use canonical directories | `pnpm-lock.yaml`; `infrastructure/docker/Dockerfile.frontend`; `docker-compose.yml`; `.github/workflows/ci.yml` | ADR 0006; completed P1.5 |

## Backend

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-BE-001 | P0 accepted | duplicate new/legacy `/auth` routers → one auth owner | `services/marketplace-api/main.py:93-100`; ambiguous/security drift | repository baseline; P3/4; FastAPI auth/main/tests |
| GAP-BE-002 | P1 accepted | startup connects/seeds/indexes → explicit safe lifecycle/jobs | `services/marketplace-api/main.py:38-52`; unintended mutation/startup fragility | data ownership; P3; lifecycle/seed/index/tests |
| GAP-BE-003 | P1 resolved | shallow health always `ok` → liveness/readiness | `services/marketplace-api/main.py:114-129`; bad traffic routing | OCI topology; P6; health/tests/infra |

## Data model

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-DATA-001 | P0 accepted | Mongo routes conflict with PG DDL/comments → one domain ownership map/Oracle model | `services/marketplace-api/core/config.py:16-36`, `services/marketplace-api/scripts/supabase_schema_v2.sql:81-120`; split truth | ADR/data model; P3; FastAPI repos/models/tests/docs |
| GAP-DATA-002 | P0 accepted | product stock/order embeds → master/listing, ledger, immutable snapshots | `services/marketplace-api/models/documents.py:57-117`; oversell/history loss | storefront foundation; P2/3; catalog/inventory/order modules |

## Authentication

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-AUTH-001 | P1 accepted | web localStorage bearer → HttpOnly cookie/CSRF | `packages/shared-api/src/client.ts:55-78`; XSS token theft | ADR 0004; P4; FastAPI/web auth/tests |
| GAP-AUTH-002 | P1 accepted | roles only → seller members/store permissions | `services/marketplace-api/core/deps.py:44-53`; over/under-authorization | storefront entities; P4; auth/seller tests |

## Storefront isolation

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-SF-001 | P0 accepted | exact request context exists; no storefront fields/entities/scoped queries → trusted context on all aggregates | `services/marketplace-api/storefronts/`; products/cart/order types still lack IDs (`packages/shared-api/src/types.ts:31-87`) | request context complete; persisted isolation P3 |
| GAP-SF-002 | P0 accepted | seller role can publish globally → explicit seller-storefront permissions | `services/marketplace-api/core/deps.py:44-47`; unauthorized publication | SF-001; P2/4; permissions/admin/tests |

## Payment gateways

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-PAY-001 | P0 accepted | browser sends method/global credentials → backend selects account from order/storefront | `services/marketplace-api/routers/cart.py:26-29,115-123`; wrong merchant/security | SF-001/ADR 0003; P2/3; payment/order/config/tests |
| GAP-PAY-002 | P0 accepted | no payment webhook/refund/reconciliation/idempotency → full attempt/event/refund lifecycle | payment routes end at browser verify/manual UPI (`cart.py:209-270`); loss/duplicates | DATA-001; P3/8; payments/webhooks/jobs/tests |

## Frontends

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-FE-001 | P1 accepted | duplicated clients/types; shared package unused → shared contracts | local `src/lib/api.ts` files; drift | REP-001; P1/5; packages/apps |
| GAP-FE-002 | P0 accepted | Mahila client totals/payment and duplicate API/admin → shared server-priced API, retire duplicate after parity | `apps/storefronts/mahila-madel/web/src/pages/Checkout.js:30-42`; tampering/dual truth | FastAPI parity; P3/5; Mahila/shared/FastAPI/tests |

## Oracle infrastructure

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-OCI-001 | P1 accepted | no OCI Terraform/services → isolated staging/prod OCI topology | no Terraform; no deployability/repeatability | architecture/data; P6; `infrastructure/oci/**` |
| GAP-OCI-002 | P1 accepted | Cloudinary/local/Supabase hardcoding → Object Storage/ADB/Vault/cache adapters | `services/marketplace-api/core/cloudinary_client.py`, `services/marketplace-api/shared/database/postgres.py:146-182`; lock-in | OCI-001; P3/6; FastAPI/infrastructure/tests |
| GAP-OCI-003 | P1 accepted | structural ARM64 check only → full Ampere build/run | native pins in requirements; runtime incompatibility | REP-002; P6; Docker/CI/infra |

## Testing

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-TEST-001 | P0 resolved | Root build runs 8 tasks, type-check 7, and tests 3 suites; guard precedes checks | Phase 1.6 command output; `package.json`; `turbo.json` | REP-001; completed P1.6 |
| GAP-TEST-002 | P1 accepted | Mahila zero-test blocker resolved; seller/admin and broader behavior still need coverage | Mahila web 1 test, Mahila mobile 2, Zolexora mobile 6; legacy server no suite | feature integration; P5; app tests/CI |
| GAP-TEST-003 | P1 accepted | request resolver has focused unit/integration coverage; persisted cross-store data isolation has no tests or implementation | `services/marketplace-api/tests/test_storefront_context.py`; 52 focused tests | data model; P3; domain repositories/tests |
| GAP-DESIGN-001 | P1 accepted | Mahila mobile has text identity but no approved icon/splash → approved release artwork | `apps/storefronts/mahila-madel/mobile/app.json`; release branding incomplete | design approval; P5; Mahila mobile assets/config |

## Security

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-SEC-001 | P0 accepted | OTP value logged → never log secret | `services/marketplace-api/shared/database/redis.py:207-220`; account compromise | tests; P1/4; Redis/auth tests |
| GAP-SEC-002 | P0 accepted | client-trusted Mahila totals → server calculation | `apps/storefronts/mahila-madel/web/src/pages/Checkout.js:30-42`, `apps/storefronts/mahila-madel/legacy-server/controllers/orderController.js:8-19`; financial tampering | shared checkout; P3/5; FastAPI/Mahila/tests |
| GAP-SEC-003 | P1 accepted | critical/high npm findings/deprecated Multer → reviewed upgrades | Phase 0 npm output; known vulnerabilities | REP-001; P1/8; manifests/locks/tests |
| GAP-SEC-004 | P1 accepted | forwarded headers trust all → trusted OCI proxy range | `services/marketplace-api/Dockerfile:11`; spoofed scheme/IP | OCI LB; P6/8; container/infra/tests |

## Documentation

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-DOC-001 | P2 | Canonical paths documented; legacy provider/domain deployment guidance remains transitional → synchronized target operations | `README.md`; `docs/runbooks/legacy-deployment.md`; operator error | OCI changes; P6; root/project docs |

## ERP customer integration

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-ERP-001 | P0 accepted | proposed generic v1 contract → ERP product-owned adopted/versioned implementation | `contracts/zolexora-erp/v1`; audited ERP integration app contains placeholders only | ERP product decision; P4; separate ERP repo plus compatibility tests |
| GAP-ERP-002 | P0 accepted | one-company/two-channel and two-company layouts supported but undecided → approved legal/GST mapping | `docs/data-ownership.md`; wrong invoicing/tax/company postings | business/legal decision; P4; configuration only after approval |
| GAP-ERP-003 | P1 accepted | audited deployment configures one Frappe site; commercial cross-customer site/isolation policy unverified | ERP `.env.example`, `compose.yaml`, Frappe site scoping | ERP architecture/security confirmation; before live integration |
| GAP-ERP-004 | P1 resolved | outbox/inbox/reconciliation are designed only → PostgreSQL persistence and workers with recovery tests | `docs/erp-integration.md`, `erp-reconciliation.md` | ERP outbox integration complete; MR-16 |

## Oracle persistence

| ID | Sev | Current → required | Evidence / risk | Dependency; phase; files |
|---|---|---|---|---|
| GAP-ORA-001 | P0 resolved | offline Oracle DDL → empty-to-head migration, introspection, constraints, bootstrap, claims, repositories and readiness proven on disposable Oracle 23ai Free 23.9 | Phase 5 audit | completed Phase 5; OCI ADB parity remains GAP-ORA-004 |
| GAP-ORA-002 | P0 accepted | neutral mapping schema → approved legal/GST mapping | ADR 0010 and data ownership | business/legal evidence; before activation |
| GAP-ORA-003 | P1 accepted | storefront/integration foundation only → commerce domains migrated forward | `database/models.py`; legacy stores remain | domain migration design; later phases |
| GAP-ORA-004 | P1 accepted | OCI Database/Vault absent → production infrastructure and restore evidence | oracle infrastructure docs | explicit OCI authority |
