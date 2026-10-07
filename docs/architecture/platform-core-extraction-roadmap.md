# Platform Core Extraction Roadmap

**Status**: Defined
**Date**: October 2026

## Extraction Strategy
Because the Zolexora Platform relies on products built across diverse technology stacks (Frappe, FastAPI, Node.js), Platform Core extraction cannot be achieved by simply moving Python modules from `products/ZolexoraERP/backend/` to `platform/`. 

Instead, Platform Core must be built as a set of standalone microservices (or a unified platform API service) with a dedicated database. Products will then incrementally migrate to use these services.

---

### Phase 1: Platform API Contracts & Gateways
- **Objective**: Establish the internal gRPC/REST contracts for Identity and Organizations.
- **Affected Modules**: `packages/api-contracts`, `platform/platform-api`.
- **Validation**: Define the OpenApi/Protobuf schemas.

### Phase 2: Identity & Authentication
- **Objective**: Build the central Identity provider.
- **Migration Strategy**: 
  1. Build the standalone identity service in `platform/identity`.
  2. Implement OAuth2/OIDC.
  3. Migrate Frappe ERP to authenticate via the central identity (using Frappe Social Login / OAuth).
  4. Migrate FastAPI/Node.js products to validate central JWTs.
- **Risks**: Session hijacking, disruption to active ERP users.

### Phase 3: Organizations & Tenancy
- **Objective**: Centralize organization models.
- **Migration Strategy**:
  1. Create the Organization and Membership schemas in Platform Core.
  2. Map ERP's `Company` DocType to the central `Organization` ID.
  3. Update non-ERP products to inject `organization_id` into their tenant context natively.
- **Risks**: Data desync between Platform Core and ERP Company records.

### Phase 4: Product Registry & Entitlements
- **Objective**: Centralize product access control.
- **Migration Strategy**:
  1. Define all products and modules in `platform/product-registry`.
  2. Implement API Gateway level checks preventing unentitled tenants from hitting product APIs.

### Phase 5: Notifications & Audit
- **Objective**: Extract messaging and security logging.
- **Migration Strategy**:
  1. Expose `POST /internal/notifications/send`.
  2. Deprecate Frappe's direct SMTP configuration in favor of routing through Platform Core.

### Phase 6: ERP Cleanup
- **Objective**: Remove redundant functionality from ZolexoraERP.
- **Migration Strategy**:
  1. Once Identity and Notifications are fully stable, deprecate and remove legacy code from `products/ZolexoraERP/backend/zolexora_core`.
  2. Refactor `zolexora_platform` (the ERP app) to act exclusively as the ERP adapter to the true Platform Core.
