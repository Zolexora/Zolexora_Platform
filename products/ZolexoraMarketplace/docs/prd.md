# Product requirements document

## Product

**Name:** Zolexora shared marketplace platform  
**Status:** Target definition  
**Primary outcome:** operate Zolexora Shop and Mahila Madel as distinct storefronts on one secure marketplace platform, shared seller portal, shared admin panel, and Oracle Cloud infrastructure.

## Problem

The repository contains a feature-rich Zolexora platform and a separate Mahila Madel ShopKart application. They duplicate customer, catalog, admin, cart, order, authentication, and checkout concerns. The main platform also lacks a trusted storefront identity and supports only global payment configuration. Operating both systems independently would fragment inventory, sellers, users, payments, operations, and reporting.

Zolexora ERP is a separate commercial product/company, and Marketplace is one external customer. They must not share databases, authentication, users, administrators, deployments, secrets, backups, releases, or failure domains. Only Marketplace FastAPI may eventually use the generic ERP customer contract; checkout cannot synchronously depend on ERP.

## Goals

- Launch and operate two distinct customer storefronts.
- Share backend capabilities, seller operations, and marketplace administration.
- Preserve store-specific branding, publication, merchandising, pricing, and domain behavior.
- Route each store to its own payment gateway configuration or merchant account securely.
- Make the server authoritative for identity, scope, price, totals, payments, and permissions.
- Consolidate Mahila Madel onto the common platform without keeping a second transactional backend.
- Move all final production workloads and platform services to Oracle Cloud Infrastructure.
- Provide auditable, testable, and observable operations.

## Non-goals for the initial foundation

- Splitting the modular backend into many independent microservices.
- A no-code store builder or arbitrary third-party storefront onboarding.
- Multiple currencies, countries, or tax regimes beyond explicit initial requirements.
- Sharing web cookies directly between `mahilamadel.store` and `zolexora.com`.
- Letting clients select merchant accounts or submit authoritative totals.
- Rebuilding every visual screen before backend ownership and safety are established.
- Migrating unverified demo data merely because it exists in the repository.

## Users

| Persona | Need |
| --- | --- |
| Customer | Browse and buy from the intended brand with trustworthy order/payment status |
| Seller | Publish products to authorized storefronts and fulfill all orders in one workspace |
| Seller staff | Perform limited operational work without full seller-owner privileges |
| Marketplace operator | Support orders, listings, shipping, and payment exceptions across stores |
| Marketplace admin | Configure stores, permissions, and platform policy with auditability |
| Finance/operations | Reconcile store-specific payments, refunds, fees, and settlements |
| Developer/operator | Build, deploy, monitor, and recover the platform reproducibly on OCI |

## Required production surfaces

| Surface | Domain |
| --- | --- |
| Zolexora Shop | `shop.zolexora.com` |
| Mahila Madel | `mahilamadel.store` |
| Seller portal | `seller.zolexora.com` |
| Marketplace admin | `admin.marketplace.zolexora.com` |
| API | `api.zolexora.com` |

## Functional requirements

### Storefront identity and branding

- FR-1: The platform resolves customer storefront from a verified canonical host.
- FR-2: Unknown or inactive customer hosts fail closed.
- FR-3: Each storefront has independent brand configuration, domain, status, locale, and features.
- FR-4: Storefront identity is included in scoped logs, analytics, carts, checkouts, orders, payments, promotions, and listings.

### Identity and access

- FR-5: One canonical account can purchase from both storefronts.
- FR-6: Web sessions use secure cookies and CSRF protection; mobile credentials use secure platform storage.
- FR-7: Sellers and staff receive explicit organization roles and storefront publishing grants.
- FR-8: Every customer, seller, and admin protected operation is authorized on the server.
- FR-9: Sensitive admin actions create immutable audit events.

### Catalog, listings, and inventory

- FR-10: The platform stores a master product and variant independently from store-specific listings.
- FR-11: A seller can publish an owned product only to a storefront for which it has permission.
- FR-12: Each listing controls publication, price, merchandising content, and storefront visibility.
- FR-13: Inventory is shared by default and reservations prevent overselling across storefronts.
- FR-14: Seller/admin interfaces clearly label storefront scope.

### Cart, pricing, and checkout

- FR-15: A cart is bound to one storefront and cannot contain another store's listings.
- FR-16: The backend recalculates item price, promotions, coins, tax, shipping, and total.
- FR-17: Checkout returns a clear price/stock change response before initiating payment.
- FR-18: Duplicate checkout submissions with the same idempotency key create at most one commercial result.

### Orders and fulfillment

- FR-19: Every order contains immutable storefront, seller, item, money, address, and currency snapshots.
- FR-20: Customers see only their own orders; sellers see only orders for their organization; admins follow explicit permissions.
- FR-21: Payment state, fulfillment state, return state, and refund state are modeled separately.
- FR-22: Shared shipping orchestration supports pickup, provider selection, booking, tracking, cancellation, and signed webhook updates.

### Payments

- FR-23: Each storefront uses its configured gateway/merchant account in its current environment.
- FR-24: Gateway/account selection comes only from the persisted order storefront.
- FR-25: The platform supports idempotent initiation and authoritative provider verification.
- FR-26: Signed webhooks are deduplicated and safe when delayed or out of order.
- FR-27: Partial/full refunds respect captured and previously refunded amounts.
- FR-28: Finance/operations can reconcile payments and refunds separately for each merchant account.
- FR-29: No payment secret or sensitive payment data is exposed to clients or logs.

### Mahila Madel consolidation

- FR-30: Mahila Madel uses the shared identity, catalog/listing, cart, checkout, order, payment, shipping, seller, and admin capabilities.
- FR-31: Its customer-facing brand remains distinct.
- FR-32: Its standalone Express/Mongoose backend is retired as a source of truth after parity and verification.
- FR-33: Client-trusted order totals and demo administrative access are removed.

### Oracle Cloud

- FR-34: Production application workloads, database, object storage, cache, secrets, ingress, DNS, registry, logging, monitoring, and alarms run on approved OCI services.
- FR-35: Infrastructure and database changes are versioned and reproducible.
- FR-36: Target container architecture is tested before deployment.
- FR-37: Production has tested recovery, rollback, secret rotation, and incident procedures.

## Non-functional requirements

### Security

- Least privilege across user roles, OCI IAM, databases, buckets, and secrets.
- Exact CORS allowlists and trusted-proxy handling.
- Secure session rotation/revocation and CSRF defense.
- Input validation, output encoding, rate limiting, dependency scanning, and audit logs.
- No OTPs, passwords, tokens, payment credentials, or unnecessary personal data in logs.
- Storefront isolation and account-routing tests are release-blocking.

### Reliability and consistency

- Financial and inventory mutations are transactional or use explicitly safe compensating workflows.
- Public mutation APIs support idempotency where retries can duplicate effects.
- Provider webhooks are durable, deduplicated, and replayable.
- The system degrades safely when cache, a shipping provider, or a payment callback is delayed.

### Performance

- Set measurable service-level objectives after staging load measurement.
- Initial design targets should include responsive catalog reads, bounded checkout latency excluding provider redirects, and fast health/readiness checks.
- Index primary query paths by storefront, status, seller, buyer, and time.
- Cache only where invalidation and source-of-truth behavior are defined.

### Accessibility and usability

- Customer and operational web surfaces target WCAG 2.2 AA.
- Core purchase and fulfillment flows work at mobile widths and with keyboard navigation.
- Pending and failed states are understandable without provider jargon.

### Observability

- Structured logs, metrics, traces/correlation, dashboards, and actionable alerts.
- Storefront and provider/account dimensions for commerce operations without leaking secrets.
- Monitoring for checkout, payment, refund, inventory, shipping, database, certificate, and deployment failure.

## Success measures

Before launch, exact baselines and targets must be agreed. At minimum measure:

- Successful checkout completion by storefront and payment method.
- Payment initiation-to-authoritative-confirmation rate and delay.
- Unreconciled payment/refund count and age.
- Oversell/reservation conflict rate.
- Shipping booking success and manual-attention rate.
- API error rate and latency by critical flow.
- Seller listing and fulfillment success by storefront.
- Cross-store isolation/security test pass rate: required 100%.

## Acceptance criteria

The product is ready for controlled production only when:

1. All five production domains route correctly over valid TLS.
2. Unknown hosts and cross-store data attempts fail closed.
3. Both customer stores use the shared backend and persist immutable order origin.
4. Common seller/admin surfaces operate both stores with clear, tested permissions.
5. Mahila Madel no longer depends on its duplicate transactional server.
6. Each storefront completes sandbox and production-readiness payment tests against only its own account.
7. Server totals, idempotency, signed webhooks, refunds, and reconciliation pass.
8. OCI infrastructure is reproducible and staging passes recovery, security, performance, and rollback tests.
9. Logs, metrics, alarms, audit events, and operational ownership are in place.
10. No release-critical P0 security, payment, data-integrity, or storefront-isolation blocker remains open.

## Dependencies and open decisions

- Select and contract the exact gateway/provider and merchant account for each storefront.
- Confirm legal entity, tax, invoice, refund, and settlement ownership for each brand.
- Decide whether coin balances and promotions are shared across stores or merely attributed across them.
- Define initial catalog ownership/import rules for Mahila Madel content.
- Set measured availability, latency, recovery, retention, and support targets.
- Confirm OCI region, tenancy/compartment ownership, production capacity, and cost envelope.

The current Oracle implementation scope is limited to storefront/domain configuration and integration reliability. Full commerce migration and legacy-data import are explicitly not complete.
