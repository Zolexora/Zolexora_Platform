# Platform API Contract Analysis

**Date:** 2026-10-08
**Status:** EXTRACTION CANDIDATE CONFIRMED

## 1. Overview of Implementations
Several products have independently created internal API specification packages:
1. `products/ClarityFi/packages/api-spec` (OpenAPI)
2. `products/ZolexoraEngage/lib/api-spec` (OpenAPI)
3. `products/TheTextileCare/packages/types` (TypeScript)
4. `products/RentoEasy/packages/shared-types` (TypeScript)

## 2. Comparison of Contracts

By deeply inspecting the generated `types` and `openapi.yaml` files, the following identical patterns emerged:

### Identical / Highly Similar Abstractions:
* **`ApiResponse<T>` / `HealthStatus`**: Every product wraps successes in a generic data envelope and requires a health-check schema.
* **`PaginatedResponse<T>`**: Pagination (page, limit, total) is uniformly structured across RentoEasy and TheTextileCare.
* **`ApiError` / `ErrorResponse`**: Standardized error envelopes (`statusCode`, `message`, `error`) appear in both Python and Node.js products.
* **`AuthTokens`**: Standard definitions for `accessToken`, `refreshToken`, and `expiresIn`.

## 3. Analysis

The duplication here is structural and language-agnostic. 
Because `RentoEasy` and `TheTextileCare` both manually maintain identical TypeScript representations of these envelopes, and `ClarityFi`/`ZolexoraEngage` maintain OpenAPI schemas of the same envelopes, this is a **prime candidate for the first Platform Core extraction.**

## 4. Proposed First Extraction
We will create:
`packages/api-contracts/` (or `platform/api-contracts/`)

This package will act as the canonical source for:
1. `ApiResponse<T>`
2. `PaginatedResponse<T>`
3. `ApiError`
4. `HealthStatus`

It will have zero dependencies on any product and will be published as a pure, product-neutral TypeScript definition library, establishing the first true Platform Core contract.
