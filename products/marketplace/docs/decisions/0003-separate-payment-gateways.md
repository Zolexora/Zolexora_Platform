# ADR 0003: Separate payment gateway configurations by storefront

- **Status:** Accepted
- **Date:** 2026-07-14
- **Decision owners:** Marketplace product, finance, and engineering

## Context

Zolexora Shop and Mahila Madel must use different payment gateway configurations or merchant accounts. The current FastAPI implementation has one global Razorpay configuration and one global UPI merchant, while the Mahila application has only a demonstration-level payment flow. The browser can currently request a payment method, and the system lacks a complete provider abstraction, payment webhook lifecycle, refunds, and reconciliation.

Storefront-specific money routing is a security and accounting boundary. It cannot be implemented as a visual frontend choice.

## Decision

Use one shared payment orchestration module with separate `payment_account` configuration per storefront and environment.

- The order's persisted immutable `storefront_id` determines the payment account.
- The storefront-to-account mapping is maintained server-side.
- Each account has separate secret references, provider identifiers, webhook verification configuration, and reconciliation scope.
- Provider-specific behavior is isolated behind capability-aware adapters.
- Clients receive only eligible methods and the safe next action for an already selected account.
- Signed webhooks and provider status checks are authoritative; client callbacks are not proof of payment.

The exact gateway provider assigned to each store remains a configuration/procurement decision and does not change this architecture.

## Consequences

### Positive

- Merchant funds, credentials, webhooks, refunds, and settlement reporting remain isolated by brand/account.
- Shared lifecycle and operational tooling avoid duplicate payment code.
- A provider can be replaced for one storefront without rewriting checkout or order modules.
- Account-specific reconciliation and audit become possible.

### Costs and risks

- Payment records and webhook routes must identify the correct account before signature verification.
- Operations need separate onboarding, test/live credentials, webhooks, refunds, and reconciliation for both accounts.
- Provider capabilities differ, requiring explicit capability handling.
- Bugs in trusted storefront resolution or order persistence could route money incorrectly, so isolation tests are release-blocking.

## Rejected alternatives

### Let the browser choose the provider/account

Rejected because clients are untrusted and could redirect funds, bypass policy, or create mismatched payment records.

### Keep one global merchant account

Rejected because it violates the business requirement and prevents clean store-level credentials and settlement ownership.

### Maintain separate payment implementations in each storefront

Rejected because it duplicates security-critical lifecycle, webhook, refund, idempotency, and reconciliation logic.

## Implementation constraints

- Server-side totals and immutable order origin exist before payment initiation.
- Payment, webhook, capture, refund, and reconciliation operations are idempotent.
- One storefront's webhook secret cannot verify another storefront's event.
- Test and live credentials are isolated and stored only in OCI secret services.
- Financial state is separate from order fulfillment state.
- Manual UPI/COD exceptions are permission-controlled, store-scoped, and auditable.

## Related documents

- [Payment architecture](../payment-architecture.md)
- [Data model](../data-model.md)
- [Domains and routing](../domains-and-routing.md)

