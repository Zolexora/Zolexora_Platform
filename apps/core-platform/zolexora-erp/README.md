# Zolexora ERP

Frappe/ERPNext-based ERP. Everything for the product lives in this folder.

## Layout

- `services/frappe/frappe`, `services/frappe/erpnext`, `services/frappe/payments`: upstream git submodules (branch `version-16`). Run `git submodule update --init --recursive` after cloning.
- `services/frappe/zolexora_core`, `zolexora_platform`, `zolexora_integrations`, `zolexora_branding`: first-party Frappe apps. They stay inside the ERP boundary and are not shared `packages/`.
- `scripts/`: site bootstrap, health, backup/restore (`*-frappe-site.sh`) and `scripts/tests/` (disaster-recovery, upgrade, payments clean-site checks).
- `compose.yaml`: the ERP stack (MariaDB, Redis cache/queue/socketio, backend, short/long workers, scheduler, socketio, nginx). Images are built from `infrastructure/containers/docker/Dockerfile` (backend, on `frappe/erpnext:version-16`) and `infrastructure/containers/compose/Dockerfile.nginx`. Start it with `pnpm docker:erp:start`.

## Docs

See [docs/README.md](docs/README.md).
