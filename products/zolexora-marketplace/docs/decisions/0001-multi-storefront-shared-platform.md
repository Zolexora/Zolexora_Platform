# ADR 0001: Multi-storefront shared platform

- **Status:** Accepted
- **Date:** 2026-07-14
- **Decision owners:** Marketplace product and engineering

## Context

The repository contains a Zolexora marketplace platform and a separate Mahila Madel ShopKart application. Both need customer storefronts, identity, catalog, inventory, carts, checkout, orders, seller operations, administration, payments, shipping, and reporting. Operating two independent stacks would duplicate business rules and create conflicting sources of truth.

The brands still require distinct domains, visual identity, publication, merchandising, pricing, and payment configurations.

## Decision

Build one shared marketplace platform serving multiple storefronts.

- `shop.zolexora.com` is the Zolexora Shop customer storefront.
- `mahilamadel.store` is the Mahila Madel customer storefront.
- `seller.zolexora.com` is the common seller portal.
- `marketplaceadmin.zolexora.com` is the common admin panel.
- `api.zolexora.com` is the shared backend API.

Storefront identity is a first-class trusted context represented by immutable `storefront_id` references. The server derives customer storefront from a verified host registry. Clients cannot override it.

The target model separates master products and variants from storefront listings. Inventory is shared by default. Carts and orders are storefront-bound, and an order's storefront origin is immutable.

The initial backend remains a modular monolith. Provider adapters and domain boundaries are required, but independent microservices are not required.

## Consequences

### Positive

- One source of truth for users, sellers, products, inventory, orders, shipping, and operations.
- Shared seller/admin development and consistent security policy.
- Store-specific branding and commerce policy remain possible through configuration and listings.
- Cross-store analytics and operations have stable identifiers.
- New storefronts can later reuse the foundation through a controlled onboarding model.

### Costs and risks

- Every scoped query and mutation must enforce storefront boundaries.
- Shared inventory requires careful transactions and reservations to prevent overselling.
- Seller/admin interfaces need explicit store context and permissions.
- Migration of Mahila Madel requires parity work and retirement of its duplicate backend.
- A defect in the shared platform could affect both brands, increasing the importance of isolation tests and operational controls.

## Rejected alternatives

### Keep two independent platforms

Rejected because it duplicates sellers, catalog, inventory, auth, admin, payments, deployments, and reconciliation while making shared operations unreliable.

### Copy Mahila Madel into the Zolexora app with only a theme flag

Rejected because styling alone does not model store-specific domains, listings, prices, permissions, order origin, or payment accounts.

### Start with microservices per business module

Rejected for the initial migration because it adds operational and consistency complexity before domain boundaries and workflows are stable.

## Implementation constraints

- Unknown storefront hosts fail closed.
- A storefront ID from a client is never authoritative.
- All store-aware data models, logs, analytics, and tests use stable IDs.
- Cross-store seller/admin access is explicit and auditable.
- The Mahila Express/Mongoose server becomes transitional and is retired after shared-backend parity.

## Related documents

- [Architecture](../architecture.md)
- [Data model](../data-model.md)
- [Domains and routing](../domains-and-routing.md)
- [Product requirements](../prd.md)

