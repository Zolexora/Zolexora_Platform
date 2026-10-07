# Zolexora ERP Phase 3.7 Bootstrap Certification Report

Date: 2026-07-03  
Scope: Bootstrap and installation stabilization only. No new business features were added and Frappe, ERPNext, and Payments core source code were not modified.

## Directory Tree

```text
ZOLEXORAERP/
|-- .github/
|   `-- workflows/
|       `-- ci.yml
|-- apps/
|   |-- zolexora_branding/
|   |   `-- zolexora_branding/
|   |-- zolexora_core/
|   |   `-- zolexora_core/
|   |-- zolexora_integrations/
|   |   `-- zolexora_integrations/
|   `-- zolexora_platform/
|       `-- zolexora_platform/
|-- backups/
|-- branding/
|-- compose/
|   `-- nginx.conf
|-- configs/
|-- docker/
|   `-- Dockerfile
|-- docs/
|   |-- bootstrap-certification-report.md
|   `-- rc1-validation-report.md
|-- scripts/
|   |-- backup.sh
|   |-- configure-common-site.sh
|   |-- daily-backup.sh
|   |-- init-site.sh
|   `-- restore.sh
|-- sites/
|-- compose.yaml
`-- README.md
```

Note: Runtime caches, Git internals, local agent metadata, and generated container volumes are intentionally excluded from this tree.

## Certification Result

Status: Bootstrap certified for Phase 3.7.

The clean Docker bootstrap path was validated with:

```bash
docker compose -f compose.yaml build
docker compose -f compose.yaml up -d
./scripts/init-site.sh
./scripts/init-site.sh
```

The first `init-site.sh` run completed a clean site installation. The second run completed successfully against the same site and verified idempotence.

## Installation Summary

Validated command path:

```bash
docker compose up -d
./scripts/init-site.sh
```

Result:
- Docker image build completed successfully after clearing a corrupted local BuildKit cache.
- MariaDB and Redis services became healthy before site creation.
- Frappe site `site1.example.com` was created.
- ERPNext installed successfully.
- All Zolexora apps installed successfully:
  - `zolexora_core`
  - `zolexora_branding`
  - `zolexora_platform`
  - `zolexora_integrations`
- Migrations completed.
- Required ERPNext masters were validated or created.
- Company creation completed without `LinkValidationError`.
- Workspaces were created after final migration.
- Final smoke validation passed.
- All containers reported healthy.

## Evidence

Final smoke validation:

```json
{
  "site": "site1.example.com",
  "administrator_exists": true,
  "company_exists": true,
  "missing_apps": [],
  "missing_workspaces": [],
  "scheduler_enabled": true
}
```

Installed apps:

```text
frappe                16.25.0
erpnext               16.26.1
zolexora_core         1.0.0
zolexora_branding     1.0.0
zolexora_platform     1.0.0
zolexora_integrations 1.0.0
```

Final container health:

```text
zolexora-backend          healthy
zolexora-mariadb          healthy
zolexora-nginx            healthy
zolexora-redis-cache      healthy
zolexora-redis-queue      healthy
zolexora-redis-socketio   healthy
zolexora-scheduler        healthy
zolexora-socketio         healthy
zolexora-worker-long      healthy
zolexora-worker-short     healthy
```

Idempotence evidence:

The second `./scripts/init-site.sh` run completed successfully and printed:

```text
Bootstrap completed successfully. Log in at http://localhost:8000
```

## Issues Fixed

### 1. Company creation failed on missing Warehouse Type

Original failure:

```text
frappe.exceptions.LinkValidationError: Could not find Warehouse Type: Transit
```

Root cause:
- `zolexora_core.after_install` ran business setup too early.
- ERPNext master records required by company setup were not validated before company creation.
- A raw company creation path allowed generic link validation failures to surface.

Fix:
- Removed `after_install` and `after_migrate` setup hooks from `zolexora_core`.
- Moved Zolexora bootstrap into explicit ordered script phases.
- Added deterministic master validation in `zolexora_core.site_setup.validate_required_masters`.
- Automatically creates safe missing masters:
  - `UOM: Nos`
  - `Warehouse Type: Transit`
- Company creation now runs after ERPNext install, migration, and master validation.

### 2. Bootstrap was not phase ordered

Fix:
- Refactored `scripts/init-site.sh` into clear phases:
  - Starting Docker services
  - Configuring Frappe services
  - Creating Site
  - Installing `zolexora_core`
  - Running migrations
  - Validating Masters
  - Creating Company
  - Installing Branding
  - Installing Platform
  - Installing Integrations
  - Final migration
  - Creating Workspaces
  - Starting all services
  - Final Validation

### 3. Bootstrap was not idempotent

Fix:
- Site creation is skipped if the site already exists.
- App installation is skipped if the app is already installed.
- Company, roles, masters, and workspaces are created only when missing.
- Re-running `./scripts/init-site.sh` completed successfully.

### 4. Workspace creation failed on invalid or unavailable modules

Root cause:
- Workspace bootstrap referenced `HR`, which is not installed in this ERPNext image.
- Workspaces were created before `zolexora_platform` existed.
- Workspaces created before final migration were removed as orphan records.

Fix:
- Removed the unavailable HR workspace from bootstrap.
- Mapped administration workspace to ERPNext `Setup`.
- Created workspaces only after all custom apps and final migration.
- Workspace creation now skips entries whose backing module is not installed.

### 5. Healthchecks did not match runtime process model

Root cause:
- Scheduler and worker healthchecks used `pgrep`, which is not available in the ERPNext image.
- Actual commands run through Frappe's Python bench helper.
- Nginx healthcheck used `localhost`, which resolved to IPv6 first in Alpine and failed.
- Nginx also required the site host header to reach Frappe successfully.

Fix:
- Scheduler, workers, and Socket.IO healthchecks now validate `/proc/1/cmdline`.
- Nginx healthcheck now calls:

```text
http://127.0.0.1/api/method/ping
```

with the configured site host header.

### 6. Restore script restored only the database

Fix:
- `scripts/restore.sh` now requires and restores:
  - database archive
  - public files archive
  - private files archive
- Restore flow now runs:
  - `bench restore`
  - `bench migrate`
  - `bench clear-cache`
  - best-effort search index rebuild
  - attachment integrity verification

Validation status:
- Script syntax passed.
- Full destructive restore test was not executed in this bootstrap-only run.

### 7. CI did not execute the real bootstrap path

Fix:
- Added `bootstrap-validation` job to `.github/workflows/ci.yml`.
- CI now builds Docker images, starts Compose, runs `./scripts/init-site.sh`, and verifies service health.

## Files Changed

- `apps/zolexora_core/zolexora_core/hooks.py`
- `apps/zolexora_core/zolexora_core/site_setup.py`
- `scripts/init-site.sh`
- `scripts/restore.sh`
- `.github/workflows/ci.yml`
- `compose.yaml`
- `docs/bootstrap-certification-report.md`

## Remaining Risks

1. Full backup/restore certification is still pending.
   - Root cause: Phase 3.7 focused on bootstrap reliability.
   - File: `scripts/restore.sh`
   - Recommended fix: Run a destructive restore test from a backup containing database, public files, private files, and attachments.

2. CI bootstrap job was updated but not executed in GitHub Actions from this local environment.
   - File: `.github/workflows/ci.yml`
   - Recommended fix: Push the workflow and verify a clean GitHub-hosted run.

3. Docker BuildKit cache corruption occurred locally during one rebuild.
   - Root cause: Docker engine snapshot cache inconsistency, not project code.
   - Remediation applied: `docker builder prune -f`, followed by successful rebuild.

## Phase 3.7 Decision

Phase 3.7 bootstrap stabilization passes local certification.

The project is ready for RC1 re-validation of the bootstrap gate:
- Clean Docker build passed.
- `docker compose up -d` passed.
- `./scripts/init-site.sh` passed from clean volumes.
- Re-running `./scripts/init-site.sh` passed.
- No `Warehouse Type: Transit` failure remains.
- No generic `LinkValidationError` remains in the verified bootstrap path.
- All custom apps installed successfully.
- All containers report healthy.
