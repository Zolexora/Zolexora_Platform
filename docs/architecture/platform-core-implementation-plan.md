# Platform Core Implementation Plan (Phase C)

## 1. What will be built
A neutral, dependency-free TypeScript library defining the canonical API Contracts for the entire platform:
* `ApiResponse<T>`
* `PaginatedResponse<T>`
* `ApiError`
* `HealthStatus`

## 2. Where it will live
`packages/api-contracts`
We are establishing `packages/` as the root for language-specific shared libraries. This is a **SHARED CONTRACT**, not a running service.

## 3. Why it lives there
It represents a genuine cross-product boundary. By placing it in the root `packages/`, it is accessible to all monorepo products (RentoEasy, TheTextileCare, Marketplace) without requiring them to import from each other's internal `src` directories.

## 4. Who consumes it
First migration targets:
1. `products/RentoEasy/packages/shared-types`
2. `products/TheTextileCare/packages/types`

## 5. Migration Strategy
1. Create `packages/api-contracts/package.json` and TypeScript source.
2. Update `products/RentoEasy/packages/shared-types/package.json` to depend on the new `@zolexora/api-contracts`.
3. Refactor `products/RentoEasy/packages/shared-types/src/index.ts` to export the types from the core package rather than defining them locally.
4. Verify RentoEasy compiles.
5. Repeat for `TheTextileCare`.
6. Once proven, remove the duplicated local definitions entirely.

## 6. Rollback
If the extraction breaks typescript compilation for RentoEasy, we simply remove the dependency in `package.json` and restore the local interface definitions.
