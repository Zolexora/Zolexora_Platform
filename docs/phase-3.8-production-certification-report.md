# Phase 3.8 Production Certification Report

Date: 2026-07-03
Git commit: c2817bdaf70c13413751c9fd0d569218225fcb5d
Working tree: uncommitted Phase 3.8D, 3.8E, and 3.8F fixes and reports present
INSTALL_PAYMENTS: 0
Final decision: PRODUCTION CERTIFIED WITH RISKS

## Payments Status

Official Payments app is present and clean-site compatible, but it is not installed on the main production certification path because INSTALL_PAYMENTS=0. Payment-related workflows are not production-certified until Payments is enabled and certified on the main path.

Zolexora-specific payment logic remains in `zolexora_integrations`.

## Preserved Phase 3.8B Passed Evidence

- Payments investigation: PASSED
- Clean Payments reproduction: PASSED
- Docker build: PASSED
- Docker Compose startup: PASSED
- Bootstrap: PASSED
- Second bootstrap/idempotency: PASSED
- Required app installation: PASSED
- Healthcheck: PASSED
- Backup generation: PASSED before checksum-path fix

## Phase 3.8C Checksum Evidence

Phase 3.8C proved the backup checksum path bug was fixed for fresh backups.

Fresh backup:

```text
backups/20260703_183801
```

Manual checksum verification passed with backup-relative `SHA256SUMS` entries.

## Phase 3.8D Restore Workspace Fix Evidence

Restore now recreates Zolexora Workspaces after restore-time migration and cache clear, before search rebuild, attachment verification, and smoke validation.

Restore evidence:

```text
./scripts/restore.sh backups/20260703_183801
Result: PASSED
checksum manifest verified using backup-relative paths
Recreating Zolexora Workspaces after restore migration
{"checked": 0, "missing": 0}
{"site": "site1.example.com", "administrator_exists": true, "company_exists": true, "missing_apps": [], "missing_workspaces": [], "payments_installed": false, "scheduler_enabled": true}
restore completed successfully from backups/20260703_183801
```

## Phase 3.8E DR Data Fix Evidence

`create_dr_validation_data` no longer assumes `All Item Groups` exists. It creates/selects deterministic DR master data before inserting validation records.

Disaster recovery evidence:

```text
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh
Result: PASSED
Backup: backups/20260703_190355
checksum manifest verified using backup-relative paths
restore completed successfully from backups/20260703_190355
{"checked": 2, "missing": 0}
disaster recovery test passed; report written to docs/disaster-recovery-report.md
```

## Phase 3.8F Upgrade Import-Context Fix Evidence

`scripts/upgrade-validation.sh` now validates custom app imports through:

```bash
bench --site "$SITE" execute zolexora_core.site_setup.validate_custom_app_imports
```

The script also recreates target app services after `RUN_UPGRADE_BUILD=1` image build and validates upgrade integrity after migration.

Direct import validation:

```json
{"installed_apps_checked": ["zolexora_core", "zolexora_branding", "zolexora_platform", "zolexora_integrations"], "imported_modules": ["zolexora_core", "zolexora_core.hooks", "zolexora_core.site_setup", "zolexora_branding", "zolexora_branding.hooks", "zolexora_platform", "zolexora_platform.hooks", "zolexora_integrations", "zolexora_integrations.hooks"], "failed_imports": []}
```

No Frappe, ERPNext, or Payments core source code was modified.

## Commands Executed In Phase 3.8F

```bash
pwd
git status --short
grep -n "Validating hooks import" -n scripts/upgrade-validation.sh || true
grep -n "python" scripts/upgrade-validation.sh || true
sed -n '1,260p' scripts/upgrade-validation.sh
docker compose -f compose.yaml ps
docker compose -f compose.yaml exec -T backend bash -lc '...bench context inspection...'
docker compose -f compose.yaml exec -T backend bash -lc '...plain python and bench env python import comparison...'
docker compose -f compose.yaml exec -T backend bash -lc 'bench --site ${SITE_NAME:-site1.example.com} execute zolexora_core.site_setup.smoke_validate'
python3 -m py_compile apps/zolexora_core/zolexora_core/site_setup.py
bash -n scripts/upgrade-validation.sh
bash -n scripts/restore.sh
bash -n scripts/disaster-recovery-test.sh
bash -n scripts/healthcheck.sh
docker compose -f compose.yaml exec -T backend bench --site site1.example.com execute zolexora_core.site_setup.validate_custom_app_imports
RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh
./scripts/healthcheck.sh
./scripts/status.sh
docker compose -f compose.yaml ps
```

## App Versions

Main certification site apps:

```text
frappe                16.25.0 UNVERSIONED
erpnext               16.26.1 UNVERSIONED
zolexora_core         1.0.0   UNVERSIONED
zolexora_branding     1.0.0   UNVERSIONED
zolexora_platform     1.0.0   UNVERSIONED
zolexora_integrations 1.0.0   UNVERSIONED
```

Payments is not installed on the main certification site.

## Upgrade Validation Evidence

Command:

```bash
RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh
```

Result: PASSED

Evidence:

```text
Building target v16 image
Starting target v16 services
Running migrations
Clearing cache
Recreating Zolexora Workspaces after upgrade migration
Validating hooks import
Validating site smoke checks
Validating background workers
Validating upgrade integrity
upgrade validation report written to docs/upgrade-validation-report.md
```

Upgrade validation JSON evidence:

```json
{"site": "site1.example.com", "administrator_exists": true, "company_exists": true, "missing_apps": [], "missing_workspaces": [], "payments_installed": false, "scheduler_enabled": true}
{"installed_apps_checked": ["zolexora_core", "zolexora_branding", "zolexora_platform", "zolexora_integrations"], "failed_imports": []}
{"failed_patches": [], "schema_conflicts": [], "schema_conflict_check": "bench migrate completed before this validation"}
```

## Final Healthcheck Evidence

Command:

```bash
./scripts/healthcheck.sh
```

Result: PASSED

Evidence:

```text
2026-07-03T19:59:30+05:30 [PASS] [healthcheck] Docker Compose services are running and healthy
2026-07-03T19:59:30+05:30 [PASS] [healthcheck] MariaDB connectivity
2026-07-03T19:59:30+05:30 [PASS] [healthcheck] Redis cache ping
2026-07-03T19:59:30+05:30 [PASS] [healthcheck] Redis queue ping
2026-07-03T19:59:30+05:30 [PASS] [healthcheck] Redis socketio ping
2026-07-03T19:59:30+05:30 [PASS] [healthcheck] Backend HTTP availability
2026-07-03T19:59:30+05:30 [PASS] [healthcheck] Frontend HTTP ping
2026-07-03T19:59:31+05:30 [PASS] [healthcheck] Socket.IO process
2026-07-03T19:59:31+05:30 [PASS] [healthcheck] Scheduler process
2026-07-03T19:59:31+05:30 [PASS] [healthcheck] Short worker process
2026-07-03T19:59:31+05:30 [PASS] [healthcheck] Long worker process
2026-07-03T19:59:34+05:30 [PASS] [healthcheck] Administrator and company smoke validation
2026-07-03T19:59:36+05:30 [PASS] [healthcheck] Background worker execution
```

## Final Status Evidence

Command:

```bash
./scripts/status.sh
docker compose -f compose.yaml ps
```

Result: PASSED

Evidence:

```text
backend: healthy
mariadb: healthy
nginx: healthy
redis-cache: healthy
redis-queue: healthy
redis-socketio: healthy
scheduler: healthy
socketio: healthy
worker-long: healthy
worker-short: healthy
status report complete
```

Status output included historical MariaDB aborted-connection warnings and transient Nginx upstream warnings from earlier restarts. They are recorded as operational observations; final healthcheck and Compose state passed.

## Security Review Status

Scanner-based security certification NOT EXECUTED.

- image scan: NOT EXECUTED
- dependency scan: NOT EXECUTED
- secret scan: NOT EXECUTED

## CI Status

CI status: NOT CERTIFIED

GitHub Actions was not actually run during Phase 3.8F.

## Remaining Risks

- Payments is disabled on the main certification path.
- Scanner-based security certification was not executed.
- GitHub Actions was not executed.
- Historical MariaDB and Nginx warnings remain in recent logs after repeated local restart/test activity.
- Required Zolexora Workspaces are currently protected by post-migration recreation; the stronger long-term fix is app-owned standard Workspace JSON/fixtures.

## Final Decision

PRODUCTION CERTIFIED WITH RISKS
