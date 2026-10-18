# Monorepo Architecture Blueprint & Reorganization Plan

**Author:** Teamwork Architecture & Monorepo Specialist (`worker_m2_1`)  
**Date:** 2026-10-18  
**Scope:** Whole-repository architectural blueprint and phased reorganization plan across `products/*`, `packages/*`, `platform/*`, `scripts/*`, `infrastructure/*`, `config/*`, `functions/*`, and root tooling manifests.  
**Execution Mode:** Proposal & Blueprint Specification (Strictly Non-Destructive; Awaiting User Approval Gate).  
**Framework:** 6-Tier Monorepo Topology, 5-Layer Dependency Hierarchy, Turbo/pnpm Workspace Pipeline, Automated 3-Tier Verification.

---

## 1. Executive Summary & Problem Statement

The Zolexora Platform monorepo has expanded to 13 distinct product domains and platform microservices. While intended as a synchronized monorepo, the repository currently functions as multiple disconnected sub-repositories co-located within a single root folder.

### Core Architectural Bottlenecks:
1. **Workspace Schizophrenia**:
   - 14 nested, conflicting lockfiles (`pnpm-lock.yaml`, `package-lock.json`) total **80,172 unmaintained lines**, bypassing the root pnpm virtual store.
   - 5 product directories contain their own nested `pnpm-workspace.yaml` files, producing pnpm configuration override warnings on every command.
2. **Package Identity Collisions & Scope Anarchy**:
   - Duplicate package identity `zolexora-tms` in both `products/zolexora-tms/package.json` and `products/zolexora-tms/apps/frontend/zolexora-tms/package.json` breaks root Turborepo invocation entirely.
   - Generic `@workspace/*` packages are defined simultaneously by both `clarityfi` and `zolexora-engage`, overwriting packages in the pnpm store.
   - Products employ 6 divergent package prefixes (`@ttc/*`, `@zas/*`, `@rent-stay/*`, `@workspace/*`, `@zolexora/*`, and unscoped names).
3. **Fragile Linking Hacks & Boundary Breaches**:
   - Products reach across workspace boundaries using relative `file:../../../../packages/api-contracts` paths instead of the pnpm `workspace:*` protocol.
   - Shared packages export raw `.ts` files directly with `tsc --noEmit` build scripts, forcing consumer applications to transpile external TypeScript in `node_modules`.
   - Spaces exist in directory paths (`platform/Authentication/Organization Auth`, `User Auth`), breaking POSIX shell scripts, Docker contexts, and CI runners.
4. **Script & Tooling Decay**:
   - 20+ scripts in `scripts/` hardcode stale PascalCase paths (`products/ZolexoraTMS/`, etc.), failing immediately on Linux ext4 case-sensitive filesystems.
   - 7 deployment scripts in `scripts/deploy/*.sh` are hollow stubs that exit with code 78 and print "not implemented".
   - Four scripts in `scripts/deploy/` were copied from an external repository `ZolexoraDeployment`, checking for `ZolexoraDeployment` and sourcing nonexistent files.
   - Developer scratch scripts with hardcoded user paths (`scripts/export-chat-md.py`, `scripts/view-chat.py`) pollute the root tools folder.
5. **Infrastructure Misplacement**:
   - The root `compose.yaml` (219 lines) is mislabeled as platform-wide infrastructure, but is exclusively an ERPNext/Frappe monolith stack mounting `erp.env`.
   - Symlinks in `infrastructure/` (`compose -> containers/compose`, `docker -> containers/docker`) create confusing path indirections.

This document establishes the authoritative **Target Architecture Blueprint**, **Boundary Rules**, **Deprecation Matrix**, **5-Stage Migration Plan**, and **3-Tier Verification Pipeline** to transform the repository into a high-performance, maintainable monorepo.

---

## 2. Target 6-Tier Monorepo Topology

To eliminate ambiguity between product boundaries, platform services, and shared libraries, the repository is organized into a clean 6-tier canonical structure:

```
/workspaces/Zolexora_Platform/
├── apps/                         # Tier 1: Platform-Wide Web Portals & Dashboards
│   ├── platform-admin/           # Platform Management Console (moved from products/platform-admin)
│   └── docs-site/                # (Optional) Unified Monorepo Documentation Portal
│
├── products/                     # Tier 2: Domain-Specific Business Products
│   ├── clarityfi/                # Fintech & Personal Finance (apps/, packages/, services/)
│   ├── maunkavach/               # Women's Safety & Emergency (apps/, services/)
│   ├── rentoeasy/                # Real Estate & Property Rental (apps/, packages/, services/)
│   ├── the-textile-care/         # Textile & Laundry Marketplace (apps/, packages/, services/)
│   ├── zolexora-ai/              # Autonomous AI Agent Engine (apps/, services/)
│   ├── zolexora-appsuite/        # Productivity & Workspace Suite (apps/, services/)
│   ├── zolexora-engage/          # Omnichannel Customer Engagement (apps/, packages/, services/)
│   ├── zolexora-erp/             # Enterprise Resource Planning Monolith (backend/, modules/)
│   ├── zolexora-ims/             # Inventory Management System (apps/, packages/, services/)
│   ├── zolexora-ironclub/        # Fitness & Gym Management (apps/, packages/, services/)
│   ├── zolexora-marketplace/     # Multivendor Commerce Platform (apps/, packages/, services/)
│   └── zolexora-tms/             # Transportation Management System (apps/, services/)
│
├── platform/                     # Tier 3: Shared Platform Foundation & Core Services
│   ├── api-shield/               # Cloudflare Edge Security & Reverse Proxy (wrangler / vitest)
│   ├── auth/                     # Unified Authentication Core (pruned of dead unreferenced packages)
│   │   ├── user-auth-firebase/   #   - Firebase Auth Provider SDK (renamed from User Auth/Firebase)
│   │   └── user-auth-core/       #   - Canonical Zolexora Auth Provider SDK (renamed from User Auth/Zolexora)
│   └── functions/                # Platform Cloud Functions (Firebase Auth triggers; moved from root /functions)
│
├── packages/                     # Tier 4: Cross-Cutting Shared Libraries (@zolexora/*)
│   ├── api-contracts/            # OpenAPI 3.1 & Canonical JSON Schema definitions
│   ├── config/                   # Unified build, lint, and runtime configurations
│   │   ├── eslint/               #   - @zolexora/eslint-config (base, react, next)
│   │   ├── tsconfig/             #   - @zolexora/tsconfig (base, react, node, next)
│   │   ├── tailwind/             #   - @zolexora/tailwind-config (Tailwind v4 tokens)
│   │   └── vite/                 #   - @zolexora/vite-config
│   ├── types/                    # Core Domain Types & DTOs (@zolexora/types)
│   ├── utils/                    # Standardized Functional Utilities (@zolexora/utils)
│   └── ui/                       # Design System & Headless UI Components (@zolexora/ui)
│
├── infrastructure/               # Tier 5: Platform Orchestration & Cloud Infrastructure
│   ├── compose/                  # Canonical Docker Compose Definitions
│   │   ├── platform-local.yaml   #   - Unified gateway & common backing stores (Postgres, Redis, Nginx)
│   │   ├── erp.yaml              #   - ERPNext/Frappe stack (moved from root compose.yaml)
│   │   └── products/             #   - Product compose definitions
│   ├── cloud/                    # Cloudflare, Supabase, Azure, Render Blueprints
│   └── nginx/                    # Global Gateway Configurations & Upstream Maps
│
├── config/                       # Tier 6: Centralized Environment Schemas & Port Allocations
│   ├── ports.json                # Canonical monorepo port registry
│   └── envs/                     # Per-product environment templates (canonical kebab-case)
│       ├── clarityfi/
│       ├── maunkavach/
│       ├── platform-admin/
│       ├── rentoeasy/
│       ├── the-textile-care/
│       ├── zolexora-ai/
│       ├── zolexora-engage/
│       ├── zolexora-erp/
│       ├── zolexora-ims/
│       ├── zolexora-ironclub/
│       ├── zolexora-marketplace/
│       └── zolexora-tms/
│
├── tools/                        # Cleaned Developer Scripts (replaces root scripts/)
│   ├── dev/                      # Local dev bootstrap, port allocators, environment doctors
│   ├── db/                       # Database migrations, seeders, schema generators
│   └── audits/                   # Code quality, security, and boundary linters
│
└── docs/                         # Canonical Architecture RFCs, Runbooks, and Audits
```

### 2.1 Upstream Git Submodule Invariant & Governance Boundary
The Zolexora Platform repository tracks three upstream external repositories as Git submodules defined in root `.gitmodules`:
- `products/zolexora-erp/backend/frappe` (url: `https://github.com/frappe/frappe.git`, branch: `version-16`)
- `products/zolexora-erp/backend/erpnext` (url: `https://github.com/frappe/erpnext.git`, branch: `version-16`)
- `products/zolexora-erp/backend/payments` (url: `https://github.com/frappe/payments.git`, branch: `version-16`)

**Strict Submodule Invariant Rules**:
1. **Immutable Tree Pointers**: The directories and internal structure inside `products/zolexora-erp/backend/{frappe,erpnext,payments}` are managed by upstream Git commit hashes and are strictly immutable from the monorepo's perspective.
2. **Zero Monorepo Relocation**: Monorepo restructuring tools, scripts, and refactoring agents must NEVER rename, move, delete, or modify files within these submodule paths.
3. **Workspace Exclusion**: Upstream submodules maintain independent Python/Node configurations (e.g., `yarn.lock`, `pyproject.toml`) and are deliberately excluded from monorepo-wide pnpm workspaces and package resolution.
4. **CI & Operational Sync**: Any checkout pipeline (including GitHub Actions `.github/workflows/platform-ci.yml`) must continue executing `git submodule update --init --recursive` to ensure submodule worktrees remain clean and pinned to their designated upstream revisions.

---

## 3. Strict 5-Layer Dependency Hierarchy & Import Rules

To prevent circular dependencies and architectural degradation, imports across the monorepo must strictly adhere to a 5-layer directed acyclic graph (DAG):

```
  Layer 5: [ Products: Apps & Portals ]  (e.g., tms-web, seller-web, dev-team)
                    │
                    ▼
  Layer 4: [ Products: Internal Packages & Local Services ] (e.g., @zolexora/tms-api, @zolexora/engage-db)
                    │
                    ▼
  Layer 3: [ Platform Services & Edge Proxies ] (e.g., @zolexora/api-shield, @zolexora/user-auth-firebase)
                    │
                    ▼
  Layer 2: [ Shared Monorepo Packages ] (e.g., @zolexora/ui, @zolexora/utils, @zolexora/api-contracts)
                    │
                    ▼
  Layer 1: [ Shared Build Configs ] (e.g., @zolexora/tsconfig, @zolexora/eslint-config)
```

### Import Boundary Rules Matrix:
| Importing Scope | Allowed To Import | FORBIDDEN To Import | Enforcement Mechanism |
|---|---|---|---|
| **`packages/*` (Layer 2)** | Other `packages/*`, external runtime dependencies | Any `products/*`, any `apps/*`, any `platform/*` | `eslint-plugin-boundaries` + `pnpm-workspace.yaml` |
| **`platform/*` (Layer 3)** | `packages/*`, external runtime dependencies | `products/*`, `apps/*` | `eslint-plugin-boundaries` |
| **`products/<product-A>`** | `packages/*`, `platform/*`, own local `products/<product-A>/*` | **`products/<product-B>/*` (STRICT: ZERO cross-product imports)** | `eslint-plugin-boundaries` + `tsconfig` path rules |
| **`infrastructure/*`** | References compose files & container definitions | Direct code imports | Static file linter |

### Monorepo Contract Rules:
1. **Mandatory `workspace:*` Protocol**: Direct relative `file:` links are strictly banned. All internal dependencies must resolve via `"@zolexora/<package>": "workspace:*"`.
2. **Build-Before-Consume Contract**: All packages in `packages/*` and `platform/*` must emit compiled ESM (`dist/index.js`) and TypeScript declarations (`dist/index.d.ts`). Consumer applications must never compile raw TypeScript from foreign `node_modules` paths.
3. **Canonical Namespace Enforcement**: Every package in the monorepo must use the `@zolexora/` namespace:
   - Shared libraries: `@zolexora/<package>` (`@zolexora/ui`, `@zolexora/types`, `@zolexora/utils`)
   - Platform services: `@zolexora/platform-<service>` (`@zolexora/platform-api-shield`, `@zolexora/platform-auth`)
   - Product packages: `@zolexora/<product>-<component>` (`@zolexora/tms-web`, `@zolexora/clarityfi-api-spec`)

---

## 4. Shared Package Specifications & Contracts

### 4.1 `@zolexora/config` (Location: `packages/config`)
Centralizes and standardizes all toolchain configurations through subpath exports:
- `@zolexora/config/eslint/base`: Strict TypeScript/JavaScript lint rules with import order enforcement.
- `@zolexora/config/eslint/react`: React 19 rules, hooks validation, accessibility (jsx-a11y).
- `@zolexora/config/eslint/next`: Next.js 16 core web vitals and SSR safety rules.
- `@zolexora/config/tsconfig/base.json`: Strict TypeScript 5.4+ baseline (`strict: true`, `target: es2022`, `skipLibCheck: true`).
- `@zolexora/config/tsconfig/react.json`: DOM typings, JSX transform (`jsx: react-jsx`).
- `@zolexora/config/tsconfig/node.json`: Node.js 20+ ESM resolution (`moduleResolution: NodeNext`).
- `@zolexora/config/tailwind`: Tailwind CSS v4 design tokens, color palette, container queries.

### 4.2 `@zolexora/types` (Location: `packages/types`)
Canonical data contracts and domain types shared across products:
- Identifiers: `TenantId`, `UserId`, `OrganizationId`, `CurrencyCode`, `ISO8601Timestamp`.
- Standard API Responses: `ApiResponse<T>`, `PaginatedResponse<T>`, `ApiErrorResponse`.
- Audit & Observability: `AuditLogEvent`, `HealthCheckResponse`, `TelemetrySpan`.

### 4.3 `@zolexora/utils` (Location: `packages/utils`)
Minimal, zero-dependency utility functions adhering strictly to standard library principles:
- `currency.ts`: Standardized INR (`₹`) formatting, paise/rupee conversion using `Intl.NumberFormat`.
- `date.ts`: Native `Intl.DateTimeFormat` wrappers for Indian Standard Time (IST) formatting.
- `validation.ts`: Standard Zod validators for GSTIN, PAN, Indian mobile numbers, and pincodes.
- `id.ts`: Canonical Crockford Base32 ID generation with `crypto.getRandomValues()` (replaces 5 duplicate copies).

### 4.4 `@zolexora/ui` (Location: `packages/ui`)
Headless, accessible UI component library built on React 19, Tailwind CSS v4, and Radix UI:
- Consolidates duplicated components from `@ttc/ui`, TMS frontend, and Marketplace UI.
- Core primitives: `Button`, `Modal`, `Dialog`, `DataTable`, `Badge`, `NotificationToast`, `Card`, `Skeleton`, `DropdownMenu`.
- Full theme switching support via CSS custom properties.

### 4.5 `@zolexora/api-contracts` (Location: `packages/api-contracts`)
Single source of truth for public and cross-service contracts:
- OpenAPI 3.1 specifications.
- Auto-generated Zod schemas for client-side and server-side validation.
- Pact and Vitest mock fixtures.

### 4.6 `@zolexora/auth` (Location: `platform/auth`)
Unified, pruned authentication foundation (dead unreferenced packages `@zolexora/organization-auth` and `@zolexora/user-auth-supabase` deleted in Stage 1 per Section 5):
- `@zolexora/user-auth-firebase` (`platform/auth/user-auth-firebase`): Firebase Auth client and server session verification (consumed by TMS).
- `@zolexora/user-auth-core` (`platform/auth/user-auth-core`): Canonical Zolexora platform authentication provider SDK (consumed by AppSuite).
- Session & Guards: JWT verification, cookie management, and Next.js 16 middleware security guards.

---

## 5. File-by-File Deprecation Matrix & Cleanup Inventory

| File / Directory Path | Current Issue | Action | Target Destination / Resolution | Risk Level |
|---|---|---|---|---|
| `scripts/deploy/deploy-platform.sh` | 7-line stub; always exits 78 with error | **DELETE** | Replaced by standardized compose & CI deployment workflows | Low |
| `scripts/deploy/backup-platform.sh` | 7-line stub; always exits 78 with error | **DELETE** | Product-specific backup handled in `products/*/scripts` | Low |
| `scripts/deploy/rollback-platform.sh` | 7-line stub; always exits 78 with error | **DELETE** | Managed via Git tags and Docker rollout | Low |
| `scripts/deploy/check-platform-health.sh` | 8-line stub; always exits 78 with error | **DELETE** | Healthchecks standard in `compose.yaml` | Low |
| `scripts/deploy/install-platform.sh` | Broken; checks for external repo `ZolexoraDeployment` and sources non-existent `core/lib/runtime.sh` | **DELETE** | Obsolete legacy artifact | Low |
| `scripts/deploy/diagnose-platform.sh` | Broken; checks for external repo `ZolexoraDeployment` | **DELETE** | Obsolete legacy artifact | Low |
| `scripts/deploy/restore-platform.sh` | Broken; checks for external repo `ZolexoraDeployment` | **DELETE** | Obsolete legacy artifact | Low |
| `scripts/deploy/verify-platform-backup.sh` | Broken; checks for external repo `ZolexoraDeployment` | **DELETE** | Obsolete legacy artifact | Low |
| `scripts/export-chat-md.py` | Antigravity internal agent chat viewer hardcoded to old brain session | **DELETE / RELOCATE** | `.agents/teamwork/tools/export-chat-md.py` | Zero |
| `scripts/view-chat.py` | Antigravity internal terminal chat viewer hardcoded to old brain session | **DELETE / RELOCATE** | `.agents/teamwork/tools/view-chat.py` | Zero |
| `scripts/ports/patch-backend-service-ports.py` | Broken; hardcodes stale PascalCase paths (`products/ZolexoraAI`, etc.) | **DELETE** | Centralized in `config/ports.json` | Medium |
| `scripts/ports/patch-frontend-dev-ports.js` | Broken; hardcodes stale PascalCase paths (`products/ZolexoraTMS`, etc.) | **DELETE** | Centralized in `config/ports.json` | Medium |
| `scripts/dev/start-all-products-dev.sh` | Broken; hardcodes PascalCase paths and corrupts pnpm state | **DELETE** | Replaced by root Turborepo dev filters | Low |
| `scripts/rento-easy/` (directory) | Inconsistent hyphen naming (`rento-easy` vs `products/rentoeasy`) | **MOVE & MERGE** | `products/rentoeasy/scripts/` | Low |
| `scripts/textile-care/` (directory) | Inconsistent naming (`textile-care` vs `the-textile-care`); broken path | **MOVE & FIX** | `products/the-textile-care/scripts/` | Low |
| `scripts/zolexora-tms/start-docker.sh` | Exact duplicate of `products/zolexora-tms/scripts/docker-start.sh` | **CONSOLIDATE** | Maintain canonical `products/zolexora-tms/scripts/docker-start.sh` | Low |
| `scripts/zolexora-tms/start-local.sh` | Contains dead Bitwarden `bw` and `dotenvx` unlock routine | **CLEAN** | Refactor to use Infisical CLI fallback like `docker-start.sh` | Low |
| `compose.yaml` (root) | Monolith Frappe/ERP compose file mislabeled as monorepo root compose | **RELOCATE** | `infrastructure/compose/erp.yaml` | Medium |
| `infrastructure/compose` (symlink) | Symlink to `containers/compose` | **REMOVE SYMLINK** | Consolidate directly into `infrastructure/compose/` | Low |
| `infrastructure/docker` (symlink) | Symlink to `containers/docker` | **REMOVE SYMLINK** | Consolidate directly into `infrastructure/docker/` | Low |
| `infrastructure/supabase/migrations` (symlink) | Legacy symlink pointing to `../database/migrations` | **REMOVE SYMLINK** | Consolidate migrations canonically into `infrastructure/supabase/migrations/` | Low |
| `products/the-textile-care/platform/*` | Empty directories with READMEs (`customization`, `white-label`) | **PRUNE** | Remove empty directories; document in product README | Zero |
| `platform/Authentication/Organization Auth` | Directory name contains whitespace; 0 importers in monorepo | **DELETE** | Dead package (210 lines); delete completely | Low |
| `platform/Authentication/User Auth/Supabase` | Directory name contains whitespace; 0 importers in monorepo | **DELETE** | Dead package (218 lines); delete completely | Low |
| `platform/Authentication/User Auth/Firebase` | Directory name contains whitespace | **RENAME** | `platform/auth/user-auth-firebase` | Medium |
| `platform/Authentication/User Auth/Zolexora` | Directory name contains whitespace | **RENAME** | `platform/auth/user-auth-core` | Medium |
| `functions/` (root) | Firebase functions package sitting at root | **RELOCATE** | `platform/functions/` | Medium |
| `functions/src/state-machine.ts` | 100% byte-for-byte duplicate of Firebase auth state machine | **DELETE** | Import directly from `@zolexora/user-auth-firebase` | Low |
| `products/zolexora-tms/apps/backend/app/db/*.sql` (3 files) | Dead SQL dumps superseded by Alembic migrations | **DELETE** | Delete 3 unreferenced SQL files (-437 lines) | Low |
| `products/the-textile-care/backend/app/repositories/*` (17 files) | Single-caller boilerplate repositories wrapping 1-line queries | **YAGNI PRUNE** | Collapse into direct service queries (-1,500 lines) | Medium |
| `products/zolexora-marketplace/services/marketplace-api/payment_orchestration/ports.py` | Speculative `PaymentProviderAdapter` ABC with 0 production implementations | **DELETE** | Remove until second provider is implemented | Low |
| `products/the-textile-care/packages/*` (7 packages) | 7 micro-packages for single product with 14 config files | **CONSOLIDATE** | Consolidate into `@zolexora/ttc-shared` | Medium |
| 14 nested lockfiles | Conflicting local lockfiles causing phantom resolution | **DELETE** | Remove all 14 files; root `pnpm-lock.yaml` is canonical (-80,172 lines) | High |
| 5 nested `pnpm-workspace.yaml` | Conflicting workspace overrides and warnings | **DELETE** | Remove all 5 files; single root `pnpm-workspace.yaml` | Medium |

---

## 6. Phased 5-Stage Migration Plan

To guarantee zero regressions, uninterrupted local development, and continuous verification, the migration is structured into 5 sequential stages:

```
[Stage 0: Baseline & Guardrails]
           │ (Git clean, baseline tests pass, hashes snapshotted)
           ▼
[Stage 1: High-Confidence Dead Code & Script Pruning]
           │ (Delete dead deploy stubs, chat scripts, empty directories)
           ▼
[Stage 2: Package Extraction & Namespace Normalization]
           │ (Rename @workspace/*, resolve collisions, standardize @zolexora/*)
           ▼
[Stage 3: Directory Restructuring & Path Normalization]
           │ (Eliminate folder spaces, flatten nested frontend dirs, relocate ERP compose)
           ▼
[Stage 4: Build System & Workspace Optimization]
           │ (Single root pnpm lockfile, Turborepo pipelines, shared tsconfig/eslint)
           ▼
[Validation: 100% CI & Monorepo Health Verification]
```

### Stage 0: Baseline & Guardrails
- **Objective**: Establish automated test baselines and git branch hygiene prior to modifying files.
- **Action Items**:
  1. Create a dedicated refactoring branch: `git checkout -b refactor/monorepo-reorganization`.
  2. Run baseline verification across all healthy test engines:
     - `pnpm -r ls --depth -1` (confirm clean workspace resolution).
     - `pnpm vitest run platform/` (confirm 44/44 unit tests pass).
     - `python3 tests/e2e/tms/run_all.py` (confirm 82/82 E2E tests pass in offline static fallback mode).
     - Build TMS frontends: `pnpm --filter zolexora-tms-admin build`, `pnpm --filter ./products/zolexora-tms/apps/frontend/zolexora-tms build`.
  3. Snapshot repository state and verify clean working tree.
  4. Verify upstream Git submodules via `git submodule status`: Confirm `products/zolexora-erp/backend/{frappe,erpnext,payments}` are initialized and clean; enforce submodule immutability boundary.

### Stage 1: High-Confidence Dead Code & Script Pruning
- **Objective**: Remove verified dead code, fake script stubs, and empty scaffolding that cannot affect running systems.
- **Action Items**:
  1. Delete 7 fake deployment script stubs in `scripts/deploy/*.sh` (`deploy-platform.sh`, `backup-platform.sh`, `rollback-platform.sh`, `check-platform-health.sh`, etc.).
  2. Delete 4 broken external `ZolexoraDeployment` scripts in `scripts/deploy/`. Remove empty `scripts/deploy/` directory.
  3. Delete or relocate personal scratch chat viewers (`scripts/export-chat-md.py`, `scripts/view-chat.py`).
  4. Delete empty placeholder directories in `products/the-textile-care/platform/` (`customization/`, `white-label/`).
  5. Delete 3 unreferenced SQL dump files in `products/zolexora-tms/apps/backend/app/db/` (`d1_tenant_schema.sql`, `v2_booking_lifecycle.sql`, `v3_tenant_business_schema.sql`).
  6. Delete duplicate file `functions/src/state-machine.ts` and update imports to reference Firebase user auth.
  7. Delete dead unreferenced auth packages: `platform/Authentication/Organization Auth` and `platform/Authentication/User Auth/Supabase`.
  8. Purge committed compiler caches and untracked bytecode: Execute `git rm --cached` on the 3 tracked `tsconfig.tsbuildinfo` files in `products/the-textile-care/apps/` (`admin-web`, `marketplace-web`, `seller-web`), add `*.tsbuildinfo` to root `.gitignore`, and delete local untracked `.pyc` artifacts on disk.
  9. Remove legacy symlinks in `infrastructure/` (`compose -> containers/compose`, `docker -> containers/docker`, and `supabase/migrations -> ../database/migrations`); consolidate canonical migration directory directly in `infrastructure/supabase/migrations/`.
  10. Synchronize `.github/workflows/platform-ci.yml` static validation paths: Update documentation test paths (lines 40-44: `test -f docs/...`) and shell syntax checks (line 33: `bash -n scripts/*.sh`) to reflect pruned script stubs and documentation consolidation.

### Stage 2: Package Extraction & Namespace Normalization
- **Objective**: Disambiguate package name collisions, standardize all packages under `@zolexora/*`, and update all internal source code import specifiers.
- **Action Items**:
  1. Disambiguate `@workspace/*` collision & Synchronize Consumer Imports:
     - **Package Manifest Renames**:
       - In `clarityfi`: Rename `@workspace/*` -> `@zolexora/clarityfi-*` (`@zolexora/clarityfi-api-spec`, `@zolexora/clarityfi-api-client-react`, `@zolexora/clarityfi-api-zod`, `@zolexora/clarityfi-db`).
       - In `zolexora-engage`: Rename generic `@workspace/*` packages (`@workspace/api-spec`, `@workspace/api-client-react`, `@workspace/api-zod`, `@workspace/db`) -> `@zolexora/engage-*` (`@zolexora/engage-api-spec`, `@zolexora/engage-api-client-react`, etc.), and rename apps `@workspace/client-web` -> `@zolexora/engage-web` and `@workspace/api-server` -> `@zolexora/engage-api-server`.
       - Fix Orval codegen configuration in `products/clarityfi/packages/api-spec/orval.config.ts` (correct invalid `lib/` path references to `packages/`).
     - **Mandatory Consumer Source Code Import Updates**:
       - Renaming packages in `package.json` must be atomically coupled with updating all source code import specifiers across consumer applications (e.g., `import ... from "@workspace/api-zod"` -> `import ... from "@zolexora/clarityfi-api-zod"` in `products/clarityfi/apps/api-server/src/routes/health.ts:2`; `import ... from "@workspace/api-client-react"` -> `import ... from "@zolexora/engage-api-client-react"` in `products/zolexora-engage/artifacts/client/web/src/features/dispatch/DispatchPage.tsx:5`).
       - Run automated AST / regex codemod across all consumer codebases to verify 0 dangling `@workspace/*` import specifiers remain.
       - Update Dockerfile build targets (`RUN pnpm --filter "@zolexora/engage-api-server" build`).
  2. Disambiguate `zolexora-tms` collision:
     - Root product container: `"name": "@zolexora/tms-product"`.
     - Frontend core app: `"name": "@zolexora/tms-web"`.
     - Admin app: `"name": "@zolexora/tms-admin"`.
     - Eliminates the root Turborepo invocation collision crash.
  3. Normalize other product scopes:
     - Rentoeasy: `@rent-stay/*` -> `@zolexora/rentoeasy-*`.
     - The Textile Care: `@ttc/*` -> `@zolexora/ttc-*`.
     - Zolexora AI: `swarm-factory-*` -> `@zolexora/ai-*`.
  4. Replace fragile `file:../../../../packages/api-contracts` links in `rentoeasy` and `the-textile-care` with `"@zolexora/api-contracts": "workspace:*"`.
  5. DAG Layer 2 Decoupling: Extract canonical `generateZolexoraId` and shared state machine definitions into `@zolexora/api-contracts` / `@zolexora/utils` (Layer 2) so that `platform/functions` does not violate DAG layering by importing directly from `platform/auth/user-auth-firebase` (Layer 3).

### Stage 3: Directory Restructuring & Path Normalization
- **Objective**: Eliminate directory whitespace, flatten nested frontend layouts, synchronize container builds, and relocate misplaced root files without breaking CI.
- **Action Items**:
  1. Rename whitespace paths in `platform/`:
     - `platform/Authentication/User Auth/Firebase` -> `platform/auth/user-auth-firebase`
     - `platform/Authentication/User Auth/Zolexora` -> `platform/auth/user-auth-core`
     - Update all import references in `products/zolexora-appsuite` (`apps/client`, `apps/dev-team`, `apps/backend`).
  2. Normalize `zolexora-tms` frontend structure & Docker/Compose synchronization:
     - Flatten `products/zolexora-tms/apps/frontend/zolexora-tms` -> `products/zolexora-tms/apps/tms-web`.
     - Flatten `products/zolexora-tms/apps/frontend/tms-admin` -> `products/zolexora-tms/apps/tms-admin`.
     - Remove empty `products/zolexora-tms/apps/frontend` parent folder.
     - **Synchronize `products/zolexora-tms/Dockerfile.web`**:
       - Line 1: Update default build arg: `ARG APP_PATH=apps/tms-web`.
       - Line 8: Remove reference to deleted nested `pnpm-workspace.yaml`: `COPY products/zolexora-tms/package.json ./`.
       - Line 9: Update Firebase auth source path from whitespace path: `COPY ["platform/auth/user-auth-firebase", "./platform/auth/user-auth-firebase"]`.
       - Line 10: Update flattened apps directory: `COPY products/zolexora-tms/apps ./apps`.
     - **Synchronize `products/zolexora-tms/compose.yaml`**:
       - Line 64 (`tms-web` service build arg): Update `APP_PATH: apps/tms-web`.
       - Line 95 (`tms-admin` service build arg): Update `APP_PATH: apps/tms-admin`.
     - Update TMS Nginx configs (`products/zolexora-tms/nginx-web.conf`) and dev scripts to point to `apps/tms-web` and `apps/tms-admin`.
  3. Normalize `zolexora-engage` structure:
     - `artifacts/client/web` -> `apps/web`
     - `artifacts/api-server` -> `services/api`
     - `lib/*` -> `packages/*`
  4. Relocate root `compose.yaml` & Synchronize Live CI Workflows:
     - Move root `compose.yaml` (ERPNext/Frappe monolith stack) to `infrastructure/compose/erp.yaml`.
     - **Synchronize `.github/workflows/platform-ci.yml`**:
       - Update lines 69, 71, 80, 82, 83: Replace `docker compose -f compose.yaml ...` with `docker compose -f infrastructure/compose/erp.yaml ...` (or maintain a root `compose.yaml` alias).
       - Update lines 73, 75, 77, 93, 98, 100: Update ERP site scripts (`./scripts/zolexora-erp/*`) to their canonical relocated destinations (`products/zolexora-erp/scripts/*` or `tools/erp/*`).
  5. Relocate root `functions/`:
     - Move root `functions/` to `platform/functions/`.
  6. Relocate `products/platform-admin` -> `apps/platform-admin`.
  7. Enforce Git Submodule Invariant for ERPNext/Frappe:
     - Verify that `products/zolexora-erp/backend/{frappe,erpnext,payments}` remain strictly untouched during directory reorganization. Under no circumstances should automated refactoring alter or relocate files inside these submodules.

### Stage 4: Build System & Workspace Optimization
- **Objective**: Unify the monorepo under a single canonical lockfile and high-performance Turborepo caching pipeline.
- **Action Items**:
  1. Delete all 14 nested lockfiles and all 5 nested `pnpm-workspace.yaml` files.
  2. Update root `pnpm-workspace.yaml` with clean, standard patterns:
     ```yaml
     packages:
       - 'apps/*'
       - 'products/*/apps/*'
       - 'products/*/packages/*'
       - 'products/*/services/*'
       - 'platform/*'
       - 'platform/auth/*'
       - 'packages/*'
     ```
  3. Add root `tsconfig.json` with TypeScript 5.4+ project references pointing to all workspace packages.
  4. Configure root `package.json` with universal Turborepo scripts:
     ```json
     "scripts": {
       "build": "turbo run build",
       "test": "turbo run test",
       "lint": "turbo run lint",
       "typecheck": "turbo run typecheck",
       "clean": "turbo run clean && pnpm -r exec rm -rf node_modules dist .turbo"
     }
     ```
  5. Configure root `turbo.json` with task pipelines, inputs, outputs (`dist/**`, `.next/**`, `build/**`), and dependency caching.
  6. Execute `pnpm install` from the repository root to create a single, unified canonical `pnpm-lock.yaml`.
  7. Configure React Native & Expo Metro Monorepo Hoisting Resolution:
     - Mobile applications in `products/clarityfi/apps/mobile`, `products/zolexora-marketplace/apps/*`, and `products/the-textile-care/apps/*-mobile` utilize Metro bundlers that default to local directory resolution (`getDefaultConfig(__dirname)`).
     - Under a unified root pnpm store, dependencies and shared workspace packages (`@zolexora/api-contracts`, `@zolexora/ui`) reside in root `node_modules/.pnpm`.
     - Update all mobile `metro.config.js` files to include monorepo root in `watchFolders` and configure `nodeModulesPaths`:
       ```javascript
       const { getDefaultConfig } = require("expo/metro-config");
       const path = require("path");

       const projectRoot = __dirname;
       const monorepoRoot = path.resolve(projectRoot, "../../../");

       const config = getDefaultConfig(projectRoot);
       config.watchFolders = [monorepoRoot];
       config.resolver.nodeModulesPaths = [
         path.resolve(projectRoot, "node_modules"),
         path.resolve(monorepoRoot, "node_modules"),
       ];
       config.resolver.disableHierarchicalLookup = false;

       module.exports = config;
       ```
  8. Synchronize the 10 Dockerfiles Copying Nested Lockfiles:
     - Exactly 10 Dockerfiles in the monorepo currently contain explicit `COPY` statements targeting nested lockfiles that are removed in Stage 4:
       1. `products/clarityfi/Dockerfile.api:8` (`COPY products/clarityfi/pnpm-lock.yaml ./pnpm-lock.yaml`)
       2. `products/rentoeasy/Dockerfile.api:6` (`COPY products/rentoeasy/pnpm-lock.yaml ./pnpm-lock.yaml`)
       3. `products/rentoeasy/Dockerfile.web:5` (`COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./`)
       4. `products/the-textile-care/infrastructure/Dockerfile.nextjs:6` (`COPY products/the-textile-care/pnpm-lock.yaml ./pnpm-lock.yaml`)
       5. `products/the-textile-care/apps/admin-web/Dockerfile:7` (`COPY products/TheTextileCare/...`)
       6. `products/the-textile-care/apps/marketplace-web/Dockerfile:8` (`COPY products/TheTextileCare/...`)
       7. `products/the-textile-care/apps/seller-web/Dockerfile:7` (`COPY products/TheTextileCare/...`)
       8. `products/the-textile-care/apps/driver-mobile/Dockerfile:5` (`COPY products/TheTextileCare/...`)
       9. `products/the-textile-care/apps/marketplace-mobile/Dockerfile:8` (`COPY products/TheTextileCare/...`)
       10. `products/the-textile-care/apps/seller-mobile/Dockerfile:5` (`COPY products/TheTextileCare/...`)
       (Additionally, `products/zolexora-engage/Dockerfile.api:6` and `Dockerfile.web:6` copy local `pnpm-lock.yaml`).
     - **Synchronization Strategy**:
       - Update each Dockerfile to copy the canonical root `pnpm-lock.yaml` and root `pnpm-workspace.yaml` alongside the target package manifest, or leverage `pnpm --filter <pkg> deploy --prod /out` workspace packaging.
       - Synchronize CI cache dependency paths in `.github/workflows/maun-kavach-ci.yml`, `the-textile-care-ci.yml`, `the-textile-care-web.yml`, `zolexora-ai-e2e.yml`, and `zolexora-ai-nightlytests.yml` to reference canonical root `pnpm-lock.yaml`.

---

## 7. Pre-Existing Typecheck Clusters, Guardrails & 3-Tier Verification Pipeline

### 7.1 Pre-Existing TypeScript Error Clusters & Name Collision Guardrails
Forensic analysis confirms four pre-existing TypeScript compilation error clusters across the monorepo, as well as a package name collision hazard that must be guarded against:

1. **Cluster 1 (`products/rentoeasy/apps/web-admin`)**:
   - `npx tsc --noEmit` fails with exit code 2, emitting 56 errors across 6 files with `TS2786: '...' cannot be used as a JSX component. Type 'bigint' is not assignable to type 'ReactNode'`.
   - *Root Cause*: Monorepo root `package.json` pnpm override forces `@types/react@19.3.0` onto React 18 component libraries (`lucide-react`, `@radix-ui/*`).
2. **Cluster 2 (`products/the-textile-care/apps/admin-web`)**:
   - `npx tsc --noEmit` fails with exit code 1, emitting 2 errors with `TS2742: The inferred type of 'RootLayout' cannot be named without a reference to '.pnpm/@types+react@19.3.0...'`.
3. **Cluster 3 (`products/the-textile-care/apps/marketplace-web`)**:
   - `npx tsc --noEmit` fails with exit code 1, emitting 52 errors across 14 files with `TS2786: 'Link' cannot be used as a JSX component` from `next/link`.
4. **Cluster 4 (`products/zolexora-engage/artifacts/api-server`)**:
   - `npx tsc --noEmit` fails with exit code 1, emitting 2 errors with `TS6305: Output file '.../lib/api-zod/dist/index.d.ts' has not been built from source file` due to composite project build ordering.
5. **Package Name Collision Hazard (`zolexora-tms`)**:
   - Because `products/zolexora-tms/package.json` and `products/zolexora-tms/apps/frontend/zolexora-tms/package.json` share the identical package name `zolexora-tms`, running `pnpm --filter zolexora-tms exec tsc --noEmit` matches both packages and fails with exit code 254 (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "tsc" not found` in product root).
   - *Guardrail*: Tier 2 typechecking MUST use path-scoped filter `pnpm --filter ./products/zolexora-tms/apps/frontend/zolexora-tms exec tsc --noEmit` (which succeeds cleanly with exit code 0) until Stage 2 disambiguates the packages to `@zolexora/tms-product` and `@zolexora/tms-web`.

### 7.2 Offline E2E Runner Qualification
- `python3 tests/e2e/tms/run_all.py` gracefully degrades into **static inspection fallback mode** when TMS Docker containers (`tms-postgres`, `tms-backend`, `tms-web`, `tms-admin`, `tms-nginx`) are offline.
- In offline mode, the suite validates 82 test cases across Tiers 1-4 via AST/string checks on backend route definitions and compose YAML configurations, while skipping 5 live network attack vectors in Tier 5.
- To execute **100% live verification** (including live container health and Tier 5 network security attack domains), the TMS container stack must be booted prior to running the test suite (`bash products/zolexora-tms/scripts/docker-start.sh`).

### 7.3 Automated 3-Tier Verification Pipeline

```
================================================================================
                    AUTOMATED MONOREPO VERIFICATION PIPELINE
================================================================================

Tier 1: Fast Smoke & Invariant Gate (< 10 seconds)
  1. Workspace Integrity:      pnpm -r ls --depth -1
  2. Platform Unit Tests:      pnpm vitest run platform/
  3. TMS E2E Suite:            python3 tests/e2e/tms/run_all.py (82/82 offline static / live)
  Target: 100% Pass (0 errors, 44 Vitest tests + 82 E2E tests = 126 tests)

Tier 2: Domain-Scoped Typecheck Gate (< 15 seconds)
  1. Platform Auth & APIs:     pnpm --filter "@zolexora/user-auth-*" --filter "@zolexora/api-*" exec tsc --noEmit
  2. TMS Admin Frontend:       pnpm --filter zolexora-tms-admin exec tsc --noEmit
  3. TMS Core Web Frontend:    pnpm --filter ./products/zolexora-tms/apps/frontend/zolexora-tms exec tsc --noEmit
  4. Ironclub Web & Types:     pnpm --filter "@zolexora/ironclub-*" exec tsc --noEmit
  Target: 0 TypeScript compilation errors in active codebases (respecting known pre-existing clusters)

Tier 3: Production Build & Bundle Gate (< 30 seconds)
  1. TMS Admin Frontend:       pnpm --filter zolexora-tms-admin run build
  2. TMS Core Frontend:        pnpm --filter ./products/zolexora-tms/apps/frontend/zolexora-tms run build
  3. Ironclub Suite:           pnpm --filter "@zolexora/ironclub-*" build
  4. Cloud Functions:          pnpm --filter @zolexora/auth-functions build
  Target: Distribution artifacts emitted cleanly in dist/ / build/
================================================================================
```

### Monorepo Hygiene Verification Commands:
```bash
# 1. Verify pnpm workspace detects all packages cleanly with zero duplicate name warnings:
pnpm -r ls --depth -1

# 2. Verify no remaining spaces in directory names:
find platform products packages apps -name "* *" -type d

# 3. Verify no remaining "file:" relative package linking:
grep -rn '"file:' products/ packages/ platform/ apps/ package.json 2>/dev/null | grep package.json

# 4. Verify no broken PascalCase paths remaining in scripts:
grep -rnE "products/(Zolexora|TheTextileCare|ClarityFi|MaunKavach|RentoEasy)" scripts/ 2>/dev/null

# 5. Verify no untracked nested lockfiles exist:
find . \( -name node_modules -o -name .git -o -name .venv \) -prune -o \( -name "pnpm-lock.yaml" -o -name "package-lock.json" \) -not -path "./pnpm-lock.yaml" -print
```

---

## 8. Governance & User Approval Gate

In strict adherence to the project integrity mandate and user execution protocol:
1. **Current State:** Both `docs/PONYTAIL_AUDIT.md` and `docs/REORGANIZATION_PLAN.md` are completely drafted and verified against existing repository state.
2. **Read-Only Invariant:** No source files, package manifests, scripts, or directories have been modified, deleted, or relocated.
3. **Execution Gate:** Stage 1 through Stage 4 of this Reorganization Plan will only be executed after formal review and approval by the user.
