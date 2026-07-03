# Phase 3.8D Remediation Report

Date: 2026-07-03
Git commit: c2817bdaf70c13413751c9fd0d569218225fcb5d
Working tree: uncommitted Phase 3.8D restore and upgrade-validation fixes applied
Main path: INSTALL_PAYMENTS=0

## Certification Decision

NOT PRODUCTION CERTIFIED

Restore re-certification passed after the Workspace lifecycle fix. Disaster recovery failed at deterministic DR validation data creation, so certification stopped before upgrade validation and final production gates.

## Required Investigation Findings

Commands executed:

```bash
grep -R "create_custom_workspaces" -n apps/zolexora_core scripts || true
grep -R "smoke_validate" -n apps/zolexora_core scripts || true
sed -n '1,260p' apps/zolexora_core/zolexora_core/site_setup.py
sed -n '1,260p' scripts/restore.sh
sed -n '1,260p' scripts/init-site.sh
sed -n '1,180p' scripts/healthcheck.sh
sed -n '1,180p' scripts/upgrade-validation.sh
```

Findings:

- `scripts/init-site.sh` creates Zolexora Workspaces after final migration and cache clear.
- `scripts/restore.sh` previously did not recreate Workspaces after restore-time migration before smoke validation.
- `create_custom_workspaces` creates missing Workspaces only and skips existing Workspaces.
- `create_custom_workspaces` skips Workspaces whose backing module is unavailable.
- It is safe to call after restore migration because it is idempotent and uses only app-owned Zolexora Workspace definitions.
- `scripts/healthcheck.sh` remains strict because it calls `zolexora_core.site_setup.smoke_validate`.
- `scripts/upgrade-validation.sh` also needed post-migration Workspace recreation because upgrade migrations can remove the same dynamic Workspace records.

## Fix Applied

Updated `scripts/restore.sh`:

```bash
bench --site "$SITE" migrate
bench --site "$SITE" clear-cache
bench --site "$SITE" execute zolexora_core.site_setup.create_custom_workspaces
bench --site "$SITE" build-search-index
bench --site "$SITE" execute zolexora_core.site_setup.verify_attachment_integrity
bench --site "$SITE" execute zolexora_core.site_setup.smoke_validate
```

Updated `scripts/upgrade-validation.sh` to recreate Workspaces after upgrade migration and cache clear, before smoke validation.

Updated `apps/zolexora_core/zolexora_core/site_setup.py` so `create_custom_workspaces` returns a useful summary:

- `created`
- `existing`
- `skipped`

The function remains idempotent and does not add business modules or payment features.

No Frappe, ERPNext, or Payments core source code was modified.

## Static Validation

Commands:

```bash
bash -n scripts/restore.sh
bash -n scripts/upgrade-validation.sh
python3 -m py_compile apps/zolexora_core/zolexora_core/site_setup.py
```

Result: PASSED

## Restore Re-Certification

Backup used:

```text
backups/20260703_183801
```

This backup was generated and checksum-verified in Phase 3.8C after the SHA256SUMS path fix.

Command:

```bash
./scripts/restore.sh backups/20260703_183801
```

Result: PASSED

Evidence:

```text
2026-07-03T18:45:05+05:30 [INFO] [restore] Verifying checksum manifest
20260703_183802-site1_example_com-database.sql.gz: OK
20260703_183802-site1_example_com-files.tar: OK
20260703_183802-site1_example_com-private-files.tar: OK
20260703_183802-site1_example_com-site_config_backup.json: OK
2026-07-03T18:45:05+05:30 [INFO] [restore] checksum manifest verified using backup-relative paths
Site site1.example.com has been restored with files
2026-07-03T18:45:28+05:30 [INFO] [restore] Running migrations
Removing orphan Workspaces
Deleting entity Workspace Zolexora AI
Deleting entity Workspace Zolexora Administration
Deleting entity Workspace Zolexora Analytics
Deleting entity Workspace Zolexora Logistics
Deleting entity Workspace Zolexora Fleet
Deleting entity Workspace Zolexora CRM
Deleting entity Workspace Zolexora Inventory
Deleting entity Workspace Zolexora Purchase
Deleting entity Workspace Zolexora Sales
Deleting entity Workspace Zolexora Accounts
Deleting entity Workspace Zolexora Dashboard
2026-07-03T18:45:41+05:30 [INFO] [restore] Clearing cache
2026-07-03T18:45:42+05:30 [INFO] [restore] Recreating Zolexora Workspaces after restore migration
2026-07-03T18:45:47+05:30 [INFO] [restore] Verifying attachment integrity
{"checked": 0, "missing": 0}
2026-07-03T18:45:48+05:30 [INFO] [restore] Running smoke validation
{"site": "site1.example.com", "administrator_exists": true, "company_exists": true, "missing_apps": [], "missing_workspaces": [], "payments_installed": false, "scheduler_enabled": true}
2026-07-03T18:45:50+05:30 [INFO] [restore] restore completed successfully from backups/20260703_183801
```

Restore passed:

- checksum verification
- database restore
- public files restore
- private files restore
- site config restore/check
- migration
- cache clear
- Workspace recreation
- search index rebuild
- attachment integrity verification
- smoke validation

## Post-Restore Healthcheck

Command:

```bash
./scripts/healthcheck.sh
```

Result: PASSED

Evidence:

```text
2026-07-03T18:45:54+05:30 [PASS] [healthcheck] Docker Compose services are running and healthy
2026-07-03T18:45:54+05:30 [PASS] [healthcheck] MariaDB connectivity
2026-07-03T18:45:54+05:30 [PASS] [healthcheck] Redis cache ping
2026-07-03T18:45:55+05:30 [PASS] [healthcheck] Redis socketio ping
2026-07-03T18:45:55+05:30 [PASS] [healthcheck] Backend HTTP availability
2026-07-03T18:45:55+05:30 [PASS] [healthcheck] Frontend HTTP ping
2026-07-03T18:45:55+05:30 [PASS] [healthcheck] Socket.IO process
2026-07-03T18:45:55+05:30 [PASS] [healthcheck] Scheduler process
2026-07-03T18:45:56+05:30 [PASS] [healthcheck] Long worker process
2026-07-03T18:45:59+05:30 [PASS] [healthcheck] Administrator and company smoke validation
2026-07-03T18:46:01+05:30 [PASS] [healthcheck] Background worker execution
2026-07-03T18:46:01+05:30 [INFO] [healthcheck] healthcheck completed successfully
```

## Disaster Recovery Failure

Command:

```bash
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh
```

Result: FAILED

Failed step:

```text
Creating DR validation data
```

Exact error:

```text
frappe.exceptions.LinkValidationError: Could not find Item Group: All Item Groups
```

Root cause:

`zolexora_core.site_setup.create_dr_validation_data` falls back to `All Item Groups` when no non-group Item Group is found, but the current site does not contain that Item Group. This prevents creation of the deterministic DR Item before the backup/destruction/restore portion of the DR test.

## Impacted Files

- `apps/zolexora_core/zolexora_core/site_setup.py`
- `scripts/restore.sh`
- `scripts/upgrade-validation.sh`
- `docs/phase-3.8D-remediation-report.md`
- `docs/disaster-recovery-report.md`
- `docs/phase-3.8-production-certification-report.md`
- `docs/security-review.md`
- `docs/production-guide.md`

## Safe Fix Plan

1. Keep `INSTALL_PAYMENTS=0` on the main production certification path.
2. Do not modify Frappe, ERPNext, or Payments core.
3. Fix deterministic DR validation data setup so it creates or selects required ERPNext masters safely before inserting the validation Item.
4. Preserve strict smoke validation and required Workspace checks.
5. Re-run DR from the start after the DR validation data fix.
6. Continue to upgrade validation and final health/status only after DR passes.

Long-term recommendation: convert required Zolexora Workspaces into app-owned standard Workspace JSON/fixtures so Frappe migration owns them directly. Phase 3.8D used the accepted post-migration recreation fix instead.

## Status

- Restore Workspace lifecycle fix: PASSED
- Restore re-certification: PASSED
- Post-restore healthcheck: PASSED
- Disaster recovery: FAILED
- Upgrade validation: NOT RUN after DR stop condition
- Final health/status: NOT RUN after DR stop condition
- Scanner-based security certification: NOT EXECUTED
- CI status: NOT CERTIFIED

Final decision: NOT PRODUCTION CERTIFIED
