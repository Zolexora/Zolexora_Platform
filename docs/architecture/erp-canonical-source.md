# ERP Canonical Source

**Status**: Migrated
**Date**: October 2026

## 1. Product Boundary
The canonical source for ZolexoraERP is `products/ZolexoraERP/`.
This directory encapsulates the entire Frappe-based ERP implementation.

## 2. Included Components
The following components reside within the `products/ZolexoraERP/` boundary:
- `backend/`: The main Frappe application and backend services.
  - `frappe`
  - `erpnext`
  - `payments`
  - `zolexora_branding`
  - `zolexora_core`
  - `zolexora_integrations`
  - `zolexora_platform`
- `sites/`: Contains Frappe sites configuration.
- `branding/`: Contains branding assets.

## 3. Product Classification
ZolexoraERP is classified as a **first-class product** within the Zolexora Platform ecosystem, residing alongside other products such as `TheTextileCare`. 

## 4. Architectural Rules
- `zolexora_core`, `zolexora_platform`, and `zolexora_integrations` are currently maintained within the ERP boundary (`products/ZolexoraERP/backend/`) and are NOT considered part of the root `platform/` core services yet.
- Platform Core extraction will be handled in a separate, subsequent phase.
