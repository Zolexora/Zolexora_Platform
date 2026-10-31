# Zolexora ERP

Frappe/ERPNext-based ERP. Everything for the product lives in this folder.

## Layout

- `backend/frappe`, `backend/erpnext`, `backend/payments`: upstream git submodules (branch `version-16`). Run `git submodule update --init --recursive` after cloning.
- `backend/zolexora_core`, `zolexora_platform`, `zolexora_integrations`, `zolexora_branding`: first-party Frappe apps. They stay inside the ERP boundary and are not part of the root `platform/`.
- `scripts/`: site bootstrap, health, backup/restore (`*-frappe-site.sh`) and `scripts/tests/` (disaster-recovery, upgrade, payments clean-site checks).
- `compose.yaml` + `Dockerfile`: product stack (MariaDB, Redis cache/queue, web, worker, scheduler, socketio, nginx).

## Docs

See [docs/README.md](docs/README.md).
