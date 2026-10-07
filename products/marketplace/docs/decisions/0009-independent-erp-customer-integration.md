# ADR 0009: Independent ERP customer integration

- **Status:** Accepted
- **Date:** 2026-07-15

## Context

Zolexora ERP and Zolexora Marketplace are independent companies and products. ERP serves unrelated organizations; Marketplace is one customer and must not couple to ERP internals.

## Decision

Repositories, databases, authentication, users, administrators, deployments, releases, secrets, backups, and failure domains remain separate. Only Marketplace FastAPI may communicate with its configured ERP tenant through a generic versioned contract. Marketplace-specific storefront mappings remain in Marketplace; generic ERP APIs/events remain in the ERP integration boundary. No frontend calls ERP and checkout never synchronously depends on ERP.

Marketplace uses an eventual outbox/inbox integration with idempotency, retry, dead-letter review, replay audit, and reconciliation. Marketplace retains payment-provider routing and truth; ERP receives normalized accounting events. One-company/two-channel and two-company layouts are both supported, with no default until legal/GST ownership is confirmed.

## Reasons

- Preserve ERP product reuse and customer isolation.
- Prevent shared-database/auth coupling and cross-company failures.
- Avoid lost or duplicate orders during ERP outages.
- Keep financial discrepancies observable and auditable.

## Consequences

The contract remains proposed until adopted by ERP. Live integration requires ERP tenancy/scoping confirmation, endpoint implementation, credential/scopes agreement, webhook security, and compatibility tests. Oracle integration entities are designed but not migrated.

## Alternatives considered

- Direct database access or shared tables: rejected.
- Marketplace-specific ERP conditionals: rejected.
- Synchronous checkout-to-ERP calls: rejected.

## Affected modules

Marketplace integration contracts/models, future Oracle outbox/inbox, ERP integration product boundary, payments accounting, orders, inventory, and reconciliation.

## Implementation phase

Phase 3 contract and ownership foundation; live communication is later.
