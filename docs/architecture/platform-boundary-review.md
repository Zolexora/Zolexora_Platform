# Zolexora Platform Boundary Review

## 1. Repository Identity
The repository `Zolexora_Platform` represents the single Zolexora Platform monorepo. It is not exclusively an ERP repository, though it currently houses the ERP code.

## 2. Current Architecture
The current codebase has legacy directories like `backend/`, `branding/`, `sites/`, and `storage/` sitting at the repository root. These currently serve the existing ZolexoraERP product built on Frappe.

## 3. Target Architecture
A unified monorepo segregating cross-product Platform Core services, isolated business Products (ERP, TMS, Marketplace, etc.), Shared Packages, Clients, and Infrastructure.

## 4. Platform Core
`platform/` - Serves as the cross-product capability center. Will eventually own Identity, Organizations, Entitlements, Product Registry, Automations, Integrations, Audit, Billing, Domains, and Support.

## 5. ERP Boundary
`products/erp/` - Will eventually own the Frappe-based ERP implementation (currently mostly residing at `backend/`). The ERP boundary strictly encapsulates Accounting, Stock, Buying, Selling, and Manufacturing.

## 6. Marketplace Boundary
`products/marketplace/` - Will encapsulate Marketplace-specific operations and frontend logic.

## 7. IMS Boundary
`products/ims/` - Dedicated to Inventory Management specific logic outside ERP.

## 8. TMS Boundary
`products/tms/` - Transportation and fleet logic.

## 9. AI Boundary
`products/ai/` - Core AI services and prediction models.

## 10. Analytics Boundary
`products/analytics/` - Product for cross-platform data visualization and pipelines.

## 11. Shared Packages
`packages/` - Defines the SDKs, schema contracts, event definitions, design tokens, and shared logic that span multiple products.

## 12. Integrations
`platform/integrations/` - Coordinates APIs, events, and webhooks that enable cross-product communication without direct database writes.

## 13. Automation
`platform/automation/` - Coordinates multi-product triggers and rules. 

## 14. Identity
`platform/identity/` - Will act as the single source of truth for Users and Authentication across the Zolexora ecosystem.

## 15. Organizations
`platform/organizations/` - Represents businesses/customers, decoupling them from ERP "Companies".

## 16. Tenant Isolation
Strict logic guaranteeing one organization cannot query another organization's data across the platform boundary.

## 17. Entitlements
`platform/entitlements/` - Controls access via stable machine-readable identifiers (e.g., `erp.accounting`). 

## 18. Product Registry
`platform/product-registry/` - Maintains stable records of active product capabilities and requirements.

## 19. Billing
`platform/billing/` - Separates SaaS platform billing (subscriptions) from ERP Accounting (business ledgers).

## 20. Domains and Branding
`platform/domains/` - Manages white-labeling and domain routing independently of product entitlements.

## 21. Data Ownership
Products exclusively own their business models (e.g., ERP owns ledgers, TMS owns shipments). Platform Core owns User/Organization identities. No cross-product SQL joins.

## 22. Dependency Graph
Products -> Shared Packages -> Platform Core API boundaries.

## 23. Circular Dependency Risks
High risk if ERP directly attempts to orchestrate Platform Core while Platform Core restricts ERP logic. Must be resolved by strict API and Event-driven boundaries.

## 24. Migration Plan
1. Establish architecture placeholders (done).
2. Validate and test the conceptual boundary without breaking existing apps.
3. Gradually extract identity and organization models to `platform/`.
4. Migrate the legacy `backend/` host directory to `products/erp/backend/` once safe to do so.

## 25. Items Requiring Decision
- Final home of `backend/zolexora_branding`: Does it become `platform/domains/` or remain in ERP?
- `backend/zolexora_core`: Identifying precisely which components belong to Platform Core vs ERP overrides.

## 26. Components That Must NOT Move
- `backend/` must remain at the root temporarily to prevent breaking existing Docker and deployment scripts until the architecture fully migrates.
- `frappe-bench/` specific bindings.
