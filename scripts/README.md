# Platform Scripts

Global automation scripts for the Zolexora Platform monorepo, organised by concern.

---

## Directory Layout

```
scripts/
├── audits/
│   └── codebase-audit.sh                  # Repository health & compliance audit
├── auth/
│   └── assign-admin.py                    # Grant platform-admin role to a user
├── db/
│   ├── auth-service-schema.sql            # Central auth-service schema
│   ├── migrate-schemas.sql
│   └── stress_test_render_postgres.py
├── dev/
│   ├── project-tree.py                    # Regenerates docs/project-tree.md
│   ├── scaffold-product-docker.sh         # docker-start.sh + root docker:<product>:* scripts (--check to audit)
│   ├── setup-cli-ecosystem.sh             # `pnpm cli:setup` / `ecosystem:setup`
│   ├── setup-devcontainer.sh              # Provisions .venv, Frappe symlinks (run manually)
│   └── start-all-products-dev.sh          # Starts all product dev servers in background
├── docker/                                # Container shims (used by Dockerfile / compose.yaml)
│   ├── configure-frappe-common-site.sh    # Injects DB/Redis URLs into bench config at container start
│   ├── prune-except-devcontainer.sh       # `pnpm docker:prune`: deep prune that keeps devcontainer images/volumes
│   └── yarn-wrapper.sh                    # Thin yarn shim bind-mounted into the frontend container
├── ports/
│   ├── patch-frontend-dev-ports.js        # Patches Vite/Next.js dev ports in package.json
│   └── patch-backend-service-ports.py     # Patches backend service ports across products
└── setup/
    ├── infisical-init.sh                  # One-time Infisical CLI login/setup
    ├── start.sh                           # Universal interactive / CLI startup orchestrator
    └── with-infisical.sh                  # Only secret entry point: with-infisical.sh <product-dir> <command>
```

---

## Product-Specific Scripts

Product-specific deployment, lifecycle, and testing scripts are located in their respective product directories under `apps/<category>/<product>/scripts/`:

| Product | Canonical Path | Key Scripts |
|---|---|---|
| **ClarityFi** | [`apps/platform-apps/clarityfi/scripts/`](../apps/platform-apps/clarityfi/scripts/) | `verify-tunnel.js` |
| **RentoEasy** | [`apps/platform-apps/rentoeasy/scripts/`](../apps/platform-apps/rentoeasy/scripts/) | `migrate-prisma-codespaces.sh` |
| **The Textile Care** | [`apps/platform-apps/textile-care/scripts/`](../apps/platform-apps/textile-care/scripts/) | `start-docker.sh`, `start-local.sh` |
| **Zolexora AI** | [`apps/platform-core/zolexora-ai/scripts/`](../apps/platform-core/zolexora-ai/scripts/) | `deploy-azure.sh`, `seed-ai-memory.sh`, `setup-azure-resources.sh` |
| **Zolexora Engage** | [`apps/platform-core/zolexora-engage/scripts/`](../apps/platform-core/zolexora-engage/scripts/) | `start-project.sh`, `start-web-dev.sh`, `run-post-merge-hooks.sh` |
| **Zolexora ERP** | [`apps/platform-core/zolexora-erp/scripts/`](../apps/platform-core/zolexora-erp/scripts/) | `bootstrap-frappe-site.sh`, `backup-frappe-site.sh`, `restore-frappe-site.sh`, `schedule-daily-backup.sh`, `check-frappe-stack-health.sh`, `report-frappe-stack-status.sh`, `cleanup-workspaces.py`, `tests/` |
| **Zolexora IMS** | [`apps/platform-core/zolexora-ims/scripts/`](../apps/platform-core/zolexora-ims/scripts/) | `setup.sh`, `deploy.sh`, `check-health.sh`, `db-ops.sh`, `docker-start.sh`, `menu.sh`, `run-all-tests.sh`, `mcp-payments-server.py` |
| **Zolexora IronClub** | [`apps/platform-apps/ironclub/scripts/`](../apps/platform-apps/ironclub/scripts/) | `dev.sh`, `test.sh` |
| **Zolexora Shop** | [`apps/platform-apps/marketplace/scripts/`](../apps/platform-apps/marketplace/scripts/) | `check-openapi-drift.sh`, `generate-openapi.py`, `validate-doc-links.py`, `verify-workspace.mjs` |
| **Every product** | `apps/<category>/<product>/scripts/` | `docker-start.sh` (start, stop, restart, build, pull, status, logs) |
| **Zolexora TMS** | [`apps/platform-core/zolexora-tms/scripts/`](../apps/platform-core/zolexora-tms/scripts/) | `docker-start.sh`, `local-start.sh` |

---

## Quick Reference

### Zolexora ERP Operations

```bash
./apps/platform-core/zolexora-erp/scripts/bootstrap-frappe-site.sh            # First-time site setup
./apps/platform-core/zolexora-erp/scripts/backup-frappe-site.sh               # Create verified backup
./apps/platform-core/zolexora-erp/scripts/restore-frappe-site.sh <backup-dir> # Restore from backup
./apps/platform-core/zolexora-erp/scripts/check-frappe-stack-health.sh        # Health check all services
./apps/platform-core/zolexora-erp/scripts/report-frappe-stack-status.sh       # Operational status report
```

### Zolexora ERP Tests

```bash
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./apps/platform-core/zolexora-erp/scripts/tests/test-disaster-recovery.sh
ZOLEXORA_ALLOW_CLEAN_SITE_TEST=1 ./apps/platform-core/zolexora-erp/scripts/tests/test-payments-clean-site.sh
RUN_UPGRADE_BUILD=1 ./apps/platform-core/zolexora-erp/scripts/tests/test-upgrade-validation.sh
```

### Developer Environment

```bash
./scripts/dev/setup-devcontainer.sh       # Run manually after the container is created
./scripts/dev/start-all-products-dev.sh   # Start all product dev servers
./scripts/setup/start.sh                  # Universal stack orchestrator
```

### Port Utilities

Allocates and patches unique ports across all Zolexora Platform products to avoid conflicts during local multi-app development.

| Script | Purpose | Runtime |
|---|---|---|
| [`patch-frontend-dev-ports.js`](ports/patch-frontend-dev-ports.js) | Patches Vite/Next.js dev ports in frontend `package.json` files (3031, 3041, 3051, 3101, etc.) | `node scripts/ports/patch-frontend-dev-ports.js` |
| [`patch-backend-service-ports.py`](ports/patch-backend-service-ports.py) | Recursively patches backend service ports (replaces 8000/8001 with 4010–4100) across product backends | `python3 scripts/ports/patch-backend-service-ports.py` |
