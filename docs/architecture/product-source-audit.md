# Product Source Audit

## Repository Inventory

We have successfully audited and consolidated the repositories from the Zolexora GitHub organization into the `Zolexora_Platform` monorepo.

*   `Zolexora` (Monorepo root)
*   `ZolexoraMarketplace` -> `products/marketplace`
*   `Zolexora_IMS` -> `products/ims`
*   `Zolexora_TMS` -> `products/tms`
*   `ZolexoraAI` -> `products/ai`
*   `ZolexoraERP` -> Monorepo Root (historically) + `products/erp_repo_clone` (safety copy)
*   `MaunKavach` -> `products/maunkavach`
*   `RentoEasy` -> `products/rentoeasy`
*   `ZolexoraDeployment` -> `infrastructure/ZolexoraDeployment`
*   `Zolexora_Engage` -> `products/engage`
*   `Zolexora_Ads` -> `products/ads`
*   `ZolexoraCloud` -> `products/cloud`
*   `TheTextileCare` -> `products/thetextilecare`
*   `ClearityFi` -> `products/clarityfi`

## ERP Source Comparison

**SOURCE A (`backend/` in Root):**
*   This is the canonical, actively developed Frappe/ERPNext implementation.
*   It contains populated submodules and the most recent updates (e.g. Frappe v16.51.0 bump).
*   Contains custom Zolexora apps (`zolexora_core`, `zolexora_platform`, `zolexora_integrations`, `zolexora_branding`).

**SOURCE B (`products/erp/`):**
*   Empty architectural scaffolding created during Phase 5 (contains only `.gitkeep`, `README.md`, and empty directory boundaries).

**SOURCE C (`products/erp_repo_clone/`):**
*   A raw SSH clone of `git@github.com:Zolexora/ZolexoraERP.git`.
*   Since the monorepo *is* the continuation of this exact repository, this clone is structurally identical to the root of the monorepo, except that its git submodules (inside `apps/`) are uninitialized and empty.

## Marketplace
*   **Source:** `ZolexoraMarketplace`
*   **Location:** `products/marketplace/`
*   **Completeness:** Complete (cloned via SSH, history preserved). Contains Next.js, mobile apps, tests, Python APIs, and rich documentation. Nested `.git` removed successfully.

## IMS
*   **Source:** `Zolexora_IMS`
*   **Location:** `products/ims/`
*   **Completeness:** Complete. Contains pnpm workspaces, apps, infra, and backend-shared modules. Nested `.git` removed.

## TMS
*   **Source:** `Zolexora_TMS`
*   **Location:** `products/tms/`
*   **Completeness:** Complete. Contains extensive React frontend, supabase backend, docs, architecture records. Nested `.git` removed.

## AI
*   **Source:** `ZolexoraAI`
*   **Location:** `products/ai/`
*   **Completeness:** Complete (cloned via SSH). Contains `backend/` (Celery, memory, tools), `frontend/`, and infra. Nested `.git` removed.

## Engage
*   **Source:** `Zolexora_Engage`
*   **Location:** `products/engage/`
*   **Completeness:** Complete.

## Ads
*   **Source:** `Zolexora_Ads`
*   **Location:** `products/ads/`
*   **Completeness:** ⚠️ **Empty Git Repository**. The remote repository exists but contains 0 commits. The scaffolding in `products/ads/` is the only content. Marked as IMPLEMENTATION PENDING.

## Cloud
*   **Source:** `ZolexoraCloud`
*   **Location:** `products/cloud/`
*   **Completeness:** ⚠️ **Empty Git Repository**. The remote repository exists but contains 0 commits. The scaffolding in `products/cloud/` is the only content. Marked as IMPLEMENTATION PENDING.

## MaunKavach
*   **Source:** `MaunKavach`
*   **Location:** `products/maunkavach/`
*   **Status:** A Zolexora-adjacent or separate product. Cloned successfully.

## RentoEasy
*   **Source:** `RentoEasy`
*   **Location:** `products/rentoeasy/`
*   **Status:** A Zolexora-adjacent or separate product. Cloned successfully.

## TheTextileCare
*   **Source:** `TheTextileCare`
*   **Location:** `products/thetextilecare/`
*   **Status:** Cloned successfully. Target architecture dictates this might be a customer-specific implementation (`solutions/customer-specific/TheTextileCare`).

## ClarityFi
*   **Source:** `ClearityFi` (Spelled ClearityFi on GitHub)
*   **Location:** `products/clarityfi/`
*   **Completeness:** Cloned via SSH successfully. Contains `apps/api-server`, `apps/mobile`, and `packages`. Nested `.git` removed.

## Canonical Product Locations

*   The true source for **ERP** is the monorepo root (represented by `backend/`, `sites/`, `compose.yaml`). It will eventually be relocated inside `products/erp/`.
*   All other products reside safely in `products/<product-name>`.
*   `ZolexoraDeployment` resides in `infrastructure/ZolexoraDeployment/`.

## Duplicate Sources

*   `products/erp_repo_clone/` is a redundant clone of the monorepo root.
*   `products/erp/` is empty scaffolding.

## Missing Sources
None. All 13 requested external repositories from the GitHub org have been successfully cloned and audited.

## Ownership Decisions

1.  **Zolexora Platform (`zolexora_platform`) App in Frappe:** Contains `ai.py`, `fleet.py`, `logistics.py`, `prediction.py`. This is **ERP-specific business logic** (Fleet, Logistics) and should remain bound to the ERP product. It is NOT the "Platform Core".
2.  **Zolexora Core (`zolexora_core`) App in Frappe:** Contains `site_setup.py`, `workspace/`, Frappe UI fixtures. This is Frappe UI customization and site infrastructure. It belongs to the **ERP Product Infrastructure**, not Platform Core.
3.  **Zolexora Integrations (`zolexora_integrations`) App in Frappe:** Contains `marketplace.py` and `notifications.py`. These are Frappe-specific adapters for external microservices. They belong to the **ERP Product Integrations**, not the Platform Core.
4.  **Non-Zolexora Products:** `MaunKavach` and `RentoEasy` are likely separate business entities/products. `TheTextileCare` is a customer-specific implementation. 

## Migration Recommendations

1.  **ERP:** The root `backend/` and Frappe Docker files should be gracefully migrated into `products/erp/`. `products/erp_repo_clone/` can be safely deleted as it is completely redundant and contains uninitialized submodules.
2.  **Customer Implementations:** Move `products/thetextilecare` to `solutions/customer-specific/TheTextileCare`.
3.  **Separate Entities:** Classify `MaunKavach` and `RentoEasy` properly within the workspace (potentially `products/maunkavach` is fine, but recognize them as distinct from Platform Core).

## Git History Considerations

Since the current monorepo *is* an evolution of the original `ZolexoraERP` repository, the Git history of the ERP is natively preserved. 
For all other cloned repositories (`Marketplace`, `TMS`, etc.), their `.git` folders were stripped, meaning they currently exist as flat additions in the monorepo history. Since the explicit goal is one unified Zolexora Platform, this flattens the history moving forward while the legacy standalone repos act as historical archives.

## Risks
Moving `backend/` to `products/erp/` will break Docker volume paths, Frappe bench commands, and site references if not executed methodically.

## Next Phase
Execute the carefully sequenced move of the root ERP implementation into `products/erp/`, validate the Docker Compose paths, and establish the Platform Core adapters (Phase 6).
