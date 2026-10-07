# Zolexora Marketplace Agent Instructions

These instructions apply to the entire repository.

Canonical code roots are `apps/storefronts/`, `apps/portals/`, `services/marketplace-api/`, `packages/`, and `infrastructure/`. Each storefront owns separate web/mobile apps; the seller portal owns shared web/mobile apps. Read ADRs 0006 and 0007 before changing application ownership.

## Required reading

Before planning or modifying this repository, read:

1. `docs/README.md`
2. `docs/prd.md`
3. `docs/architecture.md`
4. `docs/data-model.md`
5. `docs/memory.md`
6. `docs/phases.md`
7. `docs/status/current-status.md`
8. `docs/status/gap-analysis.md`
9. `docs/status/next-actions.md`

Also read:

- Relevant files under `docs/decisions/`
- Relevant runbooks under `docs/runbooks/`
- The latest relevant audit under `docs/status/audits/`

Do not rely only on documentation. Verify important claims against the current repository before changing code.

## Confirmed platform direction

Zolexora Marketplace is one multi-store marketplace platform.

Customer storefronts:

- Zolexora Shop: `shop.zolexora.com`
- Mahila Madel: `mahilamadel.store`

Shared applications:

- Seller portal: `seller.zolexora.com`
- Marketplace admin: `admin.marketplace.zolexora.com`
- Shared backend API: `api.zolexora.com`

Non-negotiable architecture decisions:

- Both storefronts use one shared FastAPI backend.
- Both storefronts use one common seller portal.
- Both storefronts use one common marketplace admin panel.
- Final infrastructure and durable application data move to Oracle Cloud Infrastructure.
- Products use a master-product plus storefront-listing model.
- Sellers can publish a product to one storefront or both storefronts.
- Inventory is shared by default.
- Carts and wishlists are isolated by storefront.
- Every order has an immutable storefront identity.
- Zolexora Shop and Mahila Madel use different payment gateways or merchant accounts.
- Payment gateway selection is performed by the backend from the trusted order and storefront.
- Browser input must never be trusted to select a payment provider.
- Refunds use the provider that processed the original payment.
- Payment credentials belong in OCI Secret Management, never in source code.
- The Mahila Madel Express backend and separate admin implementation are transitional and will be retired.
- Do not create another backend, seller portal or admin panel.
- Keep one buyer mobile binary per storefront and one shared seller mobile binary. Public storefront constants are expectations, not authorization or payment routing.
- Request-level storefront context uses exact registered hosts/Origins or the validated public `X-Storefront-Key` hint. It is not persisted-resource authorization, and no default storefront is permitted.
- Zolexora ERP is an independent commercial product/company; Marketplace is one ERP customer. Never share source, databases, authentication, sessions, secrets, or availability assumptions. Marketplace-specific mappings stay in Marketplace and only FastAPI may eventually call the generic ERP contract.

Do not reverse an accepted decision without explicit user authorization and a new Architecture Decision Record that supersedes the earlier decision.

## Phase discipline

- Determine the active phase from `docs/status/current-status.md`.
- Work only within the active phase and the user’s requested scope.
- Do not implement later-phase features early.
- Do not combine repository restructuring, database migration and production deployment in one uncontrolled change.
- Follow acceptance criteria and stop conditions from `docs/phases.md`.
- A file existing does not mean its feature is complete.
- Never mark work completed without verification evidence.

## Repository working rules

- Inspect existing files before editing them.
- Search for equivalent files before creating new ones.
- Reuse existing modules and naming where appropriate.
- Do not create duplicate implementations.
- Preserve unrelated user changes.
- Do not run destructive Git commands.
- Do not commit or push unless the user explicitly requests it.
- Do not expose secret values in output, logs or documentation.
- Do not commit `.env` files or production credentials.
- Keep environment examples free of real credentials.
- Use `rg` and `rg --files` for repository discovery.
- Use forward-only database migrations when migrations begin.
- Do not modify migration history that may already have been applied.
- Do not claim production readiness without build, test, security and restore evidence.

## Verification requirements

Run checks appropriate to the files changed.

Typical backend checks include:

- Python compilation
- Ruff
- Targeted pytest tests
- Full backend pytest suite when backend behaviour changes

Typical frontend checks include:

- Type-check
- Lint
- Tests
- Production build

For shared-contract changes, verify every consuming application.

For payment changes, verify:

- Storefront-based gateway routing
- Signature validation
- Idempotent webhook handling
- Duplicate event handling
- Payment-state transitions
- Refund routing
- Storefront isolation

For data-model changes, verify:

- Storefront isolation
- Seller ownership
- Immutable order storefront assignment
- Inventory consistency
- Referential integrity

Report every command run and its result. If a check cannot run, explain why.

## Documentation maintenance

Durable project knowledge belongs in:

- `docs/`

Current implementation evidence belongs in:

- `docs/status/`

Update `docs/memory.md` only when a durable fact, constraint or decision changes.

Create a new file under `docs/decisions/` when making a material architecture decision. Do not silently rewrite an accepted ADR.

At the end of every completed phase, update as applicable:

- `docs/status/current-status.md`
- `docs/status/feature-matrix.md`
- `docs/status/gap-analysis.md`
- `docs/status/next-actions.md`
- `docs/status/test-baseline.md`
- `docs/memory.md`

Keep status documents evidence-based. Do not record assumptions as completed work.

## Final reporting

At the end of a task report:

1. Outcome
2. Files changed
3. Verification commands and results
4. Remaining blockers
5. Documentation/status updates
6. Exact next action when applicable

## Oracle persistence

Read `docs/oracle-persistence.md` and ADR 0010 before changing persistence. Alembic is the only Oracle schema mechanism; never use `metadata.create_all()`, edit applied revisions, use SQLite as Oracle proof, or add a static production storefront fallback.
