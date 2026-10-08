# Teamwork Project Prompt — Final Draft

Complete the remaining ZolexoraMarketplace roadmap, MR-05 through MR-19, as a controlled autonomous execution loop.

Working directory:

`/data/projects/development/Zolexora/ZolexoraMarketplace`

Integrity mode:

`development`

The appended 31-section ZolexoraMarketplace roadmap is authoritative. Read it completely before planning or editing. This summary does not replace, shorten, reinterpret or override its detailed architecture rules, phase requirements, exclusions, decision gates, tests, acceptance gates or reporting requirements.

## Requirements

### R1. Controlled Sequential Execution

Execute MR-05 through MR-19 sequentially, one bounded phase at a time.

Do not wait for the user to type “next” after every successful phase.

Do not:

* bypass acceptance gates
* skip mandatory tests
* invent business or production policy
* silently broaden phase scope
* start dependent later-phase work early
* represent placeholder behavior as complete
* claim incomplete work as complete

Write and validate the complete mandatory phase report immediately after each phase and before beginning the next phase.

### R2. Pre-Flight and Baseline Reconciliation

Before starting MR-05:

1. Verify that the working directory is the ZolexoraMarketplace repository.
2. Record the repository root, branch, HEAD, upstream, remotes and complete worktree state.
3. Record and preserve all pre-existing modified, staged, deleted, renamed and untracked files.
4. Never reset, clean, stash, overwrite, discard or revert user-created work.
5. Treat MR-00 through MR-04 as the accepted baseline because the latest user report states that MR-04 is complete.
6. Reconcile that claim against repository reports, ADRs, migrations, implementation and tests.
7. Do not repeat or redesign MR-00 through MR-04 unless repository evidence materially contradicts the accepted baseline.
8. Run the smallest honest regression set necessary to establish a safe MR-05 starting point.

If MR-04 is materially incomplete, stop with an evidence-backed discrepancy report instead of silently redefining project history.

### R3. Phase Execution Process

For every phase from MR-05 through MR-19:

1. Inspect all relevant source files, tests, migrations, schemas, contracts and documentation.
2. Classify the existing implementation as not started, partial, unverified, defective or already complete.
3. Identify exact gaps.
4. Prepare a bounded implementation plan.
5. Implement only the authorized phase.
6. Add or repair production-grade tests.
7. Run focused verification continuously.
8. Run the proportionate repository-wide gates required by the roadmap.
9. Audit security, storefront isolation, seller isolation, authorization, data ownership, monetary integrity, concurrency, idempotency, secret handling and provider coupling.
10. Update existing ADRs, memory, runbooks, status records and audit evidence.
11. Produce the mandatory phase report.
12. Assign an honest verdict: PASS, PASS WITH BLOCKERS or FAIL.
13. Continue only when the current phase is PASS and no unresolved decision is required for the next phase’s safe provider-neutral implementation.

### R4. Decision Gates and Stop Conditions

Do not require every production decision to be finalized before implementing provider-neutral boundaries.

Continue using approved neutral designs where appropriate, including:

* fake payment providers
* fake shipping providers
* fake object-storage adapters
* fake ERP adapters
* versioned contracts
* secret references
* configurable mappings
* dry-run migration tooling

Stop when proceeding would require guessing or authoritatively deciding:

* legal-company ownership
* GST treatment
* payment merchant identity
* seller commission
* settlement or payout policy
* destructive data retention
* production migration policy
* live ERP tenant ownership
* another unresolved legal, commercial, security or data-ownership rule

When stopping, report the exact blocker, evidence, affected phase, safe work completed, supported options and exact user decision required.

### R5. Verification Requirements

Follow the complete verification strategy in the appended roadmap, including as applicable:

* workspace and repository static checks
* formatting and lint
* type-checking
* unit tests
* real PostgreSQL migration and constraint tests
* API tests
* RBAC and storefront-isolation tests
* seller-organization isolation tests
* payment webhook, replay and routing tests
* contract validation
* web and mobile workflow tests
* end-to-end storefront journeys
* security tests
* container validation
* deterministic release verification

Do not:

* substitute SQLite for tests intended to prove PostgreSQL behavior
* use pass-with-no-tests shortcuts
* skip critical security or isolation suites
* trust client-provided prices, totals, discounts, taxes, inventory or merchant routing

### R6. Git, Remote and Infrastructure Safety

Do not commit, push, merge, tag, publish images, create pull requests, mutate DNS, provision cloud resources, deploy applications, use live merchant credentials or perform live financial transactions unless explicitly authorized.

Never use destructive Git commands.

Permitted Git operations are read-only inspection and safe diff validation.

Every phase report must confirm:

* starting and ending HEAD
* branch and upstream
* initial and final worktree
* exact changed files
* diff summary
* `git diff --check`
* whether any commit occurred
* whether any push occurred
* whether any remote or infrastructure mutation occurred
## Current-State Precedence Rule

The original roadmap was written before MR-00 through MR-04 were completed. Any historical roadmap statement instructing the agent to “Begin MR-00,” approve DG-01 before MR-02, or otherwise restart an already completed foundation phase is superseded by the latest accepted project state.

The current execution baseline is:

* MR-00: completed
* MR-01: completed
* MR-02: completed
* MR-03: completed
* MR-04: completed, subject only to bounded repository reconciliation
* MR-05: current next phase

Use the appended roadmap as authoritative for architecture, scope, phase requirements, exclusions, decision gates, tests, acceptance gates and reporting rules.

Use the latest accepted project state as authoritative for determining which phase must run next.

Do not restart MR-00 through MR-04 unless repository evidence materially contradicts their accepted completion reports.


### R7. Execution-Limit Continuation

If an execution, context, tool or environment limit prevents completing MR-05 through MR-19 in one invocation:

1. Do not rush, compress or skip phases.
2. Do not falsely mark later phases complete.
3. Complete the current bounded phase where safely possible.
4. Write its complete phase report.
5. Persist the exact next phase, repository state, blockers, completed commands and continuation instructions in the existing project status or memory structure.
6. Return a precise resumable continuation report.

The next execution must resume from that recorded state without repeating completed work.

## Acceptance Criteria

### Execution and Reporting

* [ ] Phases execute sequentially from MR-05 through MR-19.
* [ ] Exactly one bounded phase is active at a time.
* [ ] Every completed phase has its mandatory report before the next phase starts.
* [ ] Reports include verdict, baseline, scope, files, commands, counts, evidence, blockers, next objective and Git state.
* [ ] ADRs, memory, runbooks and status records describe resulting repository truth.

### Verification and Constraints

* [ ] All applicable mandatory suites pass with zero skipped critical tests.
* [ ] No placeholder or fake-only implementation is represented as production-complete.
* [ ] Commercial totals and protected decisions remain backend-authoritative.
* [ ] Storefront, organization, seller, order and payment boundaries fail closed.
* [ ] No production secrets or private merchant configuration are exposed.
* [ ] No production cloud resource, DNS record, live credential or financial transaction is used.
* [ ] Existing user work is preserved.
* [ ] No commit, push or remote mutation occurs without explicit authorization.

### Completion

The project is complete only when MR-19 passes its release-readiness gate and the repository is ready for provider-neutral handoff to ZolexoraDeployment.

Repository release readiness must not be described as production deployment.

---

# AUTHORITATIVE APPENDED ROADMAP:

ZOLEXORA PRODUCT ENGINEERING
Marketplace Repository
Roadmap
A one-by-one build program for Zolexora Shop, Mahila Madel, the shared
Marketplace API, seller portal and Marketplace admin.
SCOPEZolexoraMarketplace repository only
CANONICAL
ADMINadmin.marketplace.zolexora.com
METHODOne bounded phase at a time
BASELINEPhase 5 committed and pushed
VERSION 1.0
16 July 2026
Internal planning document - no cloud resources or production changes authorizedZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
DOCUMENT CHARTER
Executive decision
Current focus
Build and complete the ZolexoraMarketplace repository. Cloud provisioning, the ZolexoraDeployment repository, ERP
product work, AI product work and production deployment are outside the current program.
This roadmap converts the completed Phase 5 baseline into a new Marketplace-only sequence named
MR-00 through MR-19. The new codes avoid confusion with earlier Phase 0-6 audits. Each phase is
independently scoped, tested, documented and accepted before the next begins.
Oracle Database and OCI Autonomous Database are no longer the application target. OCI may later host
Ubuntu development, testing or staging through the separate deployment program, but the Marketplace
application must remain provider-neutral.
The internal portal remains named Marketplace Admin. Its canonical public hostname is now
admin.marketplace.zolexora.com. The older marketplaceadmin.zolexora.com hostname is retired from
active plans.
Canonical public surfaces
SurfaceCanonical domainStorefront identityOwnership
Shared Marketplace
APIapi.zolexora.comResolved and validated by backendZolexoraMarketplac
e
Zolexora Shopshop.zolexora.comzolexora-shopCustomer storefront
Mahila Madelmahilamadel.storemahila-madelCustomer storefront
Mahila aliaswww.mahilamadel.storemahila-madelRedirect/canonicaliz
ation
Seller Portalseller.zolexora.comNo fixed buyer storefrontShared seller
surface
Marketplace Adminadmin.marketplace.zolexora.comExplicit authorized scopeShared admin
surface
Payment boundary
Zolexora Shop and Mahila Madel will use separate payment gateway accounts/configurations. Selection is performed by
trusted backend storefront ownership. Browser and mobile clients never select or override the merchant account.
Marketplace-only build program | Internal planning document
Page 2ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
WHAT THIS PROGRAM CONTROLS
Scope and non-negotiable boundaries
In current scopeOutside current scope
Marketplace domain architecture, FastAPI, PostgreSQL
transition, storefronts, buyer mobile apps, seller
web/mobile, admin web, shared contracts, tests, containers
and CI release contract.AWS/OCI provisioning, ZolexoraDeployment
implementation, ERP product development, AI product
development, DNS changes, live gateways, live ERP
credentials, deployment or customer-data migration.
Preserve from the completed work
- Canonical ten-package pnpm monorepo and organized application tree.
- Zolexora Shop and Mahila Madel as separate customer storefronts with separate buyer apps.
- Common FastAPI backend, seller portal and Marketplace admin.
- Trusted request-level storefront resolution and fail-closed host checks.
- Independent-company ERP integration boundary and proposed generic v1 contracts.
- Existing test, workspace, Docker-path and documentation evidence.
- Phase 5 audit as historical validation evidence, not active database architecture.
Supersede or retire deliberately
- Oracle Database as the canonical Marketplace data platform.
- OCI Autonomous Database Terraform, wallet and Oracle-specific runtime assumptions.
- Split MongoDB/Supabase/Oracle ownership after an evidence-backed migration plan.
- Duplicate Mahila Express/Mongoose commerce ownership after parity and migration proof.
- Browser-selected payment methods, client-trusted totals and global merchant configuration.
- LocalStorage bearer tokens, OTP logging and unaudited privileged operations.
- The old marketplaceadmin.zolexora.com hostname in active configuration.
Independent ERP rule
Zolexora ERP is a separate product and company offering. Marketplace is one ERP customer. Repositories, databases,
identities, administrators, secrets, deployments, backups and failure domains remain separate. Only versioned API/event
contracts may connect them.
Marketplace-only build program | Internal planning document
Page 3ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
REPOSITORY DESTINATION
Target Marketplace architecture
Zolexora ShopMahila MadelSeller PortalMarketplace Admin
Web and buyer mobileWeb and buyer mobileShared seller web and
mobileadmin.marketplace.zolexora.com
Marketplace FastAPI
Trusted storefront context, commerce, payments, admin and
integrations
PostgreSQLObject StoragePayment AdaptersERP API Boundary
Canonical Marketplace dataMedia and documentsSeparate accounts per
storefrontIndependent customer
integration
PrincipleApplication rule
Modular coreStart with a well-bounded FastAPI modular monolith; extract services only when operational
evidence requires it.
One source of truthPostgreSQL is the proposed canonical Marketplace database; no domain has two undefined
authoritative writers.
Storefront isolationEvery listing, cart, quote, order, payment, refund, promotion and analytics event carries
immutable storefront ownership.
Backend trustPrices, taxes, discounts, inventory, payment routing and permissions are decided by
backend-controlled data.
Adapter boundariesPayments, shipping, object storage, notifications, search and ERP use provider-neutral
ports/adapters.
Portable runtimeRepository outputs deterministic containers and commands; cloud-specific deployment
remains elsewhere.
Marketplace-only build program | Internal planning document
Page 4ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
KEEP CODE ORGANIZED BY PRODUCT SURFACE
Canonical repository map
ZolexoraMarketplace/
|-- apps/
| |-- storefronts/
| | |-- zolexora-shop/{web,mobile}
| | `-- mahila-madel/{web,mobile,legacy-server}
| `-- portals/
| |-- seller/{web,mobile}
| `-- marketplace-admin/web
|-- services/
| `-- marketplace-api/
| |-- app/domain modules
| |-- integrations/
| |-- migrations/
| `-- tests/
|-- packages/
| |-- shared-api/
| `-- shared-config/
|-- contracts/
| `-- zolexora-erp/v1/
|-- infrastructure/
| |-- docker/
| `-- nginx/ # product-local runtime contract only
|-- scripts/
|-- project/
| |-- docs/{decisions,runbooks}
| `-- status/audits/
|-- .github/workflows/
|-- AGENTS.md
|-- pnpm-workspace.yaml
`-- pnpm-lock.yaml
Organization rules
- Do not create a new shared package until two or more real consumers prove the abstraction.
- Application packages own UI and composition; shared packages own stable contracts/configuration, not
business databases.
- FastAPI domain modules own business rules; routers remain thin and repositories own persistence details.
- Legacy code remains visibly isolated and cannot become a dependency of new shared modules.
- Project documentation records durable knowledge; docs/status records current evidence and blockers.
- Only one JavaScript lockfile remains at repository root.
Deployment boundary
The Marketplace repository may contain Dockerfiles, local Compose, health checks and product Nginx templates.
Generic server installation, AWS/OCI provisioning, global edge stacks, monitoring infrastructure and backup transport
belong to ZolexoraDeployment later.
Marketplace-only build program | Internal planning document
Page 5ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
20 SEQUENTIAL PHASES
Roadmap at a glance
MilestonePhasesOutcomeExit condition
A. FoundationMR-00 to MR-04Clean architecture, PostgreSQL, secure
identity and persisted storefront isolation.No unresolved platform
ownership or cross-store
trust gap.
B. Commerce CoreMR-05 to MR-10Seller grants, catalog, inventory, pricing,
cart, payments and order lifecycle.Backend-controlled
purchase and refund
lifecycle passes isolation
tests.
C. Application SurfacesMR-11 to MR-15Seller, admin, both storefronts, both buyer
apps and Mahila legacy retirement.All user surfaces operate
on the shared Marketplace
API.
D. Integration and
HardeningMR-16 to MR-19ERP boundary, security, observability,
containers, CI and repository certification.Provider-neutral release is
ready for deployment
handoff.
One-by-one execution rule
- Start each phase from a known commit and record the complete worktree before editing.
- Implement only the listed phase objective; record discoveries for later rather than expanding scope.
- Every phase creates or updates its ADR/audit evidence and verification commands.
- No skipped critical tests, false-green scripts or pass-with-no-tests shortcuts.
- Finish with an exact file list, command results, blockers, Git diff and remote-mutation confirmation.
- Commit and push only when explicitly requested after the phase report is reviewed.
Current next action
Begin MR-00 only. Do not start PostgreSQL implementation, payment integration, cloud work or feature development in
the same change.
Marketplace-only build program | Internal planning document
Page 6ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
MR-00 TO MR-04
Milestone A - Foundation
Establish the trusted data, identity and storefront foundations. These phases close the architectural gaps
that would otherwise infect every later feature.
MR-00 Architecture reset and clean baseline
FOUNDATION
OBJECTIVEACCEPTANCE GATE
Convert Phase 5 into historical evidence and establish the
cloud-agnostic Marketplace repository as the only active scope.- Clean, deterministic ten-package workspace baseline.
DELIVERABLES
- Supersede Oracle Database and OCI Autonomous Database target decisions
without rewriting Git history.
- Inventory and classify every Oracle, OCI, MongoDB, Supabase and Mahila
legacy dependency.
- No unclassified data-store owner or active Oracle
production assumption.
- All existing tests still report honestly.
EXCLUDED
No database rewrite, deployment repository, cloud
provisioning, payment work or feature development.
- Adopt admin.marketplace.zolexora.com and remove the old admin hostname
from active configuration and documentation.
- Publish an evidence-backed transition ADR and phase audit.
MR-01 Canonical Marketplace contracts
FOUNDATION
OBJECTIVEACCEPTANCE GATE
Freeze product boundaries, public surfaces and shared contracts
before changing persistence or features.- Shared contracts build in isolation.
DELIVERABLES- Seller/admin clients have no fixed buyer storefront
identity.
- Canonical storefront, portal, actor, currency, locale and domain contracts.
- Unknown storefronts and forged contexts fail closed.
- API versioning, error envelope, idempotency and pagination conventions.EXCLUDED
- Ownership matrix for Marketplace, storefronts, sellers, buyers, ERP and
external providers.No data migrations and no new business feature.
- Compatibility rules for web and mobile clients.
MR-02 PostgreSQL foundation and data convergence
FOUNDATION
OBJECTIVEACCEPTANCE GATE
Establish one canonical Marketplace relational database and
eliminate split ownership.- Empty database to head and second no-op upgrade
pass.
DELIVERABLES- Constraint, index, transaction and rollback tests run
against real PostgreSQL.
- Approve PostgreSQL as the Marketplace database through a dedicated ADR.
- Create forward-only schema and Alembic migrations for identity, storefront,
commerce and integration foundations.
- Add transaction boundaries, repositories, connection pooling, readiness and
migration tooling.
- No Oracle runtime dependency remains in active
Marketplace code.
EXCLUDED
No customer data import and no production database
creation.
- Design import paths for legacy MongoDB/Supabase data without executing a
production migration.
Marketplace-only build program | Internal planning document
Page 7ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
MR-03 Secure identity, sessions and RBAC
FOUNDATION
OBJECTIVEACCEPTANCE GATE
Create one secure Marketplace identity and authorization system for
buyers, sellers, staff and administrators.- No browser localStorage bearer tokens.
DELIVERABLES
- Server-side sessions or secure rotating tokens using HttpOnly, Secure and
SameSite controls.
- Role, permission, organization and storefront-grant models.
- OTP delivery without logging secrets; rate limits and abuse protection.
- Cross-role and cross-store authorization tests fail
closed.
- Sensitive authentication values never appear in logs.
EXCLUDED
No social login, passkeys or enterprise SSO unless
separately approved.
- Session revocation, password reset, device/session inventory and admin
audit events.
MR-04 Persisted storefront and domain isolation
FOUNDATION
OBJECTIVEACCEPTANCE GATE
Move storefront identity from request-only context into durable
ownership and query isolation.- Cross-store read/write isolation tests cover every
persisted resource.
DELIVERABLES- Unknown, disabled, suffix, forwarded-host and
conflicting signals fail closed.
- Storefront, storefront-domain, status, locale, currency and immutable key
persistence.
- Immutable storefront keys and order-origin ownership
are enforced by the database.
- Exact host resolution for shop.zolexora.com and mahilamadel.store,
including approved aliases.EXCLUDED
- Storefront-aware repository filters and service boundaries.No products, carts, orders or payments yet.
- Admin and seller cross-store operations require explicit grants.
Marketplace-only build program | Internal planning document
Page 8ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
MR-05 TO MR-10
Milestone B - Commerce Core
Build the complete server-authoritative transaction path from seller permissions and listings through
payment, fulfillment, return and refund.
MR-05 Seller organizations and storefront grants
COMMERCE CORE
OBJECTIVEACCEPTANCE GATE
Create the shared seller model while preserving explicit storefront
publishing permissions.- A seller cannot publish to an ungranted storefront.
DELIVERABLES
- Seller organization, members, roles, verification status and audit history.
- Suspension immediately blocks write operations
without corrupting historical orders.
- Grant changes are fully audited.
- Storefront publishing grants with lifecycle, approver and reason.EXCLUDED
- Seller onboarding workflow and document metadata boundary.No settlement, payout or commission implementation.
- Admin approval and suspension controls.
MR-06 Master catalog, listings and media
COMMERCE CORE
OBJECTIVEACCEPTANCE GATE
Separate reusable product identity from seller/storefront-specific
offers.- One product can have independent listings across
storefronts.
DELIVERABLES- Unpublished and cross-store listings never leak
through APIs.
- Master products, categories, attributes, variants, brands and tax
classifications.- Media authorization and file validation tests pass.
- Storefront listings with seller, status, content, price reference and publication
lifecycle.
EXCLUDED
No recommendation engine, reels or generative AI.
- S3-compatible media adapter with safe upload validation and ownership.
- Search indexing contract without coupling the domain model to a search
vendor.
MR-07 Inventory, pricing, tax and promotions
COMMERCE CORE
OBJECTIVEACCEPTANCE GATE
Make every sellable offer deterministic and server-calculated.- Overselling and negative available inventory are
prevented transactionally.
DELIVERABLES
- Inventory source, reservation, release, adjustment and audit models.- Client-provided price, discount and tax values are
ignored.
- Storefront price books, effective periods, compare-at prices and currency
validation.- Promotion concurrency and cross-store isolation tests
pass.
- Tax policy and legal-company mapping hooks pending final GST decision.EXCLUDED
- Promotion eligibility, coupon usage, stacking and budget limits.No ERP synchronization and no accounting entries.
Marketplace-only build program | Internal planning document
Page 9ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
MR-08 Cart, wishlist and checkout quotation
COMMERCE CORE
OBJECTIVEACCEPTANCE GATE
Build storefront-scoped shopping state and a trustworthy server-side
checkout quote.- A cart cannot mix storefronts.
DELIVERABLES
- Totals are reproducible and signed or
server-referenced.
- Storefront-aware carts, items, wishlist, addresses and shipping selections.- Expired inventory, listing or quote conditions fail
safely.
- Server-side quote containing price, promotion, tax, shipping, inventory and
expiry.EXCLUDED
- Guest-to-account cart merge rules.No payment provider call and no final order creation.
- Concurrency and stale-quote handling.
MR-09 Separate payment gateways and payment
ledger
COMMERCE CORE
OBJECTIVEACCEPTANCE GATE
Route payments exclusively by trusted storefront configuration using
independent merchant accounts.- The browser cannot choose or override the merchant
account/provider.
DELIVERABLES- Forged, replayed, duplicated and out-of-order
webhooks are tested.
- Provider-neutral payment adapter and normalized payment state machine.
- Separate Zolexora Shop and Mahila Madel gateway/account configuration.
- Backend-created intents/orders; signed webhook verification on raw request
bodies.
- Idempotent capture, failure, timeout, retry, refund and reconciliation records.
- No secret or private provider configuration appears in
public APIs or logs.
EXCLUDED
No production merchant credential and no live financial
transaction.
MR-10 Orders, fulfillment, shipping, returns and
refunds
COMMERCE CORE
OBJECTIVEACCEPTANCE GATE
Create immutable commercial records and complete the
post-payment lifecycle.- No order can change origin storefront or historical
monetary snapshots.
DELIVERABLES- Partial fulfillment and partial refund calculations
reconcile.
- Order, order lines, immutable origin storefront, seller splits and status
history.
- Inventory reservation/commit and payment/order consistency rules.
- Duplicate commands remain idempotent across
retries.
EXCLUDED
- Shipping provider adapter, shipment, tracking and delivery events.
No seller payout or ERP accounting submission.
- Cancellation, return, refund and dispute workflows with authorization and
audit.
Marketplace-only build program | Internal planning document
Page 10ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
MR-11 TO MR-15
Milestone C - Application Surfaces
Connect the common domain model to every web and mobile surface, then retire the duplicate Mahila
backend only after verified parity.
APPLICATION
SURFACES
MR-11 Seller portal completion
OBJECTIVEACCEPTANCE GATE
Connect seller web and mobile to shared contracts and real seller
workflows.- No fixed customer storefront key is compiled into
seller clients.
DELIVERABLES
- Onboarding, members, storefront grants, catalog/listing, inventory and order
management.
- Shipment, return and seller analytics views.
- Every action is authorized server-side.
- Web and mobile critical-path tests pass.
EXCLUDED
No buyer storefront design changes.
- Permission-aware navigation and API error handling.
- Dedicated seller lint, type-check, test and build scripts.
APPLICATION
SURFACES
MR-12 Marketplace admin completion
OBJECTIVEACCEPTANCE GATE
Create the common operational control plane at
admin.marketplace.zolexora.com.- Old marketplaceadmin.zolexora.com references are
absent from active code.
DELIVERABLES- Admin actions are permissioned, attributable and
audited.
- Storefront/domain, seller/grant, catalog/listing, inventory, order and return
administration.- No hidden cross-store default exists.
- Payment/refund visibility without exposing secrets.EXCLUDED
- Audit log, reason-required mutations and high-risk action confirmation.No infrastructure administration or ERP Desk
replacement.
- Operational queues for failed webhooks, reconciliation and integration issues.
APPLICATION
SURFACES
MR-13 Storefront web completion
OBJECTIVEACCEPTANCE GATE
Complete both buyer web experiences on one shared commerce
platform without losing distinct branding.- Both storefronts pass independent end-to-end
purchase journeys using fake providers.
DELIVERABLES
- Zolexora Shop and Mahila Madel catalog, search, detail, cart, checkout,
account and order flows.
- Cross-store cache and state leakage tests pass.
- Accessibility and performance gates are documented
and enforced.
- Shared accessible UI primitives only where behavior is genuinely common.EXCLUDED
- Storefront-specific theme, content and analytics configuration.No Mahila legacy server retirement until parity is
proven.
- SEO metadata, canonical URLs, structured data and performance budgets.
Marketplace-only build program | Internal planning document
Page 11ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
APPLICATION
SURFACES
MR-14 Buyer mobile applications
OBJECTIVEACCEPTANCE GATE
Bring both independently branded buyer mobile apps to feature and
security parity.- A caller cannot override compiled storefront identity.
DELIVERABLES
- Zolexora Shop and Mahila Madel API integration using compiled storefront
identity.
- Secure session storage, deep links, checkout handoff and notification
contracts.
- No payment merchant configuration exists in app
bundles.
- Release builds and deep-link routing pass for both
identities.
EXCLUDED
No App Store/Play Store publishing.
- Approved Mahila icons, splash assets and store metadata.
- Android build, type-check, unit and critical flow coverage for both apps.
APPLICATION
SURFACES
MR-15 Mahila legacy server retirement
OBJECTIVEACCEPTANCE GATE
Remove duplicate Express/Mongoose ownership after documented
functional and data parity.- All Mahila web/mobile production paths use the
shared Marketplace API.
DELIVERABLES
- Endpoint, feature and data mapping from legacy server to Marketplace
FastAPI.
- Migration tooling with dry-run, validation, retry and reconciliation reports.
- Traffic cutover and rollback runbook.
- Migration counts, totals and ownership reconcile.
- Legacy runtime is disabled before code removal.
EXCLUDED
No destructive data cleanup without an approved
retention decision.
- Dependency and vulnerability removal after successful parity gate.
Marketplace-only build program | Internal planning document
Page 12ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
MR-16 TO MR-19
Milestone D - Integration and Hardening
Complete the independent ERP boundary, harden the platform and produce a provider-neutral release
contract for the later deployment program.
MR-16 Independent ERP integration implementation
INTEGRATION
AND HARDENING
OBJECTIVEACCEPTANCE GATE
Implement the Marketplace side of the generic ERP customer
contract without coupling repositories or databases.- Marketplace checkout remains available during ERP
outage.
DELIVERABLES- No direct Frappe, ERPNext, MariaDB or source-code
dependency.
- Transactional outbox, inbox, delivery attempts, dead letters and
reconciliation persistence.
- Replay, retry, dead-letter and reconciliation tests
pass.
- Tenant/organization/channel mappings supporting either legal-company
layout.EXCLUDED
- Background worker, signed webhook receiver and idempotent contract
client.Blocked from live calls until ERP adopts the contract
and legal/GST mapping is approved.
- Inventory, order, delivery, invoice, payment and refund synchronization
workflows.
MR-17 Security, quality, observability and
performance
INTEGRATION
AND HARDENING
OBJECTIVEACCEPTANCE GATE
Turn the completed feature set into a production-grade, diagnosable
application.- No critical/high known vulnerability without an
accepted exception.
DELIVERABLES- Payment and storefront isolation security suites are
mandatory CI gates.
- Threat model, dependency remediation, secret scanning and security
headers.
- Structured logs, correlation IDs, metrics, traces and audit retention.
- Readiness reflects dependencies while liveness stays
process-local.
EXCLUDED
- Load, concurrency, failure injection and recovery tests.
- Accessibility, mobile reliability and web performance budgets.
Marketplace-only build program | Internal planning document
No cloud monitoring account or production alert
destination configuration.
Page 13ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
INTEGRATION
AND HARDENING
MR-18 Container and CI release contract
OBJECTIVEACCEPTANCE GATE
Make the Marketplace repository produce deterministic artifacts that
any deployment framework can consume.- Fresh clone to full verify is deterministic.
DELIVERABLES
- Multi-stage Dockerfiles, Compose development stack and production image
contract.
- Immutable image tags/digests, migration command, health checks and
startup contract.
- GitHub CI for workspace guard, tests, builds, database integration, scans and
image publication.
- Production image contains no source-only toolchain or
secrets.
- Deployment requires no provider-specific application
changes.
EXCLUDED
No AWS, OCI, Cloudflare, DNS or production
deployment operation.
- Environment-variable specification and secret-free examples.
MR-19 Marketplace repository release readiness
INTEGRATION
AND HARDENING
OBJECTIVEACCEPTANCE GATE
Certify the repository for handoff to ZolexoraDeployment without
deploying it.- All mandatory suites pass with zero skipped critical
tests.
DELIVERABLES- Every P0/P1 blocker is closed or explicitly accepted by
the owner.
- End-to-end regression across both storefronts, seller, admin, mobile and fake
external providers.
- No cloud resource, DNS record or production secret is
required to verify the repository.
- Database migration, backup/export and isolated restore verification
contracts.EXCLUDED
- Release manifest, dependency inventory, SBOM, runbooks and known-risk
register.Actual staging/production deployment belongs to
ZolexoraDeployment and a later approval.
- Provider-neutral deployment interface for environment, health, migrate,
backup and rollback commands.
Marketplace-only build program | Internal planning document
Page 14ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
MINIMUM DURABLE DOMAINS
Required Marketplace data ownership
DomainAuthoritative recordsMandatory isolation / integrity
Identityusers, sessions, roles, permissions, organizationsActor and organization scope; session
revocation; audit
Storefrontstorefronts, domains, settings, legal mappingImmutable key; exact active domain
ownership
Sellerseller organizations, members, verification, grantsExplicit storefront publishing permission
Catalogmaster products, variants, attributes, categories,
mediaProduct identity separate from offers
Listingsseller/storefront listings, publication lifecycleSeller and storefront ownership
Inventorystock, reservations, adjustments, auditTransactional availability and idempotency
Commercialprice books, tax, promotions, couponsServer-calculated effective rules
Shoppingcarts, wishlists, addresses, checkout quotesSingle storefront per cart/quote
Ordersorders, lines, seller splits, status historyImmutable storefront and monetary
snapshots
Paymentsintents, transactions, webhooks, refundsStorefront-selected merchant account;
deduplication
Fulfillmentshipments, tracking, returns, disputesOrder/storefront/seller ownership
Integrationmappings, outbox, inbox, attempts, dead lettersExternal tenant scope and payload hash
Operationsaudit events, reconciliation, notificationsAttribution, retention and PII controls
Marketplace-only build program | Internal planning document
Page 15ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
EVERY PHASE MUST PROVE ITS BOUNDARY
Verification strategy
LayerRequired evidenceNever acceptable
StaticWorkspace guard, type-check, lint, dependency and secret scansZero-task success or ignored
package
UnitPure business calculations, state machines, validators, mappingsSnapshot-only coverage for
money/security
DatabaseReal PostgreSQL migrations, constraints, concurrency, rollbackSQLite substitution for production
behavior
APIAuthentication, RBAC, storefront isolation, idempotency and
errorsTrusting client totals or headers
as authority
PaymentsSigned webhooks, replay, ordering, refunds and reconciliationLive credentials in test or browser
routing
ContractsShared API parsers and ERP schema/example validationLoose unvalidated dictionaries
Web/mobileCritical workflows for each distinct application identitypassWithNoTests or hidden
manual-only checks
End-to-endTwo independent storefront purchase/refund journeysOne storefront used as a proxy for
both
SecurityCross-role/store attacks, session abuse, secret/log reviewKnown critical issue without
owner/expiry
ReleaseFresh clone, deterministic builds, image and health contractProduction-only manual fixes
Repository-wide release gate
The final root verification must install from the canonical lockfile, confirm the exact workspace package
set, build every applicable app, type-check, lint, run all client and backend tests, validate migrations
against real PostgreSQL, validate Compose, scan secrets/coupling, check broken links/symlinks and pass
git diff --check.
Marketplace-only build program | Internal planning document
Page 16ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
RESOLVE BEFORE THE DEPENDENT PHASE
Decision gates and blockers
GateDecisionRequired beforeCurrent direction
DG-01Canonical Marketplace databaseMR-02PostgreSQL recommended; Oracle Database
retired
DG-02Legal company/GST layoutMR-07 and MR-16One ERP Company with channels or two
Companies remains unresolved
DG-03Payment providers and merchant
accountsMR-09Separate account/config per storefront;
exact providers pending
DG-04Seller commercial modelMR-05/MR-07Commission, settlement, invoice and payout
rules pending
DG-05Shipping provider strategyMR-10Adapter required; provider and SLA pending
DG-06ERP v1 contract adoption and
tenant isolationMR-16 live integrationMarketplace proposal exists; ERP adoption
unverified
DG-07Mahila approved mobile artworkMR-14 releaseCurrent text branding is temporary
DG-08Legacy data migration and
retentionMR-15Must reconcile owners, counts, totals and PII
retention
Stop condition
If a required decision changes legal ownership, payment merchant identity, database authority or data retention, stop
the dependent phase. Do not guess or silently choose a production policy.
Marketplace-only build program | Internal planning document
Page 17ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
APPLIES TO EVERY MR PHASE
Definition of done
AreaPhase completion requirement
ScopeOnly authorized phase work; discoveries outside scope recorded as later actions.
ArchitectureOwnership, trust boundary and failure behavior remain explicit and documented.
ImplementationProduction-style typed code, no placeholder behavior disguised as complete.
SecurityNo secret exposure, privilege widening, client authority or unreviewed destructive operation.
TestsFocused regression and proportionate repository gates pass; no critical skip marker.
DocumentationArchitecture/memory/status/ADR/audit reflect the resulting truth, not intent.
RepositoryNo duplicate file, stale path, extra lockfile, broken symlink or accidental artifact.
GitDiff reviewed, diff-check passes, user changes preserved, no commit/push unless requested.
Remote stateAny remote mutation requires explicit scope and approval; default is none.
ReportVerdict, baseline, files, commands, test counts, blockers, next objective and Git summary.
Required phase report structure
- 1. Verdict: PASS, PASS WITH BLOCKERS or FAIL.
- 2. Starting and ending branch/commit/worktree state.
- 3. Exact scope implemented and explicitly not implemented.
- 4. Files created, changed, moved and retired.
- 5. Commands with exit results and test counts.
- 6. Security, isolation, payment and data-ownership evidence relevant to the phase.
- 7. P0/P1/P2 blockers and decision gates.
- 8. One recommended next phase objective.
- 9. Git diff and remote-mutation confirmation.
Marketplace-only build program | Internal planning document
Page 18ZOLEXORA MARKETPLACE - REPOSITORY ROADMAP
Version 1.0 | 16 July 2026
START SMALL AND KEEP THE BASELINE HONEST
Recommended immediate sequence
OrderActionWhy
1Run MR-00 architecture reset and baseline auditPrevents obsolete Oracle/hostname assumptions from
contaminating later work.
2Review and accept MR-00 reportConfirms exactly what remains, retires and moves to later
phases.
3Run MR-01 canonical contract phaseFreezes boundaries before persistence changes.
4Approve DG-01 PostgreSQL decisionDatabase implementation cannot begin safely without one
authority.
5Run MR-02 onlyBuilds the durable foundation and real migration gate.
Final roadmap principle
Complete one trustworthy layer before building the next. The fastest route to a finished Marketplace is a sequence of
small, evidence-backed phases with explicit exclusions - not parallel feature growth on uncertain foundations.
Canonical Marketplace admin hostname
admin.marketplace.zolexora.com
End of roadmap | Version 1.0 | 16 July 2026
Marketplace-only build program | Internal planning document
Page 19 You are the principal product engineer, software architect, security engineer, database engineer, test engineer, and repository maintainer responsible for completing the ZolexoraMarketplace repository.

Your job is to execute the remaining Marketplace roadmap as a controlled autonomous loop, beginning with MR-05 and continuing sequentially through MR-19.

Do not wait for the user to type “next” after every successful phase.

However, do not bypass acceptance gates, invent business policies, silently broaden scope, or claim incomplete work as complete.

======================================================================

1. REPOSITORY AND CURRENT STATE
   ======================================================================

Expected Marketplace repository:

/data/projects/development/Zolexora/ZolexoraMarketplace

The repository name is:

ZolexoraMarketplace

Before doing anything:

1. Run `pwd`.
2. Confirm the repository root using:

   * `git rev-parse --show-toplevel`
   * `git status --short --branch`
   * `git rev-parse HEAD`
   * `git remote -v`
3. Confirm that the repository is ZolexoraMarketplace and not:

   * ZolexoraDeployment
   * ZolexoraERP
   * DNP_TMS_Lite
   * another sibling repository
4. Do not modify any sibling repository.
5. Record all pre-existing modified, staged, deleted, renamed, and untracked files.
6. Preserve all user-created changes.
7. Never discard, reset, overwrite, clean, stash, or revert user work without explicit authorization.

Latest confirmed project state from the user:

* MR-00 through MR-04 have been completed.
* MR-04 was “Persisted storefront and domain isolation.”
* MR-04 introduced PostgreSQL storefront persistence, explicit domains, origin constraints, a `PostgresStorefrontRepository`, trusted-proxy configuration, and storefront isolation across persisted resources.
* The latest MR-04 work intentionally did not introduce MR-05 seller organizations or seller grants.
* Therefore, the next intended phase is MR-05.

Treat MR-00 through MR-04 as completed unless repository evidence clearly contradicts that status.

Do not blindly reimplement MR-00 through MR-04.

Before starting MR-05, perform a bounded baseline reconciliation:

* Locate the MR-00 through MR-04 reports, ADRs, migrations, tests, and status evidence.
* Verify that the current code still satisfies the latest accepted baseline.
* Run the relevant existing regression suites.
* Check for incomplete, duplicated, placeholder, or contradictory implementations.
* If a small regression prevents MR-05, repair it as a clearly reported prerequisite correction.
* Do not redesign or repeat previous phases merely because the code is organized differently than expected.
* If the repository shows that MR-04 is materially incomplete, stop with an evidence-backed discrepancy report rather than silently redefining the project history.

======================================================================
2. PRIMARY MISSION
==================

Complete the remaining Marketplace roadmap:

MR-05 through MR-19.

Execute one bounded phase at a time.

For every phase:

1. Inspect.
2. Classify existing implementation.
3. Identify gaps.
4. Implement only the authorized phase.
5. Add or repair tests.
6. Run proportionate repository verification.
7. Update durable documentation and phase evidence.
8. Produce the complete phase report.
9. Determine the phase verdict.
10. Continue automatically to the next phase only when the current phase is genuinely PASS and no required decision gate is unresolved.

The project is complete only when MR-19 passes its release-readiness gate.

======================================================================
3. MARKETPLACE PRODUCT BOUNDARY
===============================

This loop controls only the ZolexoraMarketplace repository.

In scope:

* Zolexora Shop buyer web application
* Zolexora Shop buyer mobile application
* Mahila Madel buyer web application
* Mahila Madel buyer mobile application
* Shared seller web portal
* Shared seller mobile application
* Marketplace Admin web application
* Shared FastAPI Marketplace backend
* PostgreSQL Marketplace persistence
* Shared API and configuration packages
* Provider-neutral payment adapters
* Provider-neutral shipping adapters
* Provider-neutral object-storage adapters
* Provider-neutral notification adapters
* Provider-neutral search contracts
* Independent ERP API and event boundary
* Local and test containers
* Product-local Nginx templates
* Repository CI and release artifacts
* Tests, migrations, ADRs, runbooks and audit evidence

Outside scope:

* AWS resource provisioning
* OCI resource provisioning
* Cloudflare account configuration
* DNS mutations
* Production deployment
* ZolexoraDeployment implementation
* Zolexora ERP product changes
* ERPNext or Frappe source modifications
* AI product work
* Live merchant credentials
* Live financial transactions
* Production customer-data migration
* App Store or Play Store publishing
* Production secrets
* Production infrastructure monitoring destinations
* Changes to sibling repositories

The Marketplace repository may define a provider-neutral runtime contract, but it must not provision a cloud provider.

======================================================================
4. CANONICAL PRODUCT IDENTITIES
===============================

Canonical public surfaces:

* Shared Marketplace API:
  api.zolexora.com

* Zolexora Shop:
  shop.zolexora.com

* Mahila Madel:
  mahilamadel.store

* Approved Mahila alias:
  [www.mahilamadel.store](http://www.mahilamadel.store)

* Seller Portal:
  seller.zolexora.com

* Marketplace Admin:
  admin.marketplace.zolexora.com

The old hostname:

marketplaceadmin.zolexora.com

is retired from active configuration.

It may remain only in clearly labelled historical evidence, migration notes, or compatibility documentation.

Do not leave it active in:

* environment examples
* frontend runtime configuration
* CORS configuration
* host allowlists
* Nginx templates
* application constants
* API documentation
* deployment examples
* current runbooks

======================================================================
5. CANONICAL ARCHITECTURE
=========================

Preserve these architectural rules.

A. Modular core

Use a well-bounded FastAPI modular monolith.

Do not split the backend into microservices merely for appearance.

Extract a service only when there is real operational evidence that independent deployment, scaling, ownership, or failure isolation is required.

B. Canonical database

PostgreSQL is the canonical Marketplace database.

No active Marketplace domain may have multiple undefined authoritative writers.

Oracle Database and OCI Autonomous Database are not active Marketplace application targets.

MongoDB, Supabase and legacy persistence may exist only as:

* historical code
* isolated compatibility adapters
* migration sources
* migration tooling
* explicitly retired modules

They must not silently remain authoritative alongside PostgreSQL.

C. Storefront ownership

Every storefront-sensitive record must have explicit ownership.

This includes:

* seller storefront grants
* listings
* price books
* prices
* inventory
* reservations
* promotions
* coupons
* carts
* wishlists
* checkout quotes
* orders
* order lines
* payments
* webhooks
* refunds
* shipments
* returns
* disputes
* analytics events
* integration events

Storefront ownership must not be inferred from untrusted browser input.

D. Backend authority

The backend is authoritative for:

* storefront identity
* product/listing availability
* price
* discount
* tax
* shipping cost
* inventory availability
* checkout totals
* payment provider selection
* merchant-account selection
* order state
* refund eligibility
* permissions

Clients may request an operation, but they may not authoritatively determine its commercial result.

E. Payment boundary

Zolexora Shop and Mahila Madel use separate payment gateway accounts or configurations.

The backend selects the payment configuration from trusted persisted storefront ownership.

Browser and mobile clients must never:

* select the merchant account
* override the merchant account
* send private provider configuration
* receive private provider credentials
* decide which storefront account processes the payment

F. ERP independence

Zolexora ERP is a separate product and company offering.

The Marketplace is one ERP customer.

The systems must keep separate:

* repositories
* databases
* identities
* administrator models
* secrets
* deployments
* backups
* failure domains

Only versioned APIs, signed webhooks, and versioned event contracts may connect them.

No direct access to:

* ERPNext source code
* Frappe internals
* ERP MariaDB
* ERP database tables
* ERP filesystem
* ERP session database

G. Portable runtime

The Marketplace repository must produce deterministic, provider-neutral artifacts.

Cloud-specific deployment remains the responsibility of ZolexoraDeployment.

======================================================================
6. CANONICAL REPOSITORY ORGANIZATION
====================================

Respect the existing repository where it already represents the same ownership model.

The intended product organization is:

ZolexoraMarketplace/
├── apps/
│   ├── storefronts/
│   │   ├── zolexora-shop/
│   │   │   ├── web/
│   │   │   └── mobile/
│   │   └── mahila-madel/
│   │       ├── web/
│   │       ├── mobile/
│   │       └── legacy-server/
│   └── portals/
│       ├── seller/
│       │   ├── web/
│       │   └── mobile/
│       └── marketplace-admin/
│           └── web/
├── services/
│   └── marketplace-api/
│       ├── app/
│       ├── integrations/
│       ├── migrations/
│       └── tests/
├── packages/
│   ├── shared-api/
│   └── shared-config/
├── contracts/
│   └── zolexora-erp/
│       └── v1/
├── infrastructure/
│   ├── docker/
│   └── nginx/
├── scripts/
├── project/
│   ├── docs/
│   │   ├── decisions/
│   │   └── runbooks/
│   └── status/
│       └── audits/
├── .github/
│   └── workflows/
├── AGENTS.md
├── pnpm-workspace.yaml
└── pnpm-lock.yaml

Organization rules:

* Do not create duplicate directories merely to match this display.
* Reuse existing equivalent directories.
* Do not create a shared package until at least two real consumers prove the abstraction.
* Application packages own UI composition.
* Shared packages own stable contracts and stable configuration.
* Shared packages must not own application databases.
* FastAPI domain modules own business rules.
* API routers remain thin.
* Services coordinate use cases.
* Repositories own persistence operations.
* Legacy code stays isolated.
* New modules must not depend on the Mahila legacy server.
* Keep one JavaScript package-manager lockfile at repository root.
* Do not create local lockfiles inside applications.
* Do not create duplicate utilities, validators, schemas, adapters or repositories.
* Inspect existing implementations before adding a new file.
* Follow existing naming and layout when it is sound.

======================================================================
7. LINE-BY-LINE INSPECTION RULE
===============================

Before editing any phase:

1. Inventory the files relevant to that phase.
2. Read every relevant implementation file completely.
3. Read related tests completely.
4. Read related schemas, migrations, contracts and configuration completely.
5. Search for all call sites before changing a public interface.
6. Search for duplicates and parallel implementations.
7. Search for TODO, FIXME, placeholder, mock-only, temporary and pass-through behavior.
8. Search for legacy ownership that conflicts with the canonical architecture.
9. Search for cross-store access paths.
10. Search for client-authoritative money, tax, inventory, permissions or payment routing.
11. Search for skipped tests and false-green scripts.
12. Search for active Oracle, OCI, MongoDB and Supabase runtime assumptions.
13. Search for the retired admin hostname.
14. Search for browser `localStorage` bearer-token use.
15. Search for secrets, OTPs, tokens and payment data in logging.

Do not perform blind global rewrites.

Do not replace a complete working module with a newly invented version without first proving why the existing module cannot be safely extended.

======================================================================
8. PRODUCTION-QUALITY IMPLEMENTATION RULES
==========================================

All implementation must be production-style.

Required:

* typed code
* explicit domain models
* explicit state transitions
* validated request and response schemas
* database constraints
* database indexes justified by access patterns
* transaction boundaries
* idempotency
* audit attribution
* immutable historical snapshots where required
* consistent error envelopes
* pagination for collections
* secure defaults
* fail-closed authorization
* structured logging
* deterministic tests
* migration rollback reasoning
* explicit clock/timezone handling
* integer minor monetary units or an equally safe decimal model
* no floating-point money calculations
* concurrency-safe inventory and payment behavior
* safe retry behavior
* provider-neutral ports and adapters

Forbidden:

* baby code
* demonstration-only implementations represented as complete
* placeholder functions returning success
* fake persistence represented as production persistence
* route-level business logic when a domain/service boundary exists
* trusting client totals
* trusting a client-supplied storefront key as authority
* browser-selected merchant accounts
* hidden global storefront defaults
* global seller publishing permission
* generic dictionaries where versioned contracts are required
* silent exception swallowing
* pass-with-no-tests scripts
* skipped critical security tests
* production credentials in tests
* source-specific cloud coupling in domain code
* duplicate authoritative data stores
* undocumented destructive migration
* destructive Git commands

======================================================================
9. EXECUTION LOOP
=================

Run the following loop.

PHASE_QUEUE = [
MR-05,
MR-06,
MR-07,
MR-08,
MR-09,
MR-10,
MR-11,
MR-12,
MR-13,
MR-14,
MR-15,
MR-16,
MR-17,
MR-18,
MR-19
]

For each phase:

STEP 1 — Establish the phase baseline

* Record branch.
* Record HEAD commit.
* Record upstream relationship.
* Record worktree status.
* Record existing user changes.
* Locate previous phase reports.
* Locate existing code already related to the phase.
* Identify whether the phase is:

  * not started
  * partially implemented
  * implemented but unverified
  * implemented with defects
  * already complete
* Never decide completion from filenames alone.

STEP 2 — Check decision gates

Review all decision gates that apply to the phase.

Classify each gate as:

* resolved by existing accepted repository documentation
* safely implementable through a provider-neutral abstraction
* non-blocking for fake/local execution
* unresolved and blocking production policy

Continue only when the phase can be implemented without guessing a production policy.

STEP 3 — Write the bounded implementation plan

Before editing, produce a concise internal phase plan containing:

* objective
* current evidence
* gaps
* files expected to change
* migrations expected
* tests expected
* explicit exclusions
* applicable decision gates
* rollback risks

Do not expand into later phases.

STEP 4 — Implement

Implement only the current phase.

Refactor earlier code only when necessary to satisfy the current phase safely.

Record unrelated discoveries in the phase report as later work.

Do not implement a later phase early merely because it appears convenient.

STEP 5 — Test continuously

Run focused tests during development.

After focused tests pass, run proportionate repository gates.

Do not postpone all testing until the end.

STEP 6 — Audit the phase boundary

After implementation, inspect:

* authorization
* storefront isolation
* seller organization isolation
* monetary integrity
* transaction behavior
* concurrency behavior
* idempotency
* audit attribution
* secret exposure
* log exposure
* migration correctness
* compatibility impact
* legacy-code coupling
* provider-specific coupling

STEP 7 — Update durable evidence

Update the existing ADR, decision, runbook, migration notes and phase-audit locations.

Do not create duplicate documentation paths.

Documentation must describe resulting truth, not intended future work.

STEP 8 — Run the phase acceptance gate

A phase cannot PASS unless its required behavior is implemented and tests demonstrate it.

Classify the verdict:

* PASS
* PASS WITH BLOCKERS
* FAIL

PASS WITH BLOCKERS does not authorize the next dependent phase when the blocker affects that phase.

STEP 9 — Produce the full phase report

Use the mandatory report structure defined later in this prompt.

STEP 10 — Continue or stop

Continue automatically to the next phase only when:

* the current phase is PASS
* required tests pass
* no relevant P0 or P1 blocker remains
* no dependent decision gate is unresolved
* no repository discrepancy makes later work unsafe
* scope has not drifted
* user changes remain preserved

Stop when:

* a legal, GST, merchant, settlement, payout, retention or ownership decision is required
* live credentials would be required
* destructive data migration would be required
* a sibling repository must be modified
* repository evidence contradicts the accepted baseline
* a P0/P1 blocker cannot be repaired inside the current phase
* continuing would require guessing business policy
* continuing would weaken security or isolation

When stopped, provide one precise blocker report containing:

* exact blocker
* why it blocks
* affected phase
* evidence
* options that are actually supported by the repository
* exact decision needed
* safe work completed before stopping

Do not ask broad questions that can be answered through repository inspection.

======================================================================
10. MR-05 — SELLER ORGANIZATIONS AND STOREFRONT GRANTS
======================================================

Objective:

Create a shared seller organization model while preserving explicit storefront publishing permission.

Required implementation:

* seller organizations
* organization status
* seller organization members
* member roles
* role permissions
* verification status
* verification history
* onboarding state
* document metadata boundary
* storefront publishing grants
* grant lifecycle
* grant approver
* grant reason
* grant effective time
* grant revocation
* suspension controls
* admin approval controls
* complete audit history

Mandatory behavior:

* A seller may belong to an organization.
* A seller organization may have multiple members.
* Membership does not automatically grant storefront publishing access.
* Storefront grants are explicit.
* A seller cannot publish to an ungranted storefront.
* Grant creation, approval, suspension, revocation and restoration are audited.
* Suspension immediately blocks new writes.
* Suspension must not corrupt, delete or rewrite historical orders.
* Admin mutations require permission and attribution.
* No hidden “all storefronts” default exists.
* No seller client has a fixed buyer storefront identity.

Database requirements:

* enforce organization ownership
* enforce valid member relationships
* enforce grant uniqueness/lifecycle rules
* index authorization lookup paths
* preserve immutable audit events
* prevent duplicate active grants where inappropriate

Tests:

* seller with no grant cannot publish
* Zolexora-only seller cannot publish to Mahila Madel
* Mahila-only seller cannot publish to Zolexora Shop
* revoked grant fails immediately
* suspended organization cannot mutate
* historical records remain readable as authorized
* cross-organization access fails closed
* unauthorized admin cannot approve grants
* all grant changes are attributable
* concurrent duplicate grant attempts are safe

Decision gate:

DG-04 seller commercial model.

Do not implement settlement, payout or commission accounting in MR-05.

If commission or settlement policy is unresolved, model only the neutral seller organization and grant boundary required by this phase.

Acceptance gate:

* seller publishing is impossible without an active explicit storefront grant
* suspension blocks writes without damaging history
* grant changes are fully audited

======================================================================
11. MR-06 — MASTER CATALOG, LISTINGS AND MEDIA
==============================================

Objective:

Separate reusable product identity from seller/storefront-specific offers.

Required implementation:

* master products
* categories
* brands
* attributes
* attribute values
* product variants
* tax classification reference
* product lifecycle
* seller/storefront listings
* listing lifecycle
* listing content
* publication state
* seller ownership
* storefront ownership
* price-reference boundary
* media metadata
* media ownership
* media upload authorization
* media validation
* S3-compatible object-storage port
* local/fake object-storage adapter for testing
* search-indexing contract without vendor coupling

Mandatory behavior:

* master product identity is separate from a listing
* one product can have independent listings across storefronts
* one seller can have multiple listings only where grants allow
* unpublished listings never appear in buyer APIs
* cross-store listings never leak
* disabled/suspended seller state affects publication safely
* media upload requires ownership and authorization
* media file type, size and metadata are validated
* storage implementation is behind a provider-neutral adapter
* new shared abstractions require multiple real consumers

Tests:

* one master product with separate Zolexora and Mahila listings
* different storefront content and publication states
* unpublished listing excluded
* cross-store query excluded
* seller without grant cannot create listing
* unauthorized seller cannot mutate another seller’s listing
* invalid media rejected
* oversized media rejected
* forged media ownership rejected
* search contract validates normalized documents
* legacy Mahila server is not imported by new catalog modules

Excluded:

* recommendation engine
* reels
* generative AI
* inventory implementation
* final pricing calculation

Acceptance gate:

* independent listings work across storefronts
* unpublished and cross-store listings never leak
* media authorization and validation tests pass

======================================================================
12. MR-07 — INVENTORY, PRICING, TAX AND PROMOTIONS
==================================================

Objective:

Make every sellable offer deterministic and server-calculated.

Required implementation:

Inventory:

* inventory sources
* stock records
* reservations
* releases
* adjustments
* reservation expiry
* audit history
* idempotent inventory commands
* transactional availability calculations

Pricing:

* storefront price books
* listing prices
* effective periods
* compare-at prices
* currency validation
* price selection rules
* immutable price snapshots for later quotes/orders

Tax:

* provider-neutral tax-policy boundary
* tax classification mapping
* legal-company mapping hook
* deterministic tax calculation interface
* no hard-coded unresolved production GST policy

Promotions:

* promotion definitions
* eligibility rules
* coupons
* usage limits
* stacking rules
* budget limits
* effective periods
* storefront ownership
* concurrency-safe redemption

Mandatory behavior:

* inventory cannot become negative
* available inventory reflects active reservations
* overselling is prevented transactionally
* expired reservations release safely
* client-provided prices are ignored
* client-provided discounts are ignored
* client-provided taxes are ignored
* currency mismatch fails
* promotions are storefront-scoped
* coupon usage is concurrency-safe
* effective-date rules use explicit timezone handling

Decision gates:

DG-02 legal-company/GST layout.

DG-04 seller commercial model.

Do not guess:

* whether there is one ERP company with channels
* whether there are two ERP companies
* GST registration ownership
* commission model
* settlement model
* seller invoice model
* payout model

Implement provider-neutral mapping hooks where production policy remains unresolved.

Stop only when the unresolved decision is required to make current calculations legally or commercially authoritative.

Tests:

* concurrent stock reservation
* overselling prevention
* reservation expiry
* idempotent release
* adjustment audit
* cross-store inventory isolation
* price effective periods
* currency rejection
* ignored client totals
* promotion eligibility
* coupon concurrency
* promotion budget exhaustion
* stacking rules
* cross-store coupon rejection
* deterministic tax-policy adapter tests

Acceptance gate:

* negative availability and overselling are prevented
* client commercial values are ignored
* promotion concurrency and storefront isolation pass

======================================================================
13. MR-08 — CART, WISHLIST AND CHECKOUT QUOTATION
=================================================

Objective:

Build storefront-scoped shopping state and trustworthy server-side checkout quotations.

Required implementation:

* carts
* cart items
* wishlists
* wishlist items
* customer addresses
* shipping selections
* guest cart identity boundary
* authenticated cart identity
* guest-to-account merge rules
* checkout quote
* quote lines
* price snapshot
* promotion snapshot
* tax snapshot
* shipping snapshot
* inventory snapshot/reference
* quote expiry
* quote signature or server-side reference
* stale-quote detection
* concurrency handling

Mandatory behavior:

* one cart belongs to one storefront
* a cart cannot mix storefronts
* listings must be active and visible in that storefront
* server recalculates every cart and quote total
* quote totals are reproducible
* client totals are ignored
* quote expiry is enforced
* stale inventory invalidates or requotes safely
* stale pricing invalidates or requotes safely
* stale promotion rules invalidate or requote safely
* address access is actor-scoped
* guest cart merge cannot cross storefronts

Tests:

* Zolexora and Mahila carts remain isolated
* cross-store item rejected
* unpublished listing rejected
* forged price ignored
* forged tax ignored
* forged discount ignored
* expired quote rejected
* stale inventory rejected
* stale price rejected
* duplicate quote command idempotent
* guest merge rules
* concurrent item updates
* address ownership enforcement

Excluded:

* payment-provider call
* final order creation

Acceptance gate:

* no cart can mix storefronts
* totals are reproducible and backend-authoritative
* expired or stale conditions fail safely

======================================================================
14. MR-09 — SEPARATE PAYMENT GATEWAYS AND PAYMENT LEDGER
========================================================

Objective:

Route payments exclusively through trusted storefront configuration using separate merchant accounts.

Required implementation:

* provider-neutral payment port
* normalized payment state machine
* storefront payment configuration
* private merchant-account reference
* backend-created payment intent/order
* payment transaction ledger
* raw webhook body verification
* webhook signature verification
* webhook receipt persistence
* webhook deduplication
* event ordering handling
* replay protection
* capture lifecycle
* failure lifecycle
* timeout lifecycle
* retry lifecycle
* refund lifecycle
* reconciliation records
* fake payment providers for tests
* secure configuration boundary

Mandatory behavior:

* Zolexora Shop and Mahila Madel have separate payment configurations
* payment routing comes from persisted order/quote storefront ownership
* clients cannot select providers or merchant accounts
* public APIs expose no private merchant configuration
* logs expose no private configuration
* webhooks are verified using raw request bodies
* duplicate webhook delivery is idempotent
* out-of-order events are handled deterministically
* forged webhooks are rejected
* replayed webhooks are rejected or safely deduplicated
* payment transitions are explicit and validated
* refunds are recorded in the ledger
* retries cannot duplicate capture/refund

Decision gate:

DG-03 payment providers and merchant accounts.

Production provider names and credentials may remain unresolved.

Implement:

* separate provider-neutral storefront configurations
* fake adapters
* normalized provider identifiers
* secret references

Do not add:

* production credentials
* live financial calls
* browser merchant configuration
* hard-coded global merchant account

Tests:

* different fake merchant accounts by storefront
* browser override rejected
* forged account reference rejected
* signed webhook accepted
* bad signature rejected
* duplicate webhook safe
* out-of-order webhook safe
* repeated create intent idempotent
* duplicate capture prevented
* duplicate refund prevented
* secrets absent from API
* secrets absent from logs
* cross-store payment access rejected

Acceptance gate:

* client cannot choose merchant account/provider
* replay, duplication, forgery and ordering tests pass
* no secret configuration appears publicly

======================================================================
15. MR-10 — ORDERS, FULFILLMENT, SHIPPING, RETURNS AND REFUNDS
==============================================================

Objective:

Create immutable commercial records and complete the post-payment lifecycle.

Required implementation:

Orders:

* orders
* immutable origin storefront
* order lines
* immutable product/listing descriptions
* immutable monetary snapshots
* seller splits
* order state history
* idempotent order commands
* payment/order consistency rules

Inventory:

* reservation commit
* reservation release
* cancellation behavior
* consistency recovery

Fulfillment:

* fulfillment records
* shipments
* shipment lines
* tracking events
* partial fulfillment
* delivery events
* provider-neutral shipping adapter

Returns and disputes:

* cancellation workflow
* return request
* return authorization
* received/inspected state
* refund calculation
* partial return
* partial refund
* dispute workflow
* reason and audit history

Mandatory behavior:

* order origin storefront never changes
* historical monetary snapshots never change
* seller splits are preserved
* partial fulfillment reconciles
* partial refunds reconcile
* retries do not duplicate orders, shipments, cancellations or refunds
* authorization is actor-, organization-, seller- and storefront-aware
* order/payment/inventory transitions are consistent
* shipping provider details are behind an adapter

Decision gate:

DG-05 shipping provider strategy.

A specific production provider is not required.

Implement a provider-neutral adapter and fake shipping provider.

Do not implement seller payout or ERP accounting submission.

Tests:

* immutable origin storefront
* immutable money snapshots
* order idempotency
* payment/order consistency
* inventory commit/release
* partial shipment
* partial cancellation
* partial return
* partial refund
* duplicate refund prevention
* cross-store order rejection
* seller sees only authorized order lines
* buyer sees only own orders
* unauthorized admin action rejected
* fake shipping adapter contract

Acceptance gate:

* origin storefront and historical money cannot change
* partial fulfillment/refunds reconcile
* duplicate commands remain idempotent

======================================================================
16. MR-11 — SELLER PORTAL COMPLETION
====================================

Objective:

Connect seller web and mobile applications to real shared Marketplace workflows.

Required workflows:

* onboarding
* organization profile
* organization members
* member roles
* storefront grants
* verification state
* master catalog access
* listing creation/editing
* listing publication
* media management
* inventory
* pricing
* orders
* fulfillment
* returns
* seller analytics
* permission-aware navigation
* consistent API errors
* secure session handling

Mandatory behavior:

* no seller client has a fixed buyer storefront key
* seller scope comes from authenticated server-authorized grants
* every mutation is authorized server-side
* hidden navigation is not considered authorization
* mobile and web use shared stable contracts
* do not duplicate business rules in clients
* no localStorage bearer tokens
* error handling uses canonical API envelopes

Required package gates:

* lint
* type-check
* unit tests
* critical workflow tests
* production build
* mobile release-build validation where locally possible

Tests:

* grant-aware navigation
* server rejection despite manually forced UI route
* cross-seller access rejection
* cross-store publication rejection
* order and return authorization
* session expiry
* API error rendering
* web critical path
* mobile critical path

Excluded:

* buyer storefront redesign

Acceptance gate:

* no fixed customer storefront identity exists in seller clients
* every action is server-authorized
* seller web and mobile critical paths pass

======================================================================
17. MR-12 — MARKETPLACE ADMIN COMPLETION
========================================

Objective:

Complete the shared operational control plane at:

admin.marketplace.zolexora.com

Required areas:

* storefront administration
* storefront-domain administration
* seller organizations
* seller members
* seller grants
* verification
* catalog
* listings
* media review
* inventory operations
* price visibility
* promotions
* orders
* shipments
* returns
* refunds
* payment visibility
* webhook-failure queue
* reconciliation queue
* integration-issue queue
* audit log
* reason-required mutations
* confirmation for high-risk actions

Mandatory behavior:

* no hidden cross-store default
* admin scope is explicit
* privileged actions require permissions
* all mutations are attributable
* high-risk actions require confirmation
* sensitive payment secrets are never exposed
* the retired hostname is absent from active code
* admin is not an infrastructure-management portal
* admin is not an ERP Desk replacement

Tests:

* role and permission matrix
* explicit storefront scope
* no cross-store default
* reason-required mutations
* audit attribution
* secret redaction
* high-risk confirmation
* unauthorized admin rejection
* retired hostname search
* operational-queue workflows

Acceptance gate:

* retired hostname absent from active code
* admin actions are permissioned and audited
* no hidden cross-store default exists

======================================================================
18. MR-13 — STOREFRONT WEB COMPLETION
=====================================

Objective:

Complete both buyer web experiences on one shared commerce platform while preserving distinct brands.

Required for both:

* catalog browsing
* category browsing
* search
* product detail
* variant selection
* wishlist
* cart
* address management
* checkout quotation
* fake-provider payment journey
* order confirmation
* account
* order history
* order detail
* cancellation/return initiation
* session handling
* error and empty states

Distinct identity requirements:

* Zolexora Shop remains Zolexora Shop
* Mahila Madel remains Mahila Madel
* branding and theme configuration remain separate
* SEO metadata remains storefront-specific
* canonical URLs remain storefront-specific
* analytics configuration remains storefront-specific
* cache keys include storefront identity
* state persistence includes storefront identity

Shared behavior requirements:

* share stable accessible primitives only where behavior is genuinely common
* do not force identical visual branding
* do not duplicate server business logic
* both use the Marketplace API

SEO and performance:

* canonical metadata
* structured data
* accessibility gates
* performance budgets
* documented browser support
* cache isolation
* no cross-store state leakage

Tests:

* independent Zolexora purchase journey
* independent Mahila purchase journey
* fake-provider payment
* order history
* return initiation
* cross-store cache isolation
* cross-store local-state isolation
* canonical URL checks
* accessibility checks
* build and type-check for both apps

Excluded:

* Mahila legacy-server retirement until parity is proven

Acceptance gate:

* both storefronts pass independent end-to-end purchase journeys
* cross-store cache/state leakage tests pass
* accessibility and performance gates are enforced

======================================================================
19. MR-14 — BUYER MOBILE APPLICATIONS
=====================================

Objective:

Bring both independently branded buyer mobile applications to feature and security parity.

Required:

* Zolexora Shop mobile identity
* Mahila Madel mobile identity
* compiled storefront identity
* Marketplace API integration
* secure session storage
* deep-link handling
* checkout handoff
* payment result handling
* notification contracts
* catalog
* product detail
* wishlist
* cart
* quote
* checkout
* account
* order history
* order detail
* returns
* approved icons/splash/store metadata where available
* Android build verification

Mandatory behavior:

* caller cannot override compiled storefront identity
* payment merchant configuration is absent from app bundles
* private secrets are absent from app bundles
* deep links cannot switch storefront identity incorrectly
* session storage uses platform-secure facilities
* storefront-specific build configuration is deterministic

Decision gate:

DG-07 approved Mahila mobile artwork.

Temporary text branding may be retained only when clearly documented.

Do not claim final artwork completion when approved assets are missing.

Do not publish to an app store.

Tests:

* compiled storefront identity
* attempted runtime override rejected
* deep-link routing
* secure session storage abstraction
* no merchant config in bundles
* no secrets in bundles
* unit tests
* critical-flow tests
* Android build for both identities

Acceptance gate:

* storefront identity cannot be overridden
* no payment merchant configuration exists in bundles
* both release builds and deep links pass

======================================================================
20. MR-15 — MAHILA LEGACY SERVER RETIREMENT
===========================================

Objective:

Remove duplicate Express/Mongoose commerce ownership after proven functional and data parity.

Do not begin destructive retirement merely because the new UI works.

Required:

* inventory every legacy endpoint
* map every endpoint to Marketplace API behavior
* map legacy models to canonical PostgreSQL models
* map users and ownership
* map products
* map listings
* map inventory
* map orders
* map payments where permitted
* map media references
* identify retained historical data
* migration dry-run
* migration validation
* retry behavior
* reconciliation reports
* count reconciliation
* monetary-total reconciliation
* ownership reconciliation
* PII retention handling
* cutover runbook
* rollback runbook
* disable legacy runtime before code removal
* remove dependencies/vulnerabilities after parity

Decision gate:

DG-08 legacy data migration and retention.

Stop before destructive migration or deletion when retention policy is unresolved.

No production migration is authorized.

Safe work may include:

* migration tooling
* dry-run mode
* fixtures
* validation
* fake/local source datasets
* reconciliation reports
* cutover documentation

Mandatory behavior:

* all Mahila web/mobile production code paths target Marketplace API
* legacy server is not an active writer
* code removal happens only after runtime disablement and parity evidence
* data is not silently discarded
* counts, totals and ownership reconcile

Tests:

* endpoint parity matrix
* model mapping validation
* dry-run migration
* retry idempotency
* invalid record reporting
* count reconciliation
* monetary reconciliation
* ownership reconciliation
* legacy dependency absence from active clients
* rollback-runbook validation where automatable

Acceptance gate:

* all Mahila application paths use Marketplace API
* migration counts, totals and ownership reconcile
* legacy runtime is disabled before removal

======================================================================
21. MR-16 — INDEPENDENT ERP INTEGRATION
=======================================

Objective:

Implement the Marketplace side of the generic ERP customer contract without repository or database coupling.

Required:

* versioned ERP contracts
* schema validation
* transactional outbox
* outbox messages
* delivery attempts
* retry schedule
* dead-letter state
* inbox
* inbound deduplication
* payload hashes
* replay handling
* reconciliation persistence
* tenant mapping
* organization mapping
* channel/storefront mapping
* signed webhook receiver
* idempotent ERP client
* background worker
* failure isolation
* circuit/retry behavior
* fake ERP adapter

Synchronization domains:

* inventory
* orders
* deliveries
* invoices
* payments
* refunds

Mandatory behavior:

* Marketplace checkout remains operational during ERP outage
* no direct Frappe dependency
* no direct ERPNext dependency
* no direct MariaDB dependency
* no source-code dependency
* no shared database
* no shared administrator identity
* failed deliveries are persisted
* retries are bounded and observable
* inbound messages are idempotent
* payload versions are explicit

Decision gates:

DG-02 legal-company/GST layout.

DG-06 ERP v1 adoption and tenant isolation.

Do not perform live ERP calls until:

* ERP adopts the contract
* tenant isolation is verified
* legal/GST mapping is approved
* credentials are separately authorized

Implement and test the Marketplace side with fake adapters and versioned contracts.

Tests:

* outbox atomicity
* retry
* replay
* duplicate inbox event
* dead-letter
* reconciliation
* payload-hash mismatch
* signed webhook verification
* ERP outage
* Marketplace checkout during ERP outage
* tenant mapping isolation
* contract schema/example validation

Acceptance gate:

* checkout remains available during ERP outage
* no direct ERP technology coupling
* replay/retry/dead-letter/reconciliation tests pass

======================================================================
22. MR-17 — SECURITY, QUALITY, OBSERVABILITY AND PERFORMANCE
============================================================

Objective:

Harden the complete feature set into a production-grade, diagnosable application.

Required security work:

* repository threat model
* trust-boundary documentation
* dependency audit
* vulnerability remediation
* accepted-exception process
* secret scanning
* security headers
* session-abuse tests
* cross-role attack tests
* cross-store attack tests
* payment attack tests
* webhook attack tests
* rate limiting
* abuse protection
* sensitive-log review
* PII controls
* audit retention

Required observability:

* structured logs
* correlation IDs
* request IDs
* trace context
* metrics
* traces
* audit-event retention
* payment reconciliation visibility
* integration queue visibility
* dependency readiness
* process-local liveness

Required performance and reliability:

* load tests
* concurrency tests
* failure injection
* recovery tests
* database pool validation
* slow-query inspection
* API performance budgets
* web performance budgets
* mobile reliability gates
* accessibility gates

Mandatory behavior:

* liveness remains process-local
* readiness reflects required dependencies
* logs never reveal secrets
* payment and storefront-isolation suites are mandatory CI gates
* no critical/high vulnerability remains without documented owner, reason and expiry

Do not configure a production monitoring account or alert destination.

Tests:

* authentication abuse
* session revocation
* privilege escalation
* cross-role access
* cross-store access
* webhook forgery/replay
* payment routing isolation
* rate-limit behavior
* secret/log scans
* load/concurrency
* dependency failure
* recovery
* liveness/readiness semantics

Acceptance gate:

* no unaccepted critical/high vulnerability
* payment and storefront suites are mandatory
* readiness/liveness semantics are correct

======================================================================
23. MR-18 — CONTAINER AND CI RELEASE CONTRACT
=============================================

Objective:

Produce deterministic Marketplace artifacts consumable by any deployment framework.

Required:

* multi-stage Dockerfiles
* production API image
* applicable web build/runtime images
* mobile build contract where appropriate
* local Compose development stack
* production image contract
* migration command
* startup contract
* health checks
* non-root runtime where feasible
* minimal production images
* immutable tagging/digest contract
* environment-variable specification
* secret-free examples
* GitHub Actions workflows
* workspace guard
* lint
* type-check
* client tests
* backend tests
* real PostgreSQL integration
* migration validation
* security scans
* secret scans
* image build
* image publication contract
* SBOM generation where supported

Mandatory behavior:

* fresh clone verification is deterministic
* canonical root lockfile is used
* production images contain no secrets
* production images exclude source-only tooling where possible
* no provider-specific application changes are required
* no AWS/OCI/Cloudflare deployment occurs
* Compose configuration validates
* migration and startup order are explicit
* health checks are real

Tests:

* clean dependency installation
* exact workspace package set
* every applicable build
* Docker build
* Compose config
* database migration from empty to head
* second no-op migration
* health checks
* image secret scan
* image content inspection
* deterministic verification script

Acceptance gate:

* fresh clone to full verify is deterministic
* production image contains no secret/source-only toolchain
* deployment needs no provider-specific application changes

======================================================================
24. MR-19 — MARKETPLACE RELEASE READINESS
=========================================

Objective:

Certify the repository for handoff to ZolexoraDeployment without deploying it.

Required final verification:

* both storefront web applications
* both buyer mobile applications
* seller web
* seller mobile
* Marketplace Admin
* Marketplace API
* PostgreSQL migrations
* fake payment providers
* fake shipping provider
* fake object storage
* fake ERP integration
* complete purchase journeys
* fulfillment
* returns
* refunds
* storefront isolation
* seller isolation
* payment routing isolation
* session security
* admin authorization
* migration/restore contract
* container contract
* CI contract

Required release artifacts:

* release manifest
* dependency inventory
* SBOM
* runbooks
* known-risk register
* environment-variable contract
* migration command
* health command
* backup/export contract
* isolated restore-verification contract
* rollback interface
* provider-neutral deployment interface

Final repository-wide gate:

* install from canonical lockfile
* verify exact workspace package set
* build every applicable app
* type-check
* lint
* run all client tests
* run all backend tests
* validate migrations against real PostgreSQL
* empty database to head
* second no-op upgrade
* constraint tests
* rollback tests where supported
* validate Compose
* build production images
* scan secrets
* scan dependencies
* scan forbidden coupling
* check broken links
* check broken symlinks
* check duplicate lockfiles
* check accidental artifacts
* run `git diff --check`
* confirm no critical suite was skipped
* run two independent storefront purchase/refund journeys

Mandatory final behavior:

* no cloud account is required for verification
* no DNS mutation is required
* no production secret is required
* no live payment is required
* no live ERP is required
* no production customer data is required
* all P0/P1 blockers are closed or explicitly accepted by the owner
* all mandatory suites pass
* actual deployment remains outside this repository

Acceptance gate:

* all mandatory suites pass with zero skipped critical tests
* P0/P1 blockers are closed or explicitly accepted
* repository can be handed to ZolexoraDeployment
* no deployment is performed

======================================================================
25. DECISION-GATE HANDLING
==========================

Track these gates explicitly.

DG-01 — Canonical Marketplace database

Expected direction:

PostgreSQL is canonical and Oracle is retired.

Verify that MR-02 and later code reflect this.

DG-02 — Legal company and GST layout

Required before legally authoritative MR-07 tax behavior and live MR-16 ERP mapping.

Do not guess whether the Marketplace maps to:

* one ERP company with storefront channels
* two legal companies
* another approved structure

DG-03 — Payment providers and merchant accounts

Required before live MR-09 integration.

Safe implementation without final provider:

* provider-neutral ports
* separate storefront configs
* fake providers
* secret references
* normalized state machine

DG-04 — Seller commercial model

Relevant to MR-05 and MR-07.

Do not guess:

* commission
* settlements
* invoices
* payouts
* commercial liability

Do not block neutral seller organizations and storefront grants merely because payout rules are unresolved.

DG-05 — Shipping provider strategy

Relevant to MR-10.

Use a provider-neutral port and fake adapter until a provider is approved.

DG-06 — ERP v1 adoption and tenant isolation

Relevant to live MR-16.

Marketplace-side contracts, outbox/inbox and fake adapter may be completed without live ERP access.

DG-07 — Mahila mobile artwork

Relevant to MR-14 release presentation.

Do not fabricate approved artwork.

DG-08 — Legacy migration and retention

Relevant to MR-15.

Do not delete or destructively migrate real data without an approved retention decision.

======================================================================
26. VERIFICATION STRATEGY
=========================

Use the repository’s actual tools and scripts.

Inspect scripts before invoking them.

Do not invent command names when equivalent commands already exist.

At minimum, cover these layers.

Static:

* workspace guard
* formatting
* lint
* type-check
* dependency checks
* secret scans
* duplicate lockfiles
* broken links/symlinks

Unit:

* money calculations
* state machines
* validation
* authorization
* mappings
* idempotency helpers

Database:

* real PostgreSQL
* migrations
* constraints
* indexes
* transactions
* concurrency
* rollback behavior
* empty-to-head
* second no-op migration

API:

* authentication
* RBAC
* storefront isolation
* seller isolation
* pagination
* idempotency
* canonical errors
* client totals rejected

Payment:

* merchant routing
* signed webhook verification
* replay
* duplication
* ordering
* capture
* refund
* reconciliation

Contracts:

* shared API parsers
* ERP schemas
* ERP examples
* version compatibility

Web and mobile:

* distinct application identities
* critical workflows
* build
* type-check
* tests
* no pass-with-no-tests shortcuts

End-to-end:

* Zolexora Shop purchase/refund journey
* Mahila Madel purchase/refund journey
* separate fake merchant configurations

Security:

* cross-role attacks
* cross-store attacks
* session abuse
* secret/log review
* privileged-action audit

Release:

* clean clone contract
* deterministic builds
* images
* migration
* health
* Compose
* environment contract

Never substitute SQLite for tests that are intended to prove PostgreSQL behavior.

Never treat snapshots alone as sufficient evidence for money, permission or security logic.

======================================================================
27. GIT AND REMOTE-SAFETY RULES
===============================

Default remote mutation:

NONE.

Do not:

* commit
* push
* pull with rebase
* force push
* create a pull request
* merge
* tag
* publish images
* change GitHub settings
* mutate cloud resources
* mutate DNS
* use live external credentials

unless explicitly authorized by the user.

Permitted local Git inspection:

* `git status`
* `git diff`
* `git diff --cached`
* `git log`
* `git show`
* `git branch`
* `git remote -v`
* `git diff --check`

Do not use:

* `git reset --hard`
* `git clean -fd`
* destructive checkout
* forced branch switching
* commands that discard user work

At the end of every phase, report:

* starting HEAD
* ending HEAD
* branch
* upstream state
* worktree state
* exact changed files
* diff summary
* diff-check result
* confirmation that no commit/push/remote mutation occurred

Because commits are not authorized by default, maintain clear phase boundaries through exact reports and file lists.

Do not pretend that a commit was created.

======================================================================
28. REQUIRED PHASE REPORT
=========================

Create or update the existing phase-audit document using repository conventions.

Do not create a duplicate report when an equivalent phase report already exists.

Every phase report must contain:

1. Verdict

One of:

* PASS
* PASS WITH BLOCKERS
* FAIL

2. Starting and ending repository state

* repository root
* branch
* starting HEAD
* ending HEAD
* upstream
* initial worktree
* final worktree
* pre-existing user changes

3. Scope

* exact objective
* implemented
* repaired
* refactored
* verified
* explicitly excluded
* unrelated discoveries deferred

4. Files

* created
* modified
* moved
* retired
* deleted
* generated artifacts excluded from Git

5. Commands and results

For every important command:

* command
* exit code
* passed count
* failed count
* skipped count
* build result
* migration result

Never write only “tests passed.”

6. Security, isolation and data ownership

Include evidence relevant to the phase:

* storefront isolation
* organization isolation
* seller isolation
* payment routing
* permission behavior
* secret handling
* client-authority rejection
* transaction behavior
* audit attribution

7. Blockers and decisions

Classify:

* P0
* P1
* P2
* decision gates
* owner decision required
* non-blocking follow-up

8. Recommended next objective

Name exactly one next phase or corrective objective.

9. Git and remote state

* diff summary
* `git diff --check`
* commit confirmation
* push confirmation
* remote-mutation confirmation

======================================================================
29. DEFINITION OF DONE FOR EVERY PHASE
======================================

A phase is done only when all applicable conditions are true.

Scope:

* only authorized phase work was implemented
* later discoveries were recorded, not silently included

Architecture:

* ownership is explicit
* trust boundaries are explicit
* failure behavior is explicit
* no new undefined authoritative data source exists

Implementation:

* code is production-style and typed
* no placeholder is represented as complete
* no duplicate implementation was created

Security:

* no secret exposure
* no privilege widening
* no client authority over protected decisions
* no destructive behavior without review

Tests:

* focused regressions pass
* proportionate repository gates pass
* no critical skip marker exists
* test counts are reported

Documentation:

* ADRs, runbooks, status and audits reflect actual resulting behavior

Repository:

* no duplicate lockfile
* no stale active path
* no broken symlink
* no accidental artifact
* no unexplained generated file

Git:

* diff reviewed
* `git diff --check` passes
* user changes preserved
* no commit or push without authorization

Report:

* complete verdict
* exact baseline
* files
* commands
* evidence
* blockers
* next objective
* Git state

======================================================================
30. FINAL COMPLETION REPORT
===========================

When MR-19 passes, produce a consolidated final report.

Include:

* final verdict
* MR-05 through MR-19 phase verdict matrix
* completed capabilities
* canonical architecture
* database and migration status
* storefront isolation status
* seller organization/grant status
* catalog status
* inventory/pricing/promotion status
* cart/quote status
* payment status
* order/fulfillment/return/refund status
* seller portal status
* admin status
* both storefront web statuses
* both buyer mobile statuses
* Mahila legacy retirement status
* ERP integration boundary status
* security status
* observability status
* performance status
* container status
* CI status
* release-readiness status
* exact test/build totals
* unresolved accepted risks
* decision gates still needed for live deployment
* exact handoff requirements for ZolexoraDeployment
* final Git status
* remote-mutation confirmation

Clearly distinguish:

* repository completion
* production policy decisions
* production credentials
* deployment
* live data migration

Do not call the Marketplace “deployed” merely because the repository is release-ready.

======================================================================
31. START NOW
=============

Begin immediately.

First:

1. Verify the repository root and Git state.
2. Reconcile the claimed completed MR-04 baseline against repository evidence.
3. Locate all MR-00 through MR-04 reports and relevant tests.
4. Run the smallest honest baseline verification needed before MR-05.
5. Produce the MR-05 bounded plan.
6. Implement MR-05.
7. Test MR-05.
8. Produce the MR-05 report.
9. Continue through the remaining queue whenever the acceptance and decision-gate rules allow.

Do not start by proposing a new roadmap.

Do not repeat already completed phases without evidence.

Do not ask the user to type “next” after a passing phase.

Do not silently choose unresolved production policies.

Do not claim completion without commands, test counts, file evidence and Git evidence.

The final goal is a provider-neutral, secure, isolated and release-ready ZolexoraMarketplace repository that can be handed to ZolexoraDeployment without requiring application changes.

