# Code Reuse Map

**Date:** 2026-10-08
**Project:** Zolexora_Platform
**Scope:** Stage A Architecture Audit

## Current State of Reuse
The deep code scan reveals that code reuse in the Zolexora_Platform monorepo is currently localized and product-specific, rather than global.

1. **ERP Monolith (`products/ZolexoraERP/`)**:
   - Acts as a heavy gravitational center. Business logic is shared internally across Frappe applications (`zolexora_core`, `zolexora_platform`, `erpnext`).
   - Does not export standard libraries for other products to consume easily.

2. **Localized Shared Packages**:
   - `products/ZolexoraMarketplace/packages/shared-api`: Successfully implements code reuse, but isolates it *within* the marketplace product boundary.
   - `products/ZolexoraMarketplace/packages/shared-config`: Internal configuration reuse.

3. **Duplicated Tooling (Potential Smells)**:
   - Multiple products implement their own authentication, database adapters, and Docker configurations (`ims`, `thetextilecare`, `tms` all have independent FastApi/Python setups with similar `db.py`, `auth.py`, `models.py`).

## Failed Reuse Mechanisms
- **`platform/`**: Empty. Was intended to hold shared microservices, but developers built services inside the products instead.
- **`packages/` (root)**: Empty. Was intended to hold global DTOs, API contracts, and Auth adapters.

## Future Reuse Strategy (Platform Core Design)

When Stage C (Platform Core Extraction) begins, reuse should be driven from the bottom up based on actual duplication identified in this audit, not top-down theory.

### Phase 1 Targets for Global Extraction (When Needed)
1. **API Contracts / Schemas**: Extract the schemas currently duplicated between `products/ZolexoraMarketplace/packages/shared-api` and `products/TheTextileCare/backend/app/schemas/` into a root `packages/api-contracts` or `packages/schemas`.
2. **Authentication Middleware**: The logic in `products/ZolexoraIMS/apps/ims-user/backend/auth.py` and `products/TheTextileCare/backend/app/core/security/auth.py` (both FastAPI) are prime candidates for a shared `packages/python-auth-core`.
3. **Database Core (Python)**: Shared SQLAlchemy or D1 adapters that multiple Python-based products are currently rewriting independently.

### Principle
**Rule of Three**: Code will only be moved to a root `packages/` or `platform/` directory when three different products require the exact same logic. Until then, duplication is cheaper than the wrong abstraction.
