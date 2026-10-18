# Monorepo Architecture Blueprint & Reorganization Plan
**Agent Role:** Monorepo Architecture Specialist (Explorer Subagent)  
**Location:** `/workspaces/Zolexora_Platform/.agents/teamwork/explorer_m1_2/handoff.md`  
**Execution Mode:** Read-Only Analysis & Architecture Design  
**Date:** 2026-10-18  

---

## 1. Observation

### 1.1 Root Topology & Workspace Manifests
Direct inspection of root configuration manifests revealed severe fragmentation in workspace tracking and package management:
1. **Root `package.json`** (`/workspaces/Zolexora_Platform/package.json`):
   - Package manager is pinned to `pnpm@9.12.3` (Line 4).
   - Contains ONLY isolated product dev scripts for `@zas/*` (AppSuite), `zolexora-tms`, and `@zolexora/ironclub-*` (Lines 6–29).
   - **Crucially missing**: Standard monorepo lifecycle scripts (`build`, `test`, `lint`, `typecheck`, `clean`). No scripts exist for 10 out of the 13 products (`clarityfi`, `maunkavach`, `platform-admin`, `rentoeasy`, `the-textile-care`, `zolexora-ai`, `zolexora-engage`, `zolexora-erp`, `zolexora-ims`, `zolexora-marketplace`).
   - Missing root `tsconfig.json` at repository root.
2. **Root `pnpm-workspace.yaml`** (`/workspaces/Zolexora_Platform/pnpm-workspace.yaml`):
   - Contains 26 glob patterns, including:
     - Line 5: `'platform/Authentication/User Auth/*'` (contains spaces in directory names).
     - Lines 9–10: Duplicate entries for `'products/zolexora-engage/apps/*'`.
     - Line 19: `'products/the-textile-care/platform/*'` (contains only empty folders with READMEs: `customization/README.md`, `white-label/README.md`).
     - Line 26: `'apps/*'` (no such directory exists at repository root).
     - Highly erratic wildcard depths: `'products/zolexora-marketplace/apps/*/*/*'` vs `'products/zolexora-tms/apps/frontend/*'` vs `'products/platform-admin/frontend'`.
3. **Lockfile & Workspace Schizophrenia**:
   - Monorepo root has `pnpm-lock.yaml` (1.27 MB).
   - 8 independent nested `pnpm-lock.yaml` files and 5 `package-lock.json` files exist within product subdirectories:
     - `products/the-textile-care/pnpm-workspace.yaml` & `pnpm-lock.yaml`
     - `products/zolexora-engage/pnpm-workspace.yaml` & `pnpm-lock.yaml`
     - `products/clarityfi/pnpm-workspace.yaml` & `pnpm-lock.yaml`
     - `products/zolexora-tms/pnpm-workspace.yaml` & `pnpm-lock.yaml`
     - `products/rentoeasy/pnpm-workspace.yaml` & `pnpm-lock.yaml`
     - `products/zolexora-ims/pnpm-lock.yaml`
     - `products/zolexora-marketplace/pnpm-lock.yaml`
     - `packages/api-contracts/pnpm-lock.yaml`
     - `products/maunkavach/backend/package-lock.json` & `web/package-lock.json`
     - `products/zolexora-ai/frontend/package-lock.json` & `frontend/e2e/package-lock.json`
     - `products/zolexora-ims/apps/ims-user/package-lock.json`

### 1.2 Package Collision & Scope Inconsistencies
Direct AST parsing of all 75 `package.json` manifests across the codebase revealed severe naming collisions and scope discordance:
1. **Critical Name Collisions**:
   - Collision 1 (`@workspace/*`):
     - `products/clarityfi/packages/api-client-react/package.json` -> `"@workspace/api-client-react"`
     - `products/zolexora-engage/lib/api-client-react/package.json` -> `"@workspace/api-client-react"`
     - `products/clarityfi/packages/api-spec/package.json` -> `"@workspace/api-spec"`
     - `products/zolexora-engage/lib/api-spec/package.json` -> `"@workspace/api-spec"`
     - `products/clarityfi/packages/api-zod/package.json` -> `"@workspace/api-zod"`
     - `products/zolexora-engage/lib/api-zod/package.json` -> `"@workspace/api-zod"`
     - `products/clarityfi/packages/db/package.json` -> `"@workspace/db"`
     - `products/zolexora-engage/lib/db/package.json` -> `"@workspace/db"`
   - Collision 2 (`zolexora-tms`):
     - `products/zolexora-tms/package.json` -> `"zolexora-tms"`
     - `products/zolexora-tms/apps/frontend/zolexora-tms/package.json` -> `"zolexora-tms"`
     - Running `pnpm --filter zolexora-tms` matches two divergent targets, causing non-deterministic resolution.
   - Collision 3 (`workspace`):
     - `products/zolexora-engage/package.json` -> `"workspace"` (unscoped generic name).
2. **Wild West Package Naming Convention**:
   - `clarityfi`: uses `@clarityfi/*` for apps, `@workspace/*` for packages.
   - `rentoeasy`: uses `@rent-stay/*` (`@rent-stay/web-admin`, `@rent-stay/types`, etc.).
   - `the-textile-care`: uses `@ttc/*` (`@ttc/admin-web`, `@ttc/ui`, etc.).
   - `zolexora-ai`: uses `swarm-factory-frontend`, `swarm-factory-e2e` (legacy stale branding).
   - `zolexora-appsuite`: uses `@zas/*` (`@zas/client`, `@zas/backend`, `@zas/dev-team`).
   - `zolexora-engage`: uses `@workspace/*`.
   - `zolexora-ironclub`: uses `@zolexora/ironclub-*`.
   - `zolexora-marketplace`: uses `@zolexora/marketplace-*`, `@zolexora/storefront-*`, `@zolexora/seller-*`, `@zolexora/shared-*`.
   - `zolexora-tms`: uses unscoped `zolexora-tms`, `zolexora-tms-admin`.
   - `maunkavach`: uses unscoped `maunkavach-backend`, `maunkavach-site`.

### 1.3 Boundary Violations & Fragile Linking Hacks
1. **`file:` Protocol Dependency Hacks**:
   - `products/rentoeasy/packages/shared-types/package.json` (Line 11):  
     `"@zolexora/api-contracts": "file:../../../../packages/api-contracts"`
   - `products/the-textile-care/packages/types/package.json` (Line 11):  
     `"@zolexora/api-contracts": "file:../../../../packages/api-contracts"`
   - Products are manually reaching up four directory levels via relative `file:` links rather than resolving `@zolexora/api-contracts` via the pnpm workspace protocol (`workspace:*`).
2. **Direct Source Exposure Without Build Pipeline**:
   - `platform/Authentication/User Auth/Zolexora/package.json` exports raw `.ts` files directly:
     ```json
     "exports": {
       ".": "./src/index.ts",
       "./next": "./src/next.ts",
       "./pages": "./src/pages/index.ts"
     }
     ```
     `build` script is `"tsc --noEmit"`. No compiled `.js` or `.d.ts` artifacts are generated; consumer projects must transpile external TypeScript in node_modules, causing bundler compilation failures when consuming libraries with differing TSConfig targets.
3. **Spaces in Directory Names**:
   - `/workspaces/Zolexora_Platform/platform/Authentication/Organization Auth`
   - `/workspaces/Zolexora_Platform/platform/Authentication/User Auth/Firebase`
   - `/workspaces/Zolexora_Platform/platform/Authentication/User Auth/Supabase`
   - `/workspaces/Zolexora_Platform/platform/Authentication/User Auth/Zolexora`
   - Causes quoting issues across shell scripts, Makefiles, Docker contexts, and CI runners.

### 1.4 Script Decay, Duplication, and Dead Code
1. **Case-Sensitivity Breakage (Linux Ext4 Filesystem)**:
   - 20+ scripts in `scripts/` hardcode stale PascalCase paths (`products/ZolexoraTMS`, `products/TheTextileCare`, `products/ZolexoraIMS`, etc.). Because Linux is case-sensitive and directories are kebab-case (`products/zolexora-tms`), these scripts immediately fail with `No such file or directory`:
     - `scripts/ports/patch-backend-service-ports.py` (Lines 23, 26, 29, 32, 35, 38, 42, 45)
     - `scripts/ports/patch-frontend-dev-ports.js` (Lines 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20)
     - `scripts/dev/start-all-products-dev.sh` (Lines 32–40)
     - `scripts/dev/setup-cli-ecosystem.sh` (Line 13)
2. **Dead / Stubbed Scripts Exiting Error 78**:
   - `scripts/deploy/deploy-platform.sh`: 7 lines; outputs `ERROR: deploy.sh is not implemented as of DP-07` and exits 78.
   - `scripts/deploy/backup-platform.sh`: 7 lines; outputs `ERROR: backup.sh is not implemented as of DP-07` and exits 78.
   - `scripts/deploy/rollback-platform.sh`: 7 lines; outputs `ERROR: rollback.sh is not implemented as of DP-07` and exits 78.
   - `scripts/deploy/check-platform-health.sh`: 8 lines; outputs `ERROR: healthcheck.sh is not implemented as of DP-07` and exits 78.
3. **Broken External Codebase Dependencies**:
   - `scripts/deploy/install-platform.sh`, `scripts/deploy/diagnose-platform.sh`, `scripts/deploy/restore-platform.sh`, `scripts/deploy/verify-platform-backup.sh`:
     - Copied from an external repo `ZolexoraDeployment`.
     - Check: `[[ ${repo_root##*/} == ZolexoraDeployment || ${repo_root##*/} == deployment ]] || dp__install_command_error` (fails immediately).
     - Sources non-existent files: `source "$repo_root/core/lib/runtime.sh"` and `source "$repo_root/core/lib/validation.sh"`.
4. **Chat Utilities Misplaced in Root `scripts/`**:
   - `scripts/export-chat-md.py` & `scripts/view-chat.py`:
     - Hardcode static path to an old agent conversation log: `/home/vscode/.gemini/antigravity-cli/brain/9a799708-eac2-4bfc-a833-9d9ae6dc99dd/.system_generated/logs/transcript_full.jsonl`.
5. **Start Script Duplication**:
   - `scripts/zolexora-tms/start-docker.sh` and `products/zolexora-tms/scripts/docker-start.sh` are 100% duplicate implementations.
   - `scripts/zolexora-tms/start-local.sh` still contains abandoned Bitwarden `bw unlock` & `dotenvx` routines (Lines 16–31).
   - `scripts/textile-care/start-docker.sh` executes `docker compose` with `cd "$REPO_ROOT"` where `REPO_ROOT` resolves to `/workspaces/Zolexora_Platform/scripts` (has no compose file).

### 1.5 Docker Compose & Infrastructure Misplacement
1. **Root `compose.yaml` Misrepresentation**:
   - Monorepo root `compose.yaml` (219 lines) is named as if it orchestrates the platform. In reality, it is exclusively a Frappe/ERPNext compose stack (`zolexora-backend`, `zolexora-mariadb`, `zolexora-redis-cache`, `zolexora-scheduler`, `zolexora-socketio`), building from `infrastructure/containers/docker/Dockerfile` and mounting `config/envs/zolexora-erp/erp.env`.
   - Meanwhile, every single product has its own compose file (`products/clarityfi/compose.yaml`, `products/zolexora-tms/compose.yaml`, `products/zolexora-erp/compose.yaml`, etc.).
2. **Duplicate Compose Files**:
   - `products/zolexora-erp/compose.yaml` and `products/zolexora-erp/docker-compose.yml` (duplicate).
   - `products/zolexora-ai/compose.yaml` and `products/zolexora-ai/infra/docker-compose.yml` (duplicate).
3. **Symlink Smells in `infrastructure/`**:
   - `infrastructure/compose -> containers/compose` (symlink).
   - `infrastructure/docker -> containers/docker` (symlink).
   - `infrastructure/containers/compose/nginx.conf` hardcodes Frappe paths (`/home/frappe/frappe-bench/sites/assets/`), proving it is ERP-specific and misclassified as general platform infrastructure.

### 1.6 CI / CD Pipeline Failures
1. **Failing Documentation Tests in `.github/workflows/platform-ci.yml`**:
   - Lines 40–44 assert the presence of files at `docs/*.md`:
     `test -f docs/production-guide.md`
     `test -f docs/security-review.md`
     `test -f docs/disaster-recovery-report.md`
   - These files were moved into `docs/guides/` and `docs/reports/` in an earlier restructuring without updating the CI workflow, causing static validation to fail.

---

## 2. Logic Chain

```
[Observation 1.1: Root package.json lacks build/test/lint/typecheck scripts; missing root tsconfig]
  + [Observation 1.1: 8 nested lockfiles and 5 npm package-lock.json files across products]
  + [Observation 1.3: Products consume @zolexora/api-contracts via "file:../../../../packages/..."]
  ---> INFERENCE 1: The repository is not functioning as a unified monorepo. It operates as 13 disconnected sub-repos accidentally collocated in a single directory. Developers cannot run repo-wide typechecks, builds, or security audits with standard tooling (Turbo / pnpm).

[Observation 1.2: ClarityFi and ZolexoraEngage define identical @workspace/* package names]
  + [Observation 1.2: products/zolexora-tms and products/zolexora-tms/apps/frontend/zolexora-tms both named "zolexora-tms"]
  + [Observation 1.2: 6 different naming prefixes: @ttc, @zas, @rent-stay, @workspace, @zolexora, unscoped]
  ---> INFERENCE 2: Package namespace anarchy prevents pnpm workspace resolution from functioning correctly. In a unified pnpm workspace, identical package names collide in the virtual store. All packages must be standardized under the canonical `@zolexora/<scope>-<name>` namespace.

[Observation 1.4: 20+ scripts in scripts/ hardcode PascalCase paths and fail on Linux]
  + [Observation 1.4: scripts/deploy/ contains 4 stubs exiting 78 and 4 broken files checking for ZolexoraDeployment]
  + [Observation 1.4: scripts/export-chat-md.py and view-chat.py are personal agent chat viewers]
  + [Observation 1.4: scripts/zolexora-tms/start-docker.sh duplicated in products/zolexora-tms/scripts/]
  ---> INFERENCE 3: The scripts/ directory is heavily polluted with obsolete migration residue, dead prototypes, and duplicate code. Retaining these files creates confusion for engineers and AI agents, causing broken commands and failed workflows.

[Observation 1.5: Root compose.yaml is an exact duplicate of ERPNext/Frappe compose stack]
  + [Observation 1.5: infrastructure/containers/compose/nginx.conf contains hardcoded Frappe paths]
  + [Observation 1.5: Every product has its own independent compose.yaml]
  ---> INFERENCE 4: The root compose.yaml and infrastructure/compose are ERP monolith residue improperly placed at the platform root. The platform root requires an umbrella orchestration layer, while product-specific services must reside within their respective product boundaries.

[Observation 1.1 & 1.3: Empty scaffolding in products/the-textile-care/platform/* and spaces in platform/Authentication/...]
  ---> INFERENCE 5: Directory structures must follow POSIX kebab-case naming standards without spaces, and speculative empty directories must be purged to maintain high signal-to-noise ratio.
```

---

## 3. Target Architecture Blueprint

### 3.1 Standardized Directory Topology
To resolve the impedance mismatch between products, platform services, and shared libraries, the repository will adhere to a 6-tier canonical structure:

```
/workspaces/Zolexora_Platform/
├── apps/                         # Standalone Platform-level Web Apps & Dashboards
│   ├── platform-admin/           # Platform Management Console (moved from products/platform-admin)
│   └── docs-site/                # (Optional) Unified Monorepo Documentation Portal
│
├── products/                     # Domain-Specific Products (Business Applications)
│   ├── clarityfi/                # Fintech & Personal Finance
│   │   ├── apps/                 #   - api-server, mobile, web
│   │   └── packages/             #   - api-client, api-spec, api-zod, db
│   ├── maunkavach/               # Women's Safety & Emergency
│   │   ├── apps/                 #   - mobile (android/gradle), web
│   │   └── services/             #   - backend (FastAPI/Node)
│   ├── rentoeasy/                # Real Estate & Property Rental
│   │   ├── apps/                 #   - web-admin, web-owner, web-tenant
│   │   ├── packages/             #   - types, utils
│   │   └── services/             #   - api (NestJS/Prisma)
│   ├── the-textile-care/         # Textile & Laundry Marketplace
│   │   ├── apps/                 #   - admin-web, driver-mobile, marketplace-web, seller-web, etc.
│   │   ├── packages/             #   - api-client, auth, branding, config, tenant, types, ui
│   │   └── services/             #   - backend (FastAPI/Alembic)
│   ├── zolexora-ai/              # Autonomous AI Agent Engine
│   │   ├── apps/                 #   - frontend, e2e
│   │   └── services/             #   - backend (Python FastAPI/LangGraph)
│   ├── zolexora-appsuite/        # Productivity & Workspace Suite
│   │   ├── apps/                 #   - client, dev-team
│   │   └── services/             #   - backend (Node/FastAPI)
│   ├── zolexora-engage/          # Omnichannel Customer Engagement
│   │   ├── apps/                 #   - client-web (renamed from artifacts/client/web)
│   │   ├── packages/             #   - api-client, api-spec, api-zod, db (renamed from lib/*)
│   │   └── services/             #   - api-server (renamed from artifacts/api-server)
│   ├── zolexora-erp/             # Enterprise Resource Planning Monolith
│   │   ├── backend/              #   - frappe, erpnext, payments (git submodules)
│   │   └── modules/              #   - zolexora_core, zolexora_branding, zolexora_platform, zolexora_integrations
│   ├── zolexora-ims/             # Inventory Management System
│   │   ├── apps/                 #   - ims-admin-web, ims-user-web
│   │   ├── packages/             #   - backend-shared
│   │   └── services/             #   - ims-admin-api, ims-user-api
│   ├── zolexora-ironclub/        # Fitness & Gym Management
│   │   ├── apps/                 #   - admin-web, manager-mobile, manager-web, marketing-web, member-mobile
│   │   ├── packages/             #   - types
│   │   └── services/             #   - backend (FastAPI)
│   ├── zolexora-marketplace/     # Multivendor Commerce Platform
│   │   ├── apps/                 #   - marketplace-admin, seller-web, seller-mobile, storefront-web, etc.
│   │   ├── packages/             #   - shared-api, shared-config
│   │   └── services/             #   - marketplace-api (Python/FastAPI)
│   └── zolexora-tms/             # Transportation Management System
│       ├── apps/                 #   - tms-web, tms-admin (flattened from apps/frontend/*)
│       └── services/             #   - backend (FastAPI/SQLAlchemy)
│
├── platform/                     # Shared Foundation & Infrastructure Services
│   ├── api-shield/               # Cloudflare Edge Security & Reverse Proxy (wrangler)
│   ├── auth/                     # Unified Authentication Core
│   │   ├── org-auth/             #   - Multi-tenant Organization & RBAC Engine (no spaces)
│   │   ├── user-auth-firebase/   #   - Firebase Auth Provider SDK
│   │   ├── user-auth-supabase/   #   - Supabase Auth Provider SDK
│   │   └── user-auth-core/       #   - Canonical Zolexora Auth Provider SDK
│   └── functions/                # Cloud Functions (Firebase Auth triggers; moved from root /functions)
│
├── packages/                     # Cross-Cutting Shared Libraries (@zolexora/*)
│   ├── api-contracts/            # OpenAPI 3.1 & JSON Schema canonical definitions
│   ├── config/                   # Unified build, lint, and runtime configurations
│   │   ├── eslint/               #   - @zolexora/eslint-config
│   │   ├── tsconfig/             #   - @zolexora/tsconfig (base, react, node, next)
│   │   ├── tailwind/             #   - @zolexora/tailwind-config (Tailwind v4 tokens)
│   │   └── vite/                 #   - @zolexora/vite-config
│   ├── types/                    # Core Domain Types & DTOs (@zolexora/types)
│   ├── utils/                    # Standardized Functional Utilities (@zolexora/utils)
│   └── ui/                       # Design System & Headless UI Components (@zolexora/ui)
│
├── infrastructure/               # Platform-Wide Deployment, Cloud, and Orchestration
│   ├── compose/                  # Canonical Docker Compose Definitions
│   │   ├── platform-local.yaml   #   - Unified gateway & common backing stores (Postgres, Redis, Nginx)
│   │   ├── erp.yaml              #   - ERPNext/Frappe stack (moved from root compose.yaml)
│   │   └── products/             #   - Symlinks or overlays for individual product compose definitions
│   ├── cloud/                    # Cloudflare, Supabase, Azure, Render Blueprints
│   └── nginx/                    # Global Gateway Configurations & Upstream Maps
│
├── config/                       # Centralized Environment Schemas & Example Files
│   └── envs/                     # Per-product environment templates (canonical kebab-case)
│       ├── clarityfi/
│       ├── maunkavach/           # (renamed from maun-kavach)
│       ├── platform-admin/
│       ├── rentoeasy/            # (renamed from rento-easy)
│       ├── the-textile-care/     # (renamed from textile-care)
│       ├── zolexora-ai/
│       ├── zolexora-engage/
│       ├── zolexora-erp/
│       ├── zolexora-ims/
│       ├── zolexora-ironclub/
│       ├── zolexora-marketplace/
│       └── zolexora-tms/
│
├── tools/                        # Internal Developer Tools & Scripts (cleaned & audited)
│   ├── dev/                      # Local dev bootstrap, port allocators, environment doctors
│   ├── db/                       # Database migrations, seeders, schema generators
│   └── audits/                   # Code quality, security, and boundary linters
│
└── docs/                         # Architecture RFCs, Runbooks, and Certifications
```

---

### 3.2 Strict Dependency Matrix & Import Rules
To prevent architectural drift and dependency tangling, imports will be strictly enforced according to a layered dependency hierarchy:

```
  Layer 5: [ Products: Apps & Portals ]  (e.g., tms-web, seller-web, dev-team)
                    │
                    ▼
  Layer 4: [ Products: Internal Packages & Local Services ] (e.g., @zolexora/tms-api, @zolexora/engage-db)
                    │
                    ▼
  Layer 3: [ Platform Services & Edge Proxies ] (e.g., @zolexora/api-shield, @zolexora/org-auth)
                    │
                    ▼
  Layer 2: [ Shared Monorepo Packages ] (e.g., @zolexora/ui, @zolexora/utils, @zolexora/api-contracts)
                    │
                    ▼
  Layer 1: [ Shared Build Configs ] (e.g., @zolexora/tsconfig, @zolexora/eslint-config)
```

#### Rule Enforcement Matrix:
| Importing Scope | Allowed To Import | FORBIDDEN To Import | Enforcement Mechanism |
|---|---|---|---|
| **`packages/*` (Shared Libraries)** | Other `packages/*`, external NPM dependencies | Any `products/*`, any `apps/*`, any `platform/*` | `eslint-plugin-boundaries` + `pnpm-workspace.yaml` |
| **`platform/*` (Foundation)** | `packages/*`, external NPM dependencies | `products/*`, `apps/*` | `eslint-plugin-boundaries` |
| **`products/<product-A>`** | `packages/*`, `platform/*`, own local `products/<product-A>/*` | **`products/<product-B>/*` (NEVER cross-import between products)** | `eslint-plugin-boundaries` + `tsconfig` path rules |
| **`infrastructure/*`** | References compose files & container definitions | Direct code dependency | Lint check |

#### Strict Contract Rules:
1. **No Direct `file:` Linking**: All internal dependencies MUST use the `workspace:*` protocol (e.g., `"@zolexora/api-contracts": "workspace:*"`).
2. **Build Before Consume**: All shared packages in `packages/*` must compile their TypeScript definitions (`dist/index.d.ts`) and ESM bundles (`dist/index.js`) via Turborepo pipeline before consumer applications run. No raw `.ts` source imports from `packages/*`.
3. **No Unscoped Packages**: Every package published in the workspace must use the `@zolexora/` namespace:
   - Shared libraries: `@zolexora/<lib>` (`@zolexora/ui`, `@zolexora/types`, `@zolexora/config`)
   - Platform services: `@zolexora/platform-<service>` (`@zolexora/platform-org-auth`, `@zolexora/platform-api-shield`)
   - Product packages: `@zolexora/<product>-<component>` (`@zolexora/tms-admin-web`, `@zolexora/clarityfi-api`)

---

### 3.3 Shared Package Specifications & Contracts

#### 1. `@zolexora/config` (Root: `packages/config`)
Consolidates all developer tooling configs into subpath exports:
- `@zolexora/config/eslint/base` (vanilla TS/JS rules, imports, prettier)
- `@zolexora/config/eslint/react` (React 19 rules, hooks, accessibility)
- `@zolexora/config/eslint/next` (Next.js 16 core web vitals)
- `@zolexora/config/tsconfig/base.json` (strict TS 5.4+, ES2022)
- `@zolexora/config/tsconfig/react.json` (JSX transform, DOM libs)
- `@zolexora/config/tsconfig/node.json` (Node 20+ ESM resolution)
- `@zolexora/config/tailwind` (Tailwind v4 theme variables, brand colors, typography)

#### 2. `@zolexora/types` (Root: `packages/types`)
Defines canonical business entity contracts and data transfer objects across products:
- `TenantId`, `UserId`, `OrganizationId`, `CurrencyCode`, `ISO8601Timestamp`
- Common HTTP responses: `ApiResponse<T>`, `PaginatedResponse<T>`, `ApiError`
- Audit and Telemetry: `AuditLogEvent`, `HealthStatusResponse`

#### 3. `@zolexora/utils` (Root: `packages/utils`)
Lightweight, zero-bloat utility functions (embracing ponytail stdlib principles):
- `currency.ts`: Standardized INR (`₹`) formatting, paise/rupee conversion with `Intl.NumberFormat`.
- `date.ts`: Native `Intl.DateTimeFormat` wrappers for IST timestamps.
- `validation.ts`: Common Zod primitives (GSTIN, PAN, Phone, Pincode).
- `crypto.ts`: Web Crypto API wrappers for hashing and token generation.

#### 4. `@zolexora/ui` (Root: `packages/ui`)
Headless, accessible UI components built with React 19, Tailwind v4, and Radix UI / Lucide:
- Merged from duplicated UI packages: `@ttc/ui`, TMS frontend components, Marketplace UI elements.
- Components: `Button`, `Modal`, `Dialog`, `DataTable`, `Badge`, `NotificationToast`, `Card`, `Skeleton`.
- Theme support: Dark/Light token switching based on CSS variables.

#### 5. `@zolexora/api-contracts` (Root: `packages/api-contracts`)
Source of truth for all cross-product and external API interfaces:
- OpenAPI 3.1 YAML specifications.
- Auto-generated Zod schemas for runtime schema validation on both client and server.
- Contract-testing fixtures (Pact / Vitest).

#### 6. `@zolexora/auth` (Root: `platform/auth`)
Consolidated authentication SDK:
- `@zolexora/auth/firebase`: Server and client bindings for Firebase Auth.
- `@zolexora/auth/supabase`: Server and client bindings for Supabase Auth.
- `@zolexora/auth/session`: JWT verification, session token cookie helpers, Next.js 16 middleware guard.

---

## 4. Deprecation Matrix & Cleanup Inventory

### 4.1 Dead Code & Broken Script Deprecation Matrix
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
| `scripts/export-chat-md.py` | Antigravity internal agent chat viewer hardcoded to old brain session | **MOVE** | `.agents/teamwork/tools/export-chat-md.py` (or delete) | Zero |
| `scripts/view-chat.py` | Antigravity internal terminal chat viewer hardcoded to old brain session | **MOVE** | `.agents/teamwork/tools/view-chat.py` (or delete) | Zero |
| `scripts/ports/patch-backend-service-ports.py` | Broken; hardcodes stale PascalCase paths (`products/ZolexoraAI`, etc.) | **FIX / DEPRECATE** | Standardize in centralized `config/ports.json` | Medium |
| `scripts/ports/patch-frontend-dev-ports.js` | Broken; hardcodes stale PascalCase paths (`products/ZolexoraTMS`, etc.) | **FIX / DEPRECATE** | Standardize in centralized `config/ports.json` | Medium |
| `scripts/rento-easy/` (directory) | Inconsistent hyphen naming (`rento-easy` vs `products/rentoeasy`) | **MOVE & MERGE** | `products/rentoeasy/scripts/` | Low |
| `scripts/textile-care/` (directory) | Missing `the-` prefix (`textile-care` vs `the-textile-care`); start-docker.sh broken path | **MOVE & FIX** | `products/the-textile-care/scripts/` | Low |
| `scripts/zolexora-tms/start-docker.sh` | Exact duplicate of `products/zolexora-tms/scripts/docker-start.sh` | **CONSOLIDATE** | Maintain canonical `products/zolexora-tms/scripts/start-docker.sh` | Low |
| `scripts/zolexora-tms/start-local.sh` | Contains dead Bitwarden `bw` and `dotenvx` unlock routine | **CLEAN** | Refactor to use Infisical CLI fallback like `start-docker.sh` | Low |
| `compose.yaml` (root) | Monolith Frappe/ERP compose file mislabeled as monorepo root compose | **RELOCATE** | `infrastructure/compose/erp.yaml` (or `products/zolexora-erp/compose.yaml`) | Medium |
| `infrastructure/compose` (symlink) | Symlink to `containers/compose` | **REMOVE SYMLINK** | Consolidate directly into `infrastructure/compose/` | Low |
| `infrastructure/docker` (symlink) | Symlink to `containers/docker` | **REMOVE SYMLINK** | Consolidate directly into `infrastructure/docker/` | Low |
| `products/the-textile-care/platform/*` | Empty directories with READMEs (`customization`, `white-label`) | **PRUNE** | Remove empty directories; document in product README | Zero |
| `platform/Authentication/Organization Auth` | Directory name contains whitespace | **RENAME** | `platform/auth/org-auth` | Medium |
| `platform/Authentication/User Auth/*` | Directory names contain whitespace | **RENAME** | `platform/auth/user-auth-*` | Medium |
| `functions/` (root) | Firebase functions package sitting at root; should be platform or marketplace | **RELOCATE** | `platform/functions/` (or `products/zolexora-marketplace/functions`) | Medium |
| `products/zolexora-engage/artifacts/*` | Non-standard directory name (`artifacts/` instead of `apps/` & `services/`) | **STANDARDIZE** | `products/zolexora-engage/apps/client-web` and `services/api-server` | Medium |
| `products/zolexora-engage/lib/*` | Non-standard directory name (`lib/` instead of `packages/`) | **STANDARDIZE** | `products/zolexora-engage/packages/*` | Medium |
| Nested lockfiles (8 `pnpm-lock.yaml`, 5 `package-lock.json`) | Disconnects workspace; duplicate node_modules; divergent resolutions | **PRUNE & UNIFY** | Remove all nested lockfiles; regenerate single root `pnpm-lock.yaml` | High (requires test pass) |

---

## 5. Phased Migration Stages

To ensure zero downtime, non-destructive execution, and full regression prevention, the reorganization is divided into five strictly verified stages:

```
[Phase 0: Baseline & Guardrails]
           │ (Git clean, tests pass, typechecks recorded)
           ▼
[Phase 1: High-Confidence Dead Code & Script Pruning]
           │ (Delete dead deploy stubs, chat scripts, empty scaffolding)
           ▼
[Phase 2: Package Extraction & Namespace Normalization]
           │ (Rename @workspace/*, resolve collisions, standardize @zolexora/*)
           ▼
[Phase 3: Directory Restructuring & Path Normalization]
           │ (Eliminate folder spaces, flatten nested frontend dirs, relocate ERP compose)
           ▼
[Phase 4: Build System & Workspace Optimization]
           │ (Single root pnpm lockfile, Turbo pipelines, shared tsconfig/eslint)
           ▼
[Validation: 100% CI & Monorepo Health Verification]
```

### Stage 0: Baseline & Guardrails
- **Objective**: Establish rock-solid test baselines and git branch hygiene before touching any files.
- **Tasks**:
  1. Create a dedicated migration branch: `git checkout -b refactor/monorepo-reorganization-m1`.
  2. Run baseline verification on key functional stacks:
     - TMS E2E tests: `python3 tests/e2e/tms/run_all.py` (confirm 147/147 pass).
     - Product builds: `pnpm --filter @zas/client build`, `pnpm --filter zolexora-tms build`.
     - Container verification: `docker compose -f products/zolexora-tms/compose.yaml ps`.
  3. Snapshot repository state and file hashes.

### Stage 1: High-Confidence Dead Code & Script Pruning
- **Objective**: Remove verified dead files and tools that cannot cause regressions.
- **Tasks**:
  1. Delete 4 dead deploy stubs in `scripts/deploy/` (`deploy-platform.sh`, `backup-platform.sh`, `rollback-platform.sh`, `check-platform-health.sh`).
  2. Delete 4 broken external `ZolexoraDeployment` scripts in `scripts/deploy/` (`install-platform.sh`, `diagnose-platform.sh`, `restore-platform.sh`, `verify-platform-backup.sh`). Remove empty `scripts/deploy/` directory.
  3. Relocate or delete Antigravity chat viewers (`scripts/export-chat-md.py`, `scripts/view-chat.py`).
  4. Prune empty scaffolding in `products/the-textile-care/platform/` (`customization/`, `white-label/`).
  5. Remove symlinks in `infrastructure/` (`compose`, `docker`).
  6. Fix `platform-ci.yml` documentation path assertions so CI passes (`docs/guides/production-guide.md`, etc.).

### Stage 2: Package Extraction & Namespace Normalization
- **Objective**: Eliminate package name collisions and standardize all package scopes.
- **Tasks**:
  1. Disambiguate `@workspace/*` packages:
     - In `clarityfi`: Rename `@workspace/*` -> `@zolexora/clarityfi-*` (`@zolexora/clarityfi-api-spec`, `@zolexora/clarityfi-db`, etc.).
     - In `zolexora-engage`: Rename `@workspace/*` -> `@zolexora/engage-*` (`@zolexora/engage-api-spec`, `@zolexora/engage-db`, etc.).
  2. Disambiguate `zolexora-tms` collision:
     - Root product package: `"name": "@zolexora/tms-product"` (private workspace container).
     - Frontend app package: `"name": "@zolexora/tms-web"` (Next.js/Vite client).
     - Admin app package: `"name": "@zolexora/tms-admin"` (Admin client).
  3. Normalize other product scopes:
     - Rentoeasy: `@rent-stay/*` -> `@zolexora/rentoeasy-*`.
     - Textile Care: `@ttc/*` -> `@zolexora/ttc-*`.
     - AI: `swarm-factory-*` -> `@zolexora/ai-*`.
  4. Replace `file:../../../../packages/api-contracts` in `rentoeasy` and `the-textile-care` with `"@zolexora/api-contracts": "workspace:*"`.

### Stage 3: Directory Restructuring & Path Normalization
- **Objective**: Eliminate whitespaces in directories, align backend/frontend locations, and relocate ERP compose.
- **Tasks**:
  1. Rename whitespace paths in `platform/`:
     - `platform/Authentication/Organization Auth` -> `platform/auth/org-auth`
     - `platform/Authentication/User Auth/Firebase` -> `platform/auth/user-auth-firebase`
     - `platform/Authentication/User Auth/Supabase` -> `platform/auth/user-auth-supabase`
     - `platform/Authentication/User Auth/Zolexora` -> `platform/auth/user-auth-core`
     - Update all references in `products/zolexora-appsuite` (`apps/client`, `apps/dev-team`, `apps/backend`).
  2. Normalize `zolexora-tms` frontend structure:
     - Flatten `products/zolexora-tms/apps/frontend/zolexora-tms` -> `products/zolexora-tms/apps/tms-web`.
     - Flatten `products/zolexora-tms/apps/frontend/tms-admin` -> `products/zolexora-tms/apps/tms-admin`.
     - Update TMS Nginx configs and Dockerfiles to match flattened paths.
  3. Normalize `zolexora-engage` structure:
     - `artifacts/client/web` -> `apps/web`
     - `artifacts/api-server` -> `services/api`
     - `lib/*` -> `packages/*`
  4. Relocate root `compose.yaml`:
     - Move root `compose.yaml` to `infrastructure/compose/erp.yaml` and maintain compatibility symlink or update scripts.
  5. Relocate root `functions/` -> `platform/functions/`.

### Stage 4: Build System & Workspace Optimization
- **Objective**: Unify the repository under a single coherent pnpm workspace and high-speed Turborepo cache.
- **Tasks**:
  1. Remove all 8 nested `pnpm-lock.yaml` and 5 `package-lock.json` files.
  2. Update root `pnpm-workspace.yaml` to clean standard pattern:
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
  3. Add root `tsconfig.json` with TypeScript 5.4+ project references pointing to all workspace tsconfigs.
  4. Update root `package.json` with universal Turborepo scripts:
     ```json
     "scripts": {
       "build": "turbo run build",
       "test": "turbo run test",
       "lint": "turbo run lint",
       "typecheck": "turbo run typecheck",
       "clean": "turbo run clean && pnpm -r exec rm -rf node_modules dist .turbo"
     }
     ```
  5. Configure `turbo.json` with explicit inputs, outputs (`dist/**`, `.next/**`, `build/**`), and dependency caching.
  6. Execute `pnpm install` at repository root to create a single, unified `pnpm-lock.yaml`.

---

## 5. Verification Method

To verify the integrity and success of the reorganization without regressions:

### 5.1 Static Architecture & Workspace Validation
```bash
# 1. Verify pnpm workspace detects all packages cleanly with zero duplicate name warnings
pnpm -r ls --depth -1

# 2. Verify no remaining spaces in directory names under platform or products
find platform products -name "* *" -type d

# 3. Verify no remaining "file:" relative package linking
grep -rn '"file:' products/ packages/ platform/ apps/ package.json 2>/dev/null | grep package.json

# 4. Verify no broken PascalCase paths remaining in scripts
grep -rnE "products/(Zolexora|TheTextileCare|ClarityFi|MaunKavach|RentoEasy)" scripts/ 2>/dev/null
```

### 5.2 Build & Typecheck Verification
```bash
# 1. Run root Turborepo typecheck across all workspaces
pnpm typecheck

# 2. Run root Turborepo build across all packages and apps
pnpm build

# 3. Run ESLint boundary verification across all packages
pnpm lint
```

### 5.3 Automated Functional & Container Health Validation
```bash
# 1. Verify TMS Docker Stack orchestration & health via Infisical
bash products/zolexora-tms/scripts/start-docker.sh restart
sleep 5
docker compose -f products/zolexora-tms/compose.yaml ps

# 2. Execute 100% of TMS End-to-End Test Suite (147 test cases across Tiers 1-5)
python3 tests/e2e/tms/run_all.py

# 3. Verify backend health endpoint responds HTTP 200
curl -f http://localhost:4030/health

# 4. Verify frontend gateway responds HTTP 200
curl -f http://localhost:3084/
```

### 5.4 Invalidation Conditions
The migration is invalidated if:
- `pnpm -r ls` emits any package name collision warning or duplicate resolution error.
- Any product app fails to compile because a shared package in `packages/*` did not emit type definitions.
- Any container in the TMS stack (`tms-postgres`, `tms-backend`, `tms-web`, `tms-admin`, `tms-nginx`) enters an unhealthy status.
- The TMS test suite passes less than 147/147 test cases.
- Any secret key or decrypted token is committed to the git tree during refactoring.

---

## 6. Caveats
1. **ERPNext Submodule Isolation**: `products/zolexora-erp/backend/frappe`, `erpnext`, and `payments` are external Git submodules (version-16). Their internal directory structures must NOT be altered or moved, as Frappe's bench CLI relies on strict relative path assumptions (`../apps/frappe`).
2. **Native Mobile Builds**: Products containing React Native / Expo applications (`maunkavach`, `the-textile-care`, `zolexora-ironclub`, `zolexora-marketplace`, `clarityfi`) have native Android Gradle wrappers. While their JavaScript packages and TypeScript configs will participate in the pnpm workspace, native Gradle builds (`gradlew`) must continue to execute within their respective app directories.
3. **Execution Gate**: This report is strictly an **Architecture Plan and Investigation Report**. No source code files, configuration files, or directories have been modified or deleted. Execution must await formal user review and approval in accordance with the project gate.
