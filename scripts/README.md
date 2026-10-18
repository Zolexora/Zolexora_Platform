# Platform Scripts

Global automation scripts for the Zolexora Platform monorepo, organised by concern.

---

## Directory Layout

```
scripts/
├── audits/                                # Repository health & compliance audit tools
├── auth/                                  # Platform authentication setup utilities
├── db/                                    # Database management & seed scripts
├── dev/                                   # Developer environment setup & utilities
│   ├── setup-cli-ecosystem.sh
│   ├── setup-devcontainer.sh              # Provisions .venv, Frappe symlinks (postCreateCommand)
│   └── start-all-products-dev.sh          # Starts all product dev servers in background
│
├── docker/                                # Container shims (used by Dockerfile / compose.yaml)
│   ├── configure-frappe-common-site.sh    # Injects DB/Redis URLs into bench config at container start
│   └── yarn-wrapper.sh                    # Thin yarn shim bind-mounted into the frontend container
│
├── ports/                                 # Monorepo port allocation utilities
│   ├── patch-frontend-dev-ports.js        # Patches Vite/Next.js dev ports in package.json
│   └── patch-backend-service-ports.py     # Patches backend service ports across products
│
└── setup/                                 # Monorepo bootstrapping & orchestration
    ├── infisical-init.sh
    └── start.sh                           # Universal interactive / CLI startup orchestrator
```

---

## Product-Specific Scripts

Product-specific deployment, lifecycle, and testing scripts are located in their respective product directories under `products/<product>/scripts/`:

| Product | Canonical Path | Key Scripts |
|---|---|---|
| **ClarityFi** | [`products/clarityfi/scripts/`](../products/clarityfi/scripts/) | `verify-tunnel.js` |
| **RentoEasy** | [`products/rentoeasy/scripts/`](../products/rentoeasy/scripts/) | `migrate-prisma-codespaces.sh` |
| **The Textile Care** | [`products/the-textile-care/scripts/`](../products/the-textile-care/scripts/) | `start-docker.sh`, `start-local.sh` |
| **Zolexora AI** | [`products/zolexora-ai/scripts/`](../products/zolexora-ai/scripts/) | `deploy-azure.sh`, `seed-ai-memory.sh`, `setup-azure-resources.sh` |
| **Zolexora Engage** | [`products/zolexora-engage/scripts/`](../products/zolexora-engage/scripts/) | `start-project.sh`, `start-web-dev.sh`, `run-post-merge-hooks.sh` |
| **Zolexora ERP** | [`products/zolexora-erp/scripts/`](../products/zolexora-erp/scripts/) | `bootstrap-frappe-site.sh`, `backup-frappe-site.sh`, `restore-frappe-site.sh`, `check-frappe-stack-health.sh`, `cleanup-workspaces.py`, `tests/` |
| **Zolexora IMS** | [`products/zolexora-ims/scripts/`](../products/zolexora-ims/scripts/) | `setup.sh`, `deploy.sh`, `check-health.sh`, `db-ops.sh`, `docker-ops.sh`, `menu.sh`, `run-all-tests.sh`, `sync-env.sh`, `mcp-payments-server.py` |
| **Zolexora IronClub** | [`products/zolexora-ironclub/scripts/`](../products/zolexora-ironclub/scripts/) | `dev.sh`, `test.sh` |
| **Zolexora Marketplace** | [`products/zolexora-marketplace/scripts/`](../products/zolexora-marketplace/scripts/) | `check-openapi-drift.sh`, `generate-openapi.py`, `validate-doc-links.py`, `verify-workspace.mjs` |
| **Zolexora TMS** | [`products/zolexora-tms/scripts/`](../products/zolexora-tms/scripts/) | `docker-start.sh`, `local-start.sh` |

---

## Quick Reference

### Zolexora ERP Operations

```bash
./products/zolexora-erp/scripts/bootstrap-frappe-site.sh            # First-time site setup
./products/zolexora-erp/scripts/backup-frappe-site.sh               # Create verified backup
./products/zolexora-erp/scripts/restore-frappe-site.sh <backup-dir> # Restore from backup
./products/zolexora-erp/scripts/check-frappe-stack-health.sh        # Health check all services
./products/zolexora-erp/scripts/report-frappe-stack-status.sh       # Operational status report
```

### Zolexora ERP Tests

```bash
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./products/zolexora-erp/scripts/tests/test-disaster-recovery.sh
ZOLEXORA_ALLOW_CLEAN_SITE_TEST=1 ./products/zolexora-erp/scripts/tests/test-payments-clean-site.sh
RUN_UPGRADE_BUILD=1 ./products/zolexora-erp/scripts/tests/test-upgrade-validation.sh
```

### Developer Environment

```bash
./scripts/dev/setup-devcontainer.sh       # Run manually or via postCreateCommand
./scripts/dev/start-all-products-dev.sh   # Start all product dev servers
./scripts/setup/start.sh                  # Universal stack orchestrator
```

### Port Utilities

Allocates and patches unique ports across all Zolexora Platform products to avoid conflicts during local multi-app development.

| Script | Purpose | Runtime |
|---|---|---|
| [`patch-frontend-dev-ports.js`](ports/patch-frontend-dev-ports.js) | Patches Vite/Next.js dev ports in frontend `package.json` files (3031, 3041, 3051, 3101, etc.) | `node scripts/ports/patch-frontend-dev-ports.js` |
| [`patch-backend-service-ports.py`](ports/patch-backend-service-ports.py) | Recursively patches backend service ports (replaces 8000/8001 with 4010–4100) across product backends | `python3 scripts/ports/patch-backend-service-ports.py` |
