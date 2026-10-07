# Marketplace Repository Roadmap (MR-00 to MR-19)

This document specifies the authoritative, sequential roadmap for the Zolexora Marketplace repository development. Each phase is executed, tested, reviewed, and accepted separately.

## Roadmap Phase Sequence

1. **MR-00 Architecture Reset and Clean Baseline** *(Completed)*
   Establish a cloud-agnostic, provider-neutral repository baseline. Supersede Oracle/OCI targets. Adopt `admin.marketplace.zolexora.com`. Classify all datastores and code artifacts.

2. **MR-01 Canonical Marketplace Contracts**
   Define type-safe JSON Schemas, TypeScript interfaces, and Pydantic models for core domain contracts across storefronts, portals, and API.

3. **MR-02 PostgreSQL Foundation and Data Convergence** *(Requires DG-01 approval)*
   Establish canonical PostgreSQL schema foundation via Alembic forward migrations, replacing legacy transactional persistence layers.

4. **MR-03 Secure Identity, Sessions and RBAC**
   Implement secure HttpOnly session cookies, multi-tenant RBAC policies, user profiles, and mobile platform auth store integrations.

5. **MR-04 Persisted Storefront and Domain Isolation**
   Enforce strict storefront-scoped data persistence and request context resolution backed by relational repository tables.

6. **MR-05 Seller Organizations and Storefront Grants**
   Implement multi-seller organization management, seller onboarding, operational role assignments, and explicit storefront access grants.

7. **MR-06 Master Catalog, Listings and Media**
   Build the master catalog schema, per-storefront product publication, listing overrides, and provider-neutral media storage adapter.

8. **MR-07 Inventory, Pricing, Tax and Promotions**
   Implement shared inventory management, storefront-specific pricing engines, tax calculation contracts, and discount/coin promotion systems.

9. **MR-08 Cart, Wishlist and Checkout Quotation**
   Deliver isolated storefront carts, wishlists, server-authoritative checkout quote engines, and cart validation rules.

10. **MR-09 Separate Payment Gateways and Payment Ledger**
    Implement backend-controlled payment gateway routing (Razorpay, UPI), idempotent webhook handlers, refund handling, and ledger entries.

11. **MR-10 Orders, Fulfillment, Shipping, Returns and Refunds**
    Implement immutable order creation, multi-item fulfillment flows, shipping carrier integration webhooks, returns, and refund flows.

12. **MR-11 Seller Portal Completion**
    Finalize web and mobile seller portal applications (`apps/portals/seller`) against canonical backend APIs.

13. **MR-12 Marketplace Admin Completion**
    Finalize Marketplace Admin panel (`apps/portals/marketplace-admin`) at `admin.marketplace.zolexora.com`.

14. **MR-13 Storefront Web Completion**
    Complete Zolexora Shop (`shop.zolexora.com`) and Mahila Madel (`mahilamadel.store`) Next.js web applications.

15. **MR-14 Buyer Mobile Applications**
    Complete Zolexora Shop and Mahila Madel buyer mobile Expo React Native binaries.

16. **MR-15 Mahila Legacy-Server Retirement**
    Safely retire the transitional Express/Mongoose server (`apps/storefronts/mahila-madel/legacy-server`) after complete frontend convergence.

17. **MR-16 Independent ERP Integration Implementation**
    Implement asynchronous inbox/outbox event handlers adhering to the independent ERP contract (`contracts/zolexora-erp/v1`).

18. **MR-17 Security, Quality, Observability and Performance**
    Perform end-to-end SAST scanning, load testing, structured logging, APM metrics, and security hardening.

19. **MR-18 Container and CI Release Contract**
    Finalize production Docker container specifications, local Compose environments, and GitHub Actions CI/CD release contracts.

20. **MR-19 Marketplace Repository Release Readiness**
    Conduct final end-to-end regression validation, audit verification, and repository sign-off.

---

*Note: No phase may be started out of sequence or executed without completing its prerequisite decision gates.*
