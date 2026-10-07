# Product Source Audit

## Repository Inventory

We have successfully audited and consolidated the repositories from the Zolexora GitHub organization into the `Zolexora_Platform` monorepo.

*   `Zolexora` (Monorepo root)
*   `ZolexoraMarketplace` -> `products/ZolexoraMarketplace`
*   `Zolexora_IMS` -> `products/ZolexoraIMS`
*   `Zolexora_TMS` -> `products/ZolexoraTMS`
*   `ZolexoraAI` -> `products/ZolexoraAI`
*   `ZolexoraERP` -> Monorepo Root (historically) + `products/ZolexoraERP_repo_clone` (safety copy)
*   `MaunKavach` -> `products/MaunKavach`
*   `RentoEasy` -> `products/RentoEasy`
*   `ZolexoraDeployment` -> `infrastructure/ZolexoraDeployment`
*   `Zolexora_Engage` -> `products/ZolexoraEngage`
*   `Zolexora_Ads` -> `products/ads`
*   `ZolexoraCloud` -> `products/cloud`
*   `TheTextileCare` -> `products/TheTextileCare`
*   `ClearityFi` -> `products/ClarityFi`

## ERP Source Comparison

**SOURCE A (`backend/` in Root):**
*   This is the canonical, actively developed Frappe/ERPNext implementation.
*   It contains populated submodules and the most recent updates (e.g. Frappe v16.51.0 bump).
*   Contains custom Zolexora apps (`zolexora_core`, `zolexora_platform`, `zolexora_integrations`, `zolexora_branding`).

**SOURCE B (`products/ZolexoraERP/`):**
*   Empty architectural scaffolding created during Phase 5 (contains only `.gitkeep`, `README.md`, and empty directory boundaries).

**SOURCE C (`products/ZolexoraERP_repo_clone/`):**
*   A raw SSH clone of `git@github.com:Zolexora/ZolexoraERP.git`.
*   Since the monorepo *is* the continuation of this exact repository, this clone is structurally identical to the root of the monorepo, except that its git submodules (inside `apps/`) are uninitialized and empty.

## Marketplace
*   **Source:** `ZolexoraMarketplace`
*   **Location:** `products/ZolexoraMarketplace/`
*   **Completeness:** Complete (cloned via SSH, history preserved). Contains Next.js, mobile apps, tests, Python APIs, and rich documentation. Nested `.git` removed successfully.

## IMS
*   **Source:** `Zolexora_IMS`
*   **Location:** `products/ZolexoraIMS/`
*   **Completeness:** Complete. Contains pnpm workspaces, apps, infra, and backend-shared modules. Nested `.git` removed.

## TMS
*   **Source:** `Zolexora_TMS`
*   **Location:** `products/ZolexoraTMS/`
*   **Completeness:** Complete. Contains extensive React frontend, supabase backend, docs, architecture records. Nested `.git` removed.

## AI
*   **Source:** `ZolexoraAI`
*   **Location:** `products/ZolexoraAI/`
*   **Completeness:** Complete (cloned via SSH). Contains `backend/` (Celery, memory, tools), `frontend/`, and infra. Nested `.git` removed.

## Engage
*   **Source:** `Zolexora_Engage`
*   **Location:** `products/ZolexoraEngage/`
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
*   **Location:** `products/MaunKavach/`
*   **Status:** A Zolexora-adjacent or separate product. Cloned successfully.

## RentoEasy
*   **Source:** `RentoEasy`
*   **Location:** `products/RentoEasy/`
*   **Status:** A Zolexora-adjacent or separate product. Cloned successfully.

## TheTextileCare
*   **Source:** `TheTextileCare`
*   **Location:** `products/TheTextileCare/`
*   **Status:** Cloned successfully. Target architecture was previously assumed to be customer-specific, but it has been corrected to be an independent product natively residing in `products/TheTextileCare`.

## ClarityFi
*   **Source:** `ClearityFi` (Spelled ClearityFi on GitHub)
*   **Location:** `products/ClarityFi/`
*   **Completeness:** Cloned via SSH successfully. Contains `apps/api-server`, `apps/mobile`, and `packages`. Nested `.git` removed.

## Canonical Product Locations

*   The true source for **ERP** is the monorepo root (represented by `backend/`, `sites/`, `compose.yaml`). It will eventually be relocated inside `products/ZolexoraERP/`.
*   All other products reside safely in `products/<product-name>`.
*   `ZolexoraDeployment` resides in `infrastructure/ZolexoraDeployment/`.

## Duplicate Sources

*   `products/ZolexoraERP_repo_clone/` is a redundant clone of the monorepo root.
*   `products/ZolexoraERP/` is empty scaffolding.

## Missing Sources
None. All 13 requested external repositories from the GitHub org have been successfully cloned and audited.

## Ownership Decisions

1.  **Zolexora Platform (`zolexora_platform`) App in Frappe:** Contains `ai.py`, `fleet.py`, `logistics.py`, `prediction.py`. This is **ERP-specific business logic** (Fleet, Logistics) and should remain bound to the ERP product. It is NOT the "Platform Core".
2.  **Zolexora Core (`zolexora_core`) App in Frappe:** Contains `site_setup.py`, `workspace/`, Frappe UI fixtures. This is Frappe UI customization and site infrastructure. It belongs to the **ERP Product Infrastructure**, not Platform Core.
3.  **Zolexora Integrations (`zolexora_integrations`) App in Frappe:** Contains `marketplace.py` and `notifications.py`. These are Frappe-specific adapters for external microservices. They belong to the **ERP Product Integrations**, not the Platform Core.
4.  **Non-Zolexora Products:** `MaunKavach` and `RentoEasy` are likely separate business entities/products. `TheTextileCare` is a independent product. 

## Migration Recommendations

1.  **ERP:** The root `backend/` and Frappe Docker files should be gracefully migrated into `products/ZolexoraERP/`. `products/ZolexoraERP_repo_clone/` can be safely deleted as it is completely redundant and contains uninitialized submodules.
2.  **Customer Implementations:** Keep `products/TheTextileCare` in `products/` as an independent product.
3.  **Separate Entities:** Classify `MaunKavach` and `RentoEasy` properly within the workspace (potentially `products/MaunKavach` is fine, but recognize them as distinct from Platform Core).

## Git History Considerations

Since the current monorepo *is* an evolution of the original `ZolexoraERP` repository, the Git history of the ERP is natively preserved. 
For all other cloned repositories (`Marketplace`, `TMS`, etc.), their `.git` folders were stripped, meaning they currently exist as flat additions in the monorepo history. Since the explicit goal is one unified Zolexora Platform, this flattens the history moving forward while the legacy standalone repos act as historical archives.

## Risks
Moving `backend/` to `products/ZolexoraERP/` will break Docker volume paths, Frappe bench commands, and site references if not executed methodically.

## Next Phase
Execute the carefully sequenced move of the root ERP implementation into `products/ZolexoraERP/`, validate the Docker Compose paths, and establish the Platform Core adapters (Phase 6).
