# Phase 3 ERP integration contract audit

Date: 2026-07-15. Marketplace started clean on `main` at `3cf29ddc07abac826e773a44a42f6526011176b7` with 10 packages, 15 client tests, 113 backend tests, and passing `pnpm verify`.

## Verdict

**PASS WITH BLOCKERS.** Marketplace ownership, proposed generic v1 contracts, typed models/ports, mapping rules, reliability/security design, and Oracle integration entities are complete and offline-valid. The separate ERP product has not adopted these proposed endpoints, its commercial customer-site isolation policy is unverified, and the Marketplace legal-company layout is undecided.

## Read-only ERP audit

- Repository: `/home/chickenman/Documents/my_projects/ZolexoraERP`
- Branch/commit: `phase-3.9b-branding` / `099554866245367e5150afe87582ab32b0a79b04`
- Existing unrelated changes preserved: three branding SVGs.
- Versions: Frappe 16.25.0, ERPNext 16.26.1, `zolexora_integrations` 1.0.0.
- Current integration app: scheduled marketplace sync placeholders and notification placeholders; no generic versioned commands/events, inbox, webhook verification, or reconciliation contract.
- Current APIs: whitelisted role-protected read endpoints for Customer, Supplier, Item/Bin inventory, Sales Order, and Purchase Order; docs describe standard Frappe cookie or token authentication.
- Isolation: Frappe request state is site-scoped and ERPNext supports Company records; audited Compose config exposes one `SITE_NAME`. Separate-site versus shared-site commercial tenancy is not documented or verified.

## Delivered boundary

ERP and Marketplace remain separate companies/products, repositories, databases, identities, administrators, deployments, secrets, backups, releases, and failures. Only FastAPI may eventually communicate. Marketplace maps its storefronts to generic tenant/organization/channel/accounting references. Payment routing remains Marketplace-owned. Checkout/payment completion does not wait for ERP.

The proposed contract contains 12 JSON Schemas, 7 examples, and one proposed OpenAPI 3.1 document. Marketplace adds frozen Pydantic contract/mapping models and Protocol ports only—no HTTP client, worker, persistence, credentials, or fake response.

## Verification

| Command | Result |
| --- | --- |
| Contract validator | 12 schemas, 7 examples, proposed OpenAPI 3.1 pass offline |
| Focused ERP model tests | 18 passed |
| FastAPI compile/Ruff/pytest | pass; 131 tests |
| Frozen pnpm install/workspace | pass; exactly 10 packages |
| Root build/type-check/lint | 8/8; 7/7; 2/2 plus Ruff |
| Root client tests | 4/4 suites, 15 tests |
| Full `pnpm verify` | pass, including contract validation and backend |
| Compose/diff/lockfiles | pass; only root `pnpm-lock.yaml` |
| Coupling scan | no Marketplace keys in generic contracts; no Frappe/ERPNext/database runtime imports |
| Secret scan | no credential values; documentation mentions only prohibited/possible mechanisms |

## Blockers

- P0: legal/GST one-company versus two-company decision.
- P0: ERP product team must adopt/supersede the proposed generic v1 contract.
- P1: prove commercial tenant/site isolation, scopes, authentication and webhook signing.
- P1: implement Oracle outbox/inbox/reconciliation persistence and recovery only in a later authorized phase.
