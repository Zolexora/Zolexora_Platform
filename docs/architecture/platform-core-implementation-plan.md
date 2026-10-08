# Platform Core Implementation Plan

## Phase C: Initial Extraction
Built a neutral, dependency-free TypeScript library defining the canonical API Contracts for the entire platform:
* `ApiResponse<T>`
* `PaginatedResponse<T>`
* `ApiError`
* `HealthStatus`

Lived in `packages/api-contracts` to be accessible to all monorepo products without requiring them to import from each other's internal `src` directories.

## Phase E: Contract Hardening and Scope Audit
* **Status:** COMPLETED
* Validated that `ApiResponse<T>`, `PaginatedResponse<T>`, `ApiError`, and `HealthStatus` in `packages/api-contracts` cover cross-product contract requirements.
* Confirmed that product-specific business entities remain owned by individual products and do not require speculative extraction.

## Phase F & G: CI/CD, Docker Validation, and Repository Reconciliation
* **Status:** COMPLETED (ACCEPTED WITH DOCUMENTED LIMITATIONS)
* **Turborepo Workspace Discovery Resolution:**
  * Including `../../packages/*` in product `pnpm-workspace.yaml` files triggers a fatal Turborepo error (`Workspace package resolves outside repository root`).
  * Enforced pattern: Products keep clean, isolated `pnpm-workspace.yaml` files and consume the shared package strictly via `"@zolexora/api-contracts": "file:../../../../packages/api-contracts"` in their local `package.json`.
* **Clean Install & Typecheck Results:**
  * `packages/api-contracts`: PASS (`tsc --noEmit`)
  * `products/RentoEasy`: PASS (`turbo run type-check` across 6 packages)
  * `products/TheTextileCare`: PASS (`turbo run typecheck` across 13 packages)
  * `products/ZolexoraEngage`: PASS (`tsc --build` and typecheck across all workspace projects)
* **Docker Build Context Constraint:**
  * When a product Dockerfile (e.g. `products/TheTextileCare/apps/admin-web/Dockerfile`) is built with the product directory as the Docker build context, `pnpm install` cannot resolve `file:../../../../packages/api-contracts` outside the build context (`ENOENT: scandir '/packages/api-contracts'`).
  * Requirement: Docker builds targeting products with `file:` dependencies must either use the repository root as the build context and COPY `packages/api-contracts`, or vendor/stage the package into the build context prior to containerization.
* **Architectural Decision:**
  * **ACCEPT WITH DOCUMENTED LIMITATIONS**: The file-based dependency model is reproducible and operational for local development, clean checkouts, and CI typechecking. Docker builds require root context awareness.

