# ZolexoraERP — Phase 3.8G Architecture, Milestones, and Interface Contracts

## Overview
ZolexoraERP is an enterprise ERP platform based on Frappe / ERPNext with custom modular extensions (`zolexora_core`, `zolexora_branding`, `zolexora_platform`, `zolexora_integrations`) and conditional support for the Frappe `payments` app.

Phase 3.8G focuses on **Risk Closure + Official Payments Enablement Before Phase 3.9**.

---

## Architecture

```
                      +-------------------+
                      |   Nginx Frontend  | (HTTP / Port 8080)
                      +---------+---------+
                                |
        +-----------------------+-----------------------+
        |                       |                       |
+-------v-------+       +-------v-------+       +-------v-------+
|  backend      |       |  socketio     |       |  mariadb      |
|  (Frappe/     |       +---------------+       |  (Database)   |
|   ERPNext)    |                               +---------------+
+-------+-------+
        |
        +-------------------+-------------------+
        |                   |                   |
+-------v-------+   +-------v-------+   +-------v-------+
| redis-cache   |   | redis-queue   |   | redis-socketio|
+---------------+   +-------+-------+   +---------------+
                            |
            +---------------+---------------+
            |               |               |
    +-------v-------+ +-----v-------+ +-----v-------+
    | scheduler     | |worker-short | | worker-long |
    +---------------+ +-------------+ +-------------+
```

### Components
1. **Frontend / Nginx**: Reverse proxy serving static assets and proxying requests to backend and socketio.
2. **Backend**: Frappe gunicorn app server supporting core apps (`frappe`, `erpnext`, `zolexora_core`, `zolexora_branding`, `zolexora_platform`, `zolexora_integrations`) and conditionally `payments`.
3. **Database**: MariaDB storing relational data and Frappe DocTypes.
4. **Redis Clusters**: Separate Redis instances for cache (`redis-cache`), background job queue (`redis-queue`), and realtime WebSockets (`redis-socketio`).
5. **Workers & Scheduler**: Background job execution (`worker-short`, `worker-long`) and cron scheduler (`scheduler`).

---

## 16 Phase Milestones (Phases 0 through 15)

| Phase | Milestone Name | Description & Action |
|-------|----------------|----------------------|
| **Phase 0** | Pre-Check Current Runtime | Run `git status --short`, `docker compose -f compose.yaml ps`, `./scripts/healthcheck.sh`, `./scripts/status.sh`. Verify container health. |
| **Phase 1** | Commit & Freeze Phase 3.8F | Freeze working tree with `git commit -m "Phase 3.8F production certification with risks"` and tag `phase-3.8f-certified-with-risks`. |
| **Phase 2** | Payments App Validity Inspection | Inspect `apps/payments` validity, check `setup.py` / `pyproject.toml`, and inspect `INSTALL_PAYMENTS` references. |
| **Phase 3** | Safety Backup Before Payments | Execute `./scripts/backup.sh` and verify SHA256SUMS. |
| **Phase 4** | Enable Payments on Main Certification Path | Set `INSTALL_PAYMENTS=1` in `.env`, update `.env.example`, ensure `.env` is git ignored. |
| **Phase 5** | Build Runtime With Payments Enabled | Build Docker images (`docker compose -f compose.yaml build`) with `INSTALL_PAYMENTS=1`. |
| **Phase 6** | Start Services and Install Payments | Run `docker compose up -d`, execute `./scripts/init-site.sh`, verify `payments` app in `bench list-apps`. |
| **Phase 7** | Payments Healthcheck & Smoke Validation | Execute `./scripts/healthcheck.sh` and `zolexora_core.site_setup.smoke_validate`. |
| **Phase 8** | Backup & Restore With Payments | Run `./scripts/backup.sh`, verify SHA256, run `./scripts/restore.sh`, verify `payments` remains installed. |
| **Phase 9** | Disaster Recovery With Payments | Run `ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh`. |
| **Phase 10** | Upgrade Validation With Payments | Execute `RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh`. Validate custom app imports. |
| **Phase 11** | CI Execution Check | Push branch/tag to remote origin and verify CI/CD execution status. |
| **Phase 12** | Security Scanner Certification | Run `gitleaks`, `trivy`, `pip-audit`, and document results in `docs/security-review.md`. |
| **Phase 13** | Workspace Long-Term Fix Decision | Formally decide and document technical debt vs. app-owned standard workspace fixtures. |
| **Phase 14** | Log Warning & UI Asset Review | Inspect MariaDB/Nginx logs, clear cache, and verify login page asset styling. |
| **Phase 15** | Final Verification & Documentation | Complete final healthcheck, status, upgrade validation, and update all `docs/` reports. |

---

## Interface Contracts

### 1. Environment Configuration Interface (`.env`)
- `SITE_NAME`: Target Frappe site (e.g. `site1.example.com`).
- `HTTP_PORT`: Exposed host HTTP port (e.g. `8080`).
- `INSTALL_PAYMENTS`: `1` to install/enable Frappe Payments app during build/init; `0` to omit.
- `MYSQL_ROOT_PASSWORD`: Root credentials for MariaDB container.

### 2. Operational Script Interface (`scripts/`)
- `./scripts/healthcheck.sh`: Non-destructive health check of containers, ports, database, Redis, workers, and smoke validation. Returns exit code 0 on success, 1 on failure.
- `./scripts/status.sh`: Displays operational metrics, container status, disk/memory usage, queue depths, and installed app versions.
- `./scripts/backup.sh`: Creates timestamped site backup archives and `SHA256SUMS` in `backups/`.
- `./scripts/restore.sh <backup_dir>`: Restores site database, config, and files from specified backup directory.
- `./scripts/init-site.sh`: Initializes site, runs migrations, installs custom apps, and sets up initial data.
- `./scripts/disaster-recovery-test.sh`: Destructive DR test (requires `ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1`).
- `./scripts/upgrade-validation.sh`: Validates v16 upgrade path, hook imports, schema migrations, and worker execution (supports `RUN_UPGRADE_BUILD=1`).

### 3. Custom Python App Interface (`zolexora_core.site_setup`)
- `smoke_validate()`: Returns JSON with keys `site`, `administrator_exists`, `company_exists`, `missing_apps`, `missing_workspaces`, `payments_installed`, `scheduler_enabled`.
- `validate_custom_app_imports()`: Validates required custom modules (`zolexora_core`, `zolexora_branding`, `zolexora_platform`, `zolexora_integrations`, and `payments` if `INSTALL_PAYMENTS=1`).
- `background_job_probe()`: Enqueues a probe job to verify async worker execution.
- `validate_upgrade_integrity()`: Validates schema integrity and patch log execution post-migration.

---

## Code Layout

```
/home/chickenman/Documents/my_projects/ZolexoraERP/
├── .agents/                      # Teamwork agent metadata & workspace logs (NOT project code)
├── apps/                         # Frappe applications
│   ├── erpnext/                  # ERPNext core app
│   ├── frappe/                   # Frappe framework core app
│   ├── payments/                 # Frappe Payments app
│   ├── zolexora_branding/        # Zolexora theme & branding customization
│   ├── zolexora_core/            # Core site setup, smoke validation & hooks
│   ├── zolexora_integrations/    # Third-party integrations
│   └── zolexora_platform/        # Platform extensions
├── backups/                      # Site backup archives
├── compose/                      # Docker compose configuration snippets
├── compose.yaml                  # Primary Docker Compose orchestration file
├── configs/                      # Service configuration files (mariadb, nginx, redis)
├── docker/                       # Dockerfile and build scripts
│   └── Dockerfile                # Multi-stage image build for Zolexora
├── docs/                         # Architecture, security, operational & remediation docs
├── scripts/                      # Operational automation bash scripts
└── sites/                        # Frappe bench sites directory (site1.example.com, apps.txt)
```
