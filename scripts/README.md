# Platform Scripts

Global automation scripts for the Zolexora Platform monorepo, organised by concern.

---

## Directory Layout

```
scripts/
├── deploy/                                # Platform deployment & infrastructure scripts
│   ├── deploy-platform.sh
│   ├── install-platform.sh
│   ├── rollback-platform.sh
│   ├── backup-platform.sh
│   ├── restore-platform.sh
│   ├── verify-platform-backup.sh
│   ├── check-platform-health.sh
│   └── diagnose-platform.sh
│
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
├── rento-easy/                            # RentoEasy product scripts
│   └── migrate-prisma-codespaces.sh
│
├── textile-care/                          # TheTextileCare product scripts
│   ├── start-docker.sh
│   └── start-local.sh
│
├── zolexora-ai/                           # Zolexora AI product scripts
│   ├── deploy-azure.sh
│   ├── seed-ai-memory.sh
│   └── setup-azure-resources.sh
│
├── zolexora-engage/                       # Zolexora Engage product scripts
│   ├── run-post-merge-hooks.sh
│   ├── start-project.sh
│   └── start-web-dev.sh
│
├── zolexora-erp/                          # Zolexora ERP (Frappe/ERPNext) site operations
│   ├── bootstrap-frappe-site.sh           # Full site bootstrap (DB, apps, migrations)
│   ├── backup-frappe-site.sh              # MariaDB dump + file archive + SHA256 manifest
│   ├── restore-frappe-site.sh             # Verified restore from a backup directory
│   ├── schedule-daily-backup.sh           # Cron entry-point → calls backup
│   ├── check-frappe-stack-health.sh       # Deep health check (services, HTTP, assets)
│   ├── report-frappe-stack-status.sh      # Operational status report (metrics, queues)
│   └── tests/
│       ├── test-disaster-recovery.sh      # E2E DR test (backup → destroy → restore)
│       ├── test-payments-clean-site.sh    # Isolated payments install test
│       └── test-upgrade-validation.sh     # v16 upgrade migration assertions
│
├── zolexora-ims/                          # Zolexora IMS product scripts
│   ├── check-health.sh
│   ├── db-ops.sh
│   ├── deploy-frontends-cloudflare.sh
│   ├── deploy-oracle-vps.sh
│   ├── deploy.sh
│   ├── docker-ops.sh
│   ├── menu.sh
│   ├── run-all-tests.sh
│   ├── setup.sh
│   └── sync-env.sh
│
├── zolexora-marketplace/                  # Zolexora Marketplace product scripts
│   └── check-openapi-drift.sh
│
└── zolexora-tms/                          # Zolexora TMS product scripts
    ├── setup-cli-ecosystem.sh
    ├── start-docker.sh
    └── start-local.sh
```

---

## Quick Reference

### Zolexora ERP Operations

```bash
./scripts/zolexora-erp/bootstrap-frappe-site.sh            # First-time site setup
./scripts/zolexora-erp/backup-frappe-site.sh               # Create verified backup
./scripts/zolexora-erp/restore-frappe-site.sh <backup-dir> # Restore from backup
./scripts/zolexora-erp/check-frappe-stack-health.sh        # Health check all services
./scripts/zolexora-erp/report-frappe-stack-status.sh       # Operational status report
```

### Zolexora ERP Tests

```bash
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/zolexora-erp/tests/test-disaster-recovery.sh
ZOLEXORA_ALLOW_CLEAN_SITE_TEST=1 ./scripts/zolexora-erp/tests/test-payments-clean-site.sh
RUN_UPGRADE_BUILD=1 ./scripts/zolexora-erp/tests/test-upgrade-validation.sh
```

### Developer Environment

```bash
./scripts/dev/setup-devcontainer.sh    # Run manually or via postCreateCommand
./scripts/dev/start-all-products-dev.sh   # Start all product dev servers
```

### Port Utilities

Allocates and patches unique ports across all Zolexora Platform products to avoid conflicts during local multi-app development.

| Script | Purpose | Runtime |
|---|---|---|
| [`patch-frontend-dev-ports.js`](ports/patch-frontend-dev-ports.js) | Patches Vite/Next.js dev ports in frontend `package.json` files (3031, 3041, 3051, 3101, etc.) | `node scripts/ports/patch-frontend-dev-ports.js` |
| [`patch-backend-service-ports.py`](ports/patch-backend-service-ports.py) | Recursively patches backend service ports (replaces 8000/8001 with 4010–4100) across product backends | `python3 scripts/ports/patch-backend-service-ports.py` |

---
