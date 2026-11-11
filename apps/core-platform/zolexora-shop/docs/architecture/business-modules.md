# Business modules

## Purpose

The target platform is one modular marketplace application with explicit business ownership. This document defines module responsibilities so logic is not duplicated across storefronts, clients, or provider adapters.

## Module map

| Module | Owns | Does not own |
| --- | --- | --- |
| Storefronts | Store identity, host mapping, brand configuration, activation | Authentication or payment credentials in plain text |
| Identity | Accounts, verified identities, sessions, roles | Storefront inference or seller catalog policy |
| Seller access | Seller organizations, memberships, roles, store publishing grants | Product truth or customer checkout |
| Catalog | Master products, variants, attributes, categories | Store-specific price and publication |
| Listings | Per-store publication, price, compare-at price, SEO, merchandising | Physical stock ledger |
| Inventory | Stock ledger, reservations, availability, adjustments | Presentation price or gateway selection |
| Cart | Store-bound cart and selected variants | Authoritative final totals |
| Pricing | Item price, promotions, coins, tax, shipping quote, total | Capturing payments |
| Checkout | Validation, inventory reservation, order creation | Provider-specific API details |
| Payments | Account selection, attempts, captures, webhooks, refunds, reconciliation | Order fulfillment decisions |
| Orders | Immutable commercial snapshot and lifecycle | Mutable catalog content |
| Shipping | Pickup, rate discovery, booking, shipment events | Payment authorization |
| Engagement | Reels, views, rewards, coins | Directly mutating order totals outside pricing policy |
| Media | Upload policy and object references | Catalog ownership or public authorization |
| Admin | Moderation, support, configuration, audit workflows | Bypassing domain authorization |
| Analytics | Event contracts, aggregates, store segmentation | Source-of-truth transactional mutations |

## Storefronts

The storefront module maintains the platform's trusted registry.

Required capabilities:

- Create and configure a storefront through controlled admin workflows.
- Map one or more verified domains to one storefront.
- Store brand metadata, locale, currency, support contacts, and feature flags.
- Associate an active payment account without exposing credentials to clients.
- Enable or disable ordering without deleting historical data.
- Resolve customer traffic by canonical host and reject unknown hosts.

Initial storefront keys should be stable slugs such as `zolexora-shop` and `mahila-madel`; database identifiers remain the authoritative references.

## Identity and access

One account can interact with both storefronts. Storefront membership is not embedded in a duplicated user record.

Roles and grants should distinguish:

- Customer: manages their own profile, addresses, carts, and orders.
- Seller member: accesses one seller organization with explicit permissions.
- Marketplace operator: performs scoped support or operational actions.
- Marketplace admin: manages platform-wide policy and access.

Authorization must be evaluated on the server for every protected resource. Client route guards improve experience but are not a security boundary.

## Seller organizations and publishing

A seller organization may publish to one or both storefronts. Publishing rights are explicit rather than inferred from the seller account alone.

Minimum permissions:

- Manage organization profile and pickup locations.
- Manage owned products and variants.
- Create or update listings only for granted storefronts.
- See and fulfill only orders containing that seller's items.
- View seller analytics segmented by storefront.

The common seller portal should display store badges and require an explicit store context for listing and analytics actions.

## Catalog, listings, and inventory

The commerce model separates three concerns:

1. **Product**: shared descriptive truth such as title, brand, attributes, and category.
2. **Listing**: how a product or variant is sold on a particular storefront, including publication and price.
3. **Inventory**: physical sellable quantity and reservations, shared across storefronts by default.

The same product can be hidden on one storefront, priced differently on another, or use different merchandising content without duplicating its stock truth.

## Cart, pricing, and checkout

A customer may have one active cart per storefront. Items added under one storefront cannot be checked out under another.

The server recalculates every commercial value at checkout from current listings and policy:

- Unit and compare-at prices.
- Quantity and stock availability.
- Promotions and coupon eligibility.
- Coin balance and redemption caps.
- Taxes and shipping fees.
- Rounding and final payable amount.

Client-provided totals are ignored. If the recalculated total differs from the last displayed quote, checkout returns a structured price-change response before payment begins.

## Payments

Payments are storefront-scoped even though orchestration is shared. The payment module selects the active payment account using the persisted storefront on the order. It owns initiation, verification, webhook handling, status transitions, refunds, and reconciliation.

See [payment-architecture.md](payment-architecture.md).

## Orders and fulfillment

An order records the commercial facts at purchase time. Later catalog or listing edits never rewrite history.

Required lifecycle concepts:

- Draft/checkout creation.
- Pending payment, authorized, paid, payment failed, or expired.
- Processing, ready to ship, shipped, delivered, cancelled, return requested, returned.
- Partial or full refund state independent from fulfillment state.
- Shipment and tracking events with signed provider webhook ingestion.

If one checkout includes multiple sellers, the platform may create a parent checkout with seller-specific orders while preserving one customer-facing transaction reference.

## Engagement and coins

The repository currently supports reels and coin rewards. The target keeps those capabilities behind a ledger-based module.

- Rewards are idempotent and include a source event reference.
- Storefront scope is captured when engagement occurred.
- Redemption rules are applied by pricing, not by the client.
- A coin transaction is immutable; corrections use compensating entries.
- Cross-store coin eligibility must be an explicit policy. The initial target may share the balance while still attributing earn and spend events to a storefront.

## Shipping

Shipping remains shared because provider selection depends on seller pickup, destination, parcel, serviceability, cost, and delivery promise rather than customer brand alone.

- Provider integrations live behind a common adapter interface.
- Booking and webhook operations are idempotent.
- Shipment events retain provider payload references safely without logging secrets.
- Admin can filter failures by storefront, seller, provider, and status.

## Media

Clients request an authorized upload intent. The media module validates file type, size, owner, and purpose, then stores objects through a provider-neutral interface. Business records store object keys and metadata rather than embedding provider credentials or assuming Cloudinary URL shapes.

## Administration and audit

The common admin panel needs a global view with storefront filters. Sensitive actions require server-side permission checks and audit records containing actor, action, target, storefront, timestamp, and request correlation ID.

Examples include:

- Store activation and configuration.
- Seller approval and publishing grants.
- Product moderation.
- UPI/manual exception review during transition.
- Refund approval and reconciliation exceptions.
- Role or account-status changes.

## Analytics

Every business event that can differ by brand includes `storefront_id`. Key dimensions include seller, listing, product, order, payment provider, campaign, and time. Analytics consumers never infer storefront from a mutable domain string after the fact.
## ERP customer integration

- **Purpose:** asynchronously exchange generic operational/accounting references with Marketplace's configured independent ERP tenant.
- **Actors:** Marketplace integration operator, ERP service identity, finance/operations reviewers.
- **Current:** proposed v1 contracts and typed ports plus Oracle outbox/inbox/dead-letter/reconciliation schema; no transport or workers.
- **Target:** Oracle outbox, ERP inbox, scoped credentials, idempotent events, and reconciliation.
- **Storefront scope:** translated by Marketplace mapping; ERP core never receives Marketplace-specific conditionals.
- **Dependencies:** legal-company decision, ERP contract adoption, Oracle entities, secret management.
- **Phase/gaps:** contract in Phase 3; endpoints, scopes, webhooks, and customer-site isolation remain unverified.
