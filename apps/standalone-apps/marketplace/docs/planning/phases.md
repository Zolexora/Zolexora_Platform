# Delivery phases

## Sequencing principle

Each phase must leave the repository in a verified state and satisfy its exit gate before later work begins. Scope should not be mixed merely because components are related.

## Phase 0 — Repository truth and durable documentation

**Objective:** establish an evidence-backed baseline and record the intended system.

Deliverables:

- Inventory apps, dependencies, data stores, authentication, payments, infrastructure, and test coverage.
- Capture build/test results and distinguish real execution from false-green root tasks.
- Create durable architecture, product, data, payment, Oracle, routing, design, ADR, and runbook documents.
- Record critical security and multi-storefront gaps.

Exit gate:

- Documentation is repository-backed, current and target state are labeled, and no application behavior changed as part of the documentation phase.

## Phase 1 — Deterministic monorepo baseline

**Objective:** make root tooling discover and honestly verify every application.

Deliverables:

- Correct pnpm workspace patterns for all nested Zolexora apps, Mahila client/server, and shared packages.
- One canonical pnpm lockfile and intentional package-manager policy.
- Root scripts and Turbo tasks that execute real builds, lint, type checks, and tests.
- A workspace verification guard that fails on missing required packages or stale app paths.
- CI and Docker paths aligned with actual directories.
- Reproducible local commands and an updated runbook.

Exit gate:

- A clean frozen install succeeds and root checks show actual application tasks; explicit app checks agree with root results.

## Phase 1.5 — Canonical repository layout

Phase 1.5 completed the path-only canonical repository reorganization defined by ADR 0006. It separated storefronts, portals, mobile clients, FastAPI, infrastructure, and project knowledge without changing application behavior. Its gate requires nine workspace packages, passing builds/type-check/lint/backend tests/Compose parsing, no active stale paths, and no broken symlinks; the pre-existing Mahila zero-test blocker may remain visible.

## Phase 1.6 — Mobile storefront alignment

Two separate buyer binaries now live under their owning storefronts, seller mobile is shared under the seller portal, and ten workspace packages are verified. Only compiled public identity expectations were added; backend storefront resolution remains Phase 2.

## Phase 2 — Storefront foundation

**Objective:** introduce trusted request-level storefront identity and shared contracts without changing persistence or payment behavior.

Deliverables:

- Storefront registry seeded with `zolexora-shop` and `mahila-madel`.
- Trusted host resolver and typed storefront context.
- Shared storefront API contracts, buyer hints, exact CORS, reusable dependencies, and resolver fixtures.
- Fail-closed tests for host/Origin parsing, signal conflicts, forwarding forgery, CORS, and request isolation.

Exit gate:

- Unknown/missing required context fails closed, conflicting signals are rejected, and existing routes remain green. Database isolation is explicitly deferred.

## Phase 3 — Shared backend data boundaries

**Objective:** establish Marketplace/independent-ERP ownership, generic contracts, Marketplace mappings, and asynchronous reliability design before Oracle persistence.

Deliverables: data ownership, legal-company mapping options, proposed versioned ERP contract, Marketplace typed models/ports, outbox/inbox/retry/reconciliation/security design, and conceptual Oracle integration entities. No live calls, workers, credentials, or migrations.

Exit gate: contracts/examples validate offline, backend/root tests pass, ERP compatibility gaps are explicit, and no system boundary is shared.

## Phase 4 — Business decisions and Oracle schema foundation

**Objective:** resolve legal-company and ERP-contract decisions, then define the forward-only Oracle Marketplace schema and local migrations without remote execution.

Deliverables:

- Approved one-company or two-company mapping and ERP contract ownership/version.
- Storefront, product/listing, inventory, order-origin, seller-grant, external mapping, outbox/inbox, delivery-attempt, dead-letter, and reconciliation schema.
- Forward-only local migrations, constraints, repository boundaries, and isolation/idempotency tests.
- No remote migration, live ERP call, or payment-provider change.

Exit gate:

- Local schema/migration tests pass; immutable storefront and integration constraints are proven; business decisions and ERP compatibility are recorded. Payment orchestration remains a later phase after persisted order/storefront ownership exists.

## Phase 5 — Oracle data and platform adapters

**Objective:** replace current persistence and provider coupling with Oracle-backed services.

Deliverables:

- Versioned Oracle schema and migrations for marketplace modules.
- Autonomous Database repositories and transaction boundaries.
- Object Storage media adapter and migration/import tooling if needed.
- OCI Cache adapter with safe fallback behavior.
- OCI secret references and provider-neutral configuration.
- Idempotent seeds, validation reports, and performance indexes.

Exit gate:

- Staging data integrity, constraints, monetary calculations, concurrency, and module tests pass on OCI services without current storage systems as authoritative dependencies.

## Phase 6 — OCI deployment, security, and observability

**Objective:** deploy the entire platform reproducibly on OCI.

Deliverables:

- Infrastructure as code for environments, network, IAM, Compute, OCIR, database, Object Storage, cache, secrets, load balancer, WAF, DNS, certificates, logs, metrics, and alarms.
- Verified target-architecture container builds, including ARM64 if Ampere is used.
- Secure sessions, CSRF protection, exact CORS, rate limits, dependency remediation, and secret rotation.
- Health/readiness probes, structured logging, dashboards, alerts, and deployment rollback.
- Staging end-to-end and load/resilience tests.

Exit gate:

- A production-like staging environment passes security, recovery, performance, payment, storefront-isolation, and rollback exercises.

## Phase 7 — Domain cutover and stabilization

**Objective:** launch the approved domains with controlled risk.

Deliverables:

- DNS, certificates, WAF, canonical redirects, and webhook production registrations.
- Storefront-by-storefront smoke and transaction tests.
- Operational ownership, incident procedures, reconciliation cadence, and support views.
- Monitored rollout with explicit rollback thresholds.
- Removal of expired legacy infrastructure and credentials after the stabilization window.

Exit gate:

- Both storefronts, seller portal, admin panel, and API meet service targets; live orders and payments reconcile; no legacy system remains an untracked source of truth.

## Cross-phase quality gates

Every implementation phase must include:

- Relevant automated tests and exact commands/results.
- Security review for auth, tenant/store isolation, personal data, secrets, and payments.
- Database migration and rollback/forward-fix strategy when schemas change.
- Updated durable documentation and status evidence.
- No hidden skipped tasks, fake passing test flags, or unreviewed broad ignores.
- No production deployment, live credential use, commit, or push unless explicitly authorized.

## Phase 4 result

Oracle storefront/domain and integration reliability foundations are implemented with one forward migration and offline Oracle validation. Real disposable-Oracle execution, legal/GST mapping, and ERP adoption remain blockers. Phase 5 must not activate ERP mappings without those decisions.

## Phase 5 Oracle execution gate result

The user-authorized Phase 5 execution gate validated migration 0001, bootstrap, constraints, concurrent claims, repositories, and readiness on disposable Oracle Database 23ai Free 23.9. This closes the local real-Oracle blocker but does not complete the broader Oracle data/platform-adapter deliverables above. Legal/GST mapping, ERP adoption/site isolation, commerce migrations, and OCI Autonomous Database parity remain blocked or deferred.
