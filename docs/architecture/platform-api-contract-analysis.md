# Platform API Contract Analysis

## Contract Inventory
1. **ApiResponse<T>**
   - **Purpose:** Standard JSON envelope for successful API responses.
   - **Consumers:** RentoEasy, TheTextileCare
   - **Status:** Hardened

2. **PaginatedResponse<T>**
   - **Purpose:** Standard envelope for paginated lists.
   - **Consumers:** RentoEasy, TheTextileCare
   - **Status:** Hardened

3. **ApiError**
   - **Purpose:** Standard error payload structure.
   - **Consumers:** RentoEasy, TheTextileCare
   - **Status:** Hardened

4. **HealthStatus**
   - **Purpose:** String literal type for service health (`'ok' | 'degraded' | 'error'`).
   - **Consumers:** RentoEasy, TheTextileCare, ZolexoraEngage
   - **Status:** Hardened

## Versioning and Evolution Strategy
* **Locality:** `@zolexora/api-contracts` is consumed via local `file:` linking.
* **Evolution:** Because changes instantly propagate to all consumers during local development and CI, any breaking change to the contracts MUST be resolved atomically in the same commit/PR for all consuming products.
* **No Publishing:** The package is marked `"private": true` and will NOT be published to npm.

## Extraction Criteria
We will NOT extract additional contracts (like `Address` or `User`) if they represent business data or if they conflict across products (e.g., TheTextileCare's pagination uses `offset/limit` while api-contracts uses `page/limit`). Only true, purely semantic cross-product agreements belong here.
