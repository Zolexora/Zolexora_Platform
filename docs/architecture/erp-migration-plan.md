# ERP Migration Plan
# Status: Draft

## 1. Objective
Establish `products/ZolexoraERP/` as the canonical ERP product boundary by migrating the legacy root-level ERP implementation (`backend/`, `sites/`, `branding/`) and updating all related path references in orchestration and script files.

## 2. Directory Relocation
The following root-level directories will be moved into `products/ZolexoraERP/`:
- `backend/` -> `products/ZolexoraERP/backend/`
- `sites/` -> `products/ZolexoraERP/sites/`
- `branding/` -> `products/ZolexoraERP/branding/`
- `configs/` -> `products/ZolexoraERP/configs/` (if it contains ERP-specific configuration, to be evaluated)

*Note: `products/ZolexoraERP/` currently contains empty scaffolding directories (e.g. `backend`, `frontend`, `desktop`, `mobile`, `docs`, `infrastructure`, `integrations`, `tests`). We will remove the empty `backend` directory inside `products/ZolexoraERP/` before moving the actual root `backend` in.*

## 3. Configuration Updates
The orchestrating files remain at the repository root but their path mappings must point to `products/ZolexoraERP/`.

### 3.1. `compose.yaml`
- Update volumes referencing `./backend:...` to `./products/ZolexoraERP/backend:...`
- Update volumes referencing `./sites:...` to `./products/ZolexoraERP/sites:...`
- Do NOT change the internal container paths (e.g. `/home/frappe/frappe-bench/apps`).

### 3.2. `scripts/`
- Run a search-and-replace across all `.sh` and `.py` files in `scripts/`.
- Change references from `backend/` to `products/ZolexoraERP/backend/`.
- Change references from `sites/` to `products/ZolexoraERP/sites/`.

## 4. Verification and Cleanup
1. Run `docker compose config` to ensure YAML and paths are valid.
2. Ensure that `products/ZolexoraERP/backend/` contains all apps: `frappe`, `erpnext`, `payments`, `zolexora_branding`, `zolexora_core`, `zolexora_integrations`, `zolexora_platform`.
3. Verify that `products/ZolexoraERP_repo_clone` is redundant and remove it.

## 5. Architectural Commitment
- `zolexora_core`, `zolexora_platform`, and `zolexora_integrations` will remain inside the ERP product boundary (`products/ZolexoraERP/backend/`) and will **not** be extracted to the root `platform/` directory during this phase.
- We will NOT change the Git remotes.

---
**Date**: October 2026
