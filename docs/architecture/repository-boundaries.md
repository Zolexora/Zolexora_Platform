# Repository Boundaries and Architecture Reconciliation

## 1. Executive Summary
This document establishes the verified architectural boundaries of the `Zolexora_Platform` monorepo following the Phase F/G audit. It reconciles previous report claims with the actual filesystem, classifying all package directories, contracts, infrastructure, and storage.

---

## 2. Actual Root Structure
The repository root contains:
* `packages/`: Global Platform Core capabilities shared across products.
  * `packages/api-contracts/`: Neutral, dependency-free TypeScript interfaces (`ApiResponse`, `PaginatedResponse`, `ApiError`, `HealthStatus`).
* `products/`: Product workspaces (first-class autonomous products).
  * `ClarityFi`, `MaunKavach`, `RentoEasy`, `TheTextileCare`, `ZolexoraAI`, `ZolexoraERP`, `ZolexoraEngage`, `ZolexoraIMS`, `ZolexoraMarketplace`, `ZolexoraTMS`.
* `infrastructure/`: Operational, container, database, cloud, and host deployment specifications centralized by concern:
  * `cloud/`: Cloud platform and PaaS manifests (`render.yaml`).
  * `containers/`: Platform container builds (`docker/`), Compose stacks (`compose/`), and Nginx configs (`nginx/`).
  * `database/`: Centralized database schemas and migrations.
  * `deployment/`: Production host orchestration, diagnostic doctor, installer, and disaster recovery framework (`ZolexoraDeployment`).
  * `supabase/`: Centralized Supabase platform configuration and migrations.
* `configs/`: Global environment configurations.
* `docs/`: Monorepo architecture and operational documentation.
* `scripts/`: Platform management and automation scripts.
* `storage/`: Runtime backup staging, logs, and product asset storage (ignored from Git tracking).

> **Note on "Rice Images":** `Rice Images` is NOT a root-level directory. It consists of sample storefront product image assets for ZolexoraMarketplace (`storage/ZolexoraMarketplace/Rice Images/` / `products/ZolexoraMarketplace/apps/storefronts/zolexora-shop/web/public/`).
> **Note on Root "platform/":** There is no root-level `platform/` directory. Platform Core capabilities reside under `packages/`.

---

## 3. Classification of "packages/" Directories

| Path | Owner | Consumers | Purpose | Platform vs. Product | Move Required? | Rationale |
|---|---|---|---|---|---|---|
| `packages/api-contracts` | Platform Core | `RentoEasy`, `TheTextileCare` | Neutral API response schemas & types | **Platform Shared** | **No** | Approved cross-product contract. |
| `products/ClarityFi/packages/` | ClarityFi | Internal (`apps/*`) | Product API clients, Zod schemas, DB models | **Product-Local** | **No** | Contains domain models strictly for ClarityFi. |
| `products/RentoEasy/packages/` | RentoEasy | Internal (`apps/*`, `services/*`) | Shared types (`@rent-stay/types`) & utils | **Product-Local** | **No** | Re-exports platform contracts alongside product types. |
| `products/TheTextileCare/packages/` | TheTextileCare | Internal (`apps/*`) | TTC UI, tenant, branding, auth, types | **Product-Local** | **No** | Product-specific library workspace. |
| `products/ZolexoraMarketplace/packages/` | ZolexoraMarketplace | Internal (`apps/*`) | `@zolexora/shared-api`, `@zolexora/shared-config` | **Product-Local** | **No** | Marketplace frontend/portal shared client libraries. |

---

## 4. Classification of Product-Local "platform/" Directory
* **Path:** `products/TheTextileCare/platform/`
* **Components:** `app-factory/`, `customization/`, `white-label/` (each currently containing only architectural READMEs).
* **Owner:** TheTextileCare
* **Classification:** **Product-Local Scaffolding**.
* **Decision:** Retain within `products/TheTextileCare/platform/`. Do NOT move to root `platform/`. These modules represent product-specific white-label tenant features, not global platform infrastructure.

---

## 5. Classification of Product Contracts
* **Path:** `products/ZolexoraMarketplace/contracts/`
* **Components:**
  * `marketplace/openapi.json`: Marketplace public API contract.
  * `zolexora-erp/v1/`: Proposed schemas and payloads for Marketplace integration with ERP (sales order, inventory balance, delivery update).
* **Owner:** ZolexoraMarketplace
* **Classification:** **Product-Specific Contracts**.
* **Decision:** Retain within Marketplace. These schemas reflect the integration interface expected by Marketplace from the ERP, not global platform-wide contracts.

---

## 6. Classification of Backend-Shared Code
* **Path:** `products/ZolexoraIMS/backend-shared/`
* **Components:** `security.py`, `utils.py`, `logging.py`
* **Owner:** ZolexoraIMS
* **Consumers:** `products/ZolexoraIMS/apps/ims-user/backend/`
* **Classification:** **Product-Local Shared Backend**.
* **Decision:** Retain within ZolexoraIMS. Despite the name "backend-shared", it is exclusively consumed by IMS internal backend services.

---

## 7. Classification of Infrastructure & ZolexoraDeployment
* **Path:** `infrastructure/deployment/`
* **Owner:** Platform Infrastructure Operations
* **Purpose:** Host provisioning, firewall configuration, Nginx reverse proxy management, Let's Encrypt TLS automation, systemd services, and operational health probes.
* **Classification:** **Repository-Wide Production Host Infrastructure**.
* **Decision:** Retain under `infrastructure/deployment/`.

---

## 8. Classification of Storage & Runtime Backups
* **Path:** `storage/` (`storage/backups/`, `storage/logs/`, `storage/exports/`, `storage/temporary/`)
* **Tracking:** Excluded from Git via `.gitignore` (`storage/backups/`, `storage/logs/`, etc.).
* **Usage:** Mounted by Docker Compose (`compose.yaml`) for database backups and operational logging.
* **Decision:** Runtime only; must never be committed to source control.

---

## 9. Platform Core vs. ERP Boundary
* **ERP Boundary:** `products/ZolexoraERP/backend/`
  * Contains `zolexora_core`, `zolexora_platform`, `zolexora_branding`, and `zolexora_integrations`.
  * These are Frappe Python applications extending ERPNext (version-16).
  * **Rule:** These modules remain inside `products/ZolexoraERP/backend/`. They are domain-specific to the ERP monolith and must not be conflated with the TypeScript Platform Core under `packages/`.

---

## 10. Dependency Matrix

```mermaid
flowchart TD
    Core["packages/api-contracts (Platform Core)"]
    RE["products/RentoEasy"]
    TTC["products/TheTextileCare"]
    ZE["products/ZolexoraEngage"]
    ERP["products/ZolexoraERP"]
    MP["products/ZolexoraMarketplace"]
    IMS["products/ZolexoraIMS"]

    RE -- file: dependency --> Core
    TTC -- file: dependency --> Core
    ZE -.-> Core
    ERP -. no dependency .-> Core
    MP -. no dependency .-> Core
    IMS -. no dependency .-> Core
```

* `Product A` **MUST NOT** import from `Product B` internals.
* `packages/api-contracts` **MUST NOT** depend on any product.
* Products consume `packages/api-contracts` via `file:../../../../packages/api-contracts` in their local `package.json` while maintaining isolated `pnpm-workspace.yaml` boundaries.
