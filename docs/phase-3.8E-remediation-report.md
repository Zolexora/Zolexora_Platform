# Phase 3.8E Remediation Report

Date: 2026-07-03
Git commit: c2817bdaf70c13413751c9fd0d569218225fcb5d
Working tree: uncommitted Phase 3.8D and 3.8E fixes and reports present
Main path: INSTALL_PAYMENTS=0

## Certification Decision

NOT PRODUCTION CERTIFIED

Phase 3.8E fixed deterministic disaster recovery validation data creation and disaster recovery passed. Certification stopped at upgrade validation because hook import validation failed.

## Required Investigation Findings

Commands executed:

```bash
grep -R "create_dr_validation_data" -n apps/zolexora_core scripts || true
sed -n '150,260p' apps/zolexora_core/zolexora_core/site_setup.py
docker compose -f compose.yaml exec -T backend bench --site site1.example.com console
```

Observed Item Group state before the fix:

```text
All Item Groups exists: None
Item Groups: []
UOM Nos exists: Nos
```

Additional master-data checks showed the certification site also had no Customer Groups, Territories, or Supplier Groups.

Root cause of the DR blocker:

`zolexora_core.site_setup.create_dr_validation_data` fell back to the literal Item Group `All Item Groups`, but the current certification site did not contain that record. ERPNext link validation rejected the deterministic DR Item.

## Fix Applied

Updated `apps/zolexora_core/zolexora_core/site_setup.py`.

`create_dr_validation_data` now ensures deterministic DR master data before inserting validation records:

- UOM `Nos` remains required.
- Item Group root `All Item Groups` is created if missing.
- Item Group `Zolexora DR Item Group` is created if missing.
- Customer Group root `All Customer Groups` is created if missing.
- Customer Group `Zolexora DR Customer Group` is created if missing.
- Territory root `All Territories` is created if missing.
- Territory `Zolexora DR Territory` is created if missing.
- Supplier Group `Zolexora DR Supplier Group` is created if missing.

The fix is idempotent, does not overwrite existing master records, and does not add new business modules or payment features.

No Frappe, ERPNext, or Payments core source code was modified.

## Static Validation

Commands:

```bash
python3 -m py_compile apps/zolexora_core/zolexora_core/site_setup.py
bash -n scripts/disaster-recovery-test.sh
bash -n scripts/restore.sh
bash -n scripts/upgrade-validation.sh
```

Result: PASSED

## Direct DR Data Test

The running backend image initially still contained the pre-fix app code, so the direct test reproduced the old `All Item Groups` error. Docker images were rebuilt and the runtime services were recreated so the container used the updated app code.

Command:

```bash
docker compose -f compose.yaml build
docker compose -f compose.yaml up -d backend scheduler worker-short worker-long socketio nginx
docker compose -f compose.yaml exec -T backend bench --site site1.example.com execute zolexora_core.site_setup.create_dr_validation_data
```

Result: PASSED

Evidence:

```json
{"item":"ZEX-DR-ITEM-0001","item_group":"Zolexora DR Item Group","customer":"Zolexora DR Customer","customer_group":"Zolexora DR Customer Group","territory":"Zolexora DR Territory","supplier":"Zolexora DR Supplier","supplier_group":"Zolexora DR Supplier Group","public_file":"5586f7563b","private_file":"a1ae33a730"}
```

## Disaster Recovery Re-Certification

Command:

```bash
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh
```

Result: PASSED

Evidence:

```text
Backup directory: backups/20260703_190355
checksum manifest verified using backup-relative paths
restore completed successfully from backups/20260703_190355
{"checked": 2, "missing": 0}
{"site": "site1.example.com", "administrator_exists": true, "company_exists": true, "missing_apps": [], "missing_workspaces": [], "payments_installed": false, "scheduler_enabled": true, "item_exists": true, "customer_exists": true, "supplier_exists": true, "public_file_exists": true, "private_file_exists": true, "attachment_integrity": {"checked": 2, "missing": 0}, "validator": "create_dr_validation_data"}
disaster recovery test passed; report written to docs/disaster-recovery-report.md
```

DR verified deterministic validation data, public/private files, full backup, controlled destruction, restore, post-migration Workspace recreation, restored validation data, attachment integrity, scheduler, workers, MariaDB, Redis, HTTP, Socket.IO, and final smoke validation.

## Upgrade Validation Failure

Command:

```bash
RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh
```

Result: FAILED

Passed before failure:

- Current app versions recorded.
- Docker image build with pull completed.
- Site migration completed.
- Cache clear completed.
- Zolexora Workspaces were recreated after upgrade migration.

Failed step:

```text
Validating hooks import
```

Exact error output:

```text
Traceback (most recent call last):
  File "<stdin>", line 8, in <module>
  File "/usr/local/lib/python3.14/importlib/__init__.py", line 88, in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
ModuleNotFoundError: No module named 'zolexora_core'
```

Root cause:

`scripts/upgrade-validation.sh` validates hook imports with plain `python` inside the backend container. That command does not run in the same bench/Frappe app import context used by `bench --site ... execute`, so the custom app module path is not available to the interpreter.

Impacted files:

- `scripts/upgrade-validation.sh`
- `docs/upgrade-validation-report.md`
- `docs/phase-3.8E-remediation-report.md`
- `docs/phase-3.8-production-certification-report.md`

Safe fix plan:

1. Keep `INSTALL_PAYMENTS=0` on the main certification path.
2. Do not modify Frappe, ERPNext, or Payments core.
3. Change hook import validation to run inside a valid bench/Frappe app import context, or explicitly set the app import path for the validation command.
4. Preserve the post-migration Workspace recreation step before smoke validation.
5. Re-run `RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh`.
6. Continue to final health/status only after upgrade validation passes.

## Status

- Backup checksum verification: PASSED
- Restore re-certification: PASSED in Phase 3.8D
- Post-restore healthcheck: PASSED in Phase 3.8D
- DR validation data creation: PASSED
- Disaster recovery: PASSED
- Upgrade validation: FAILED
- Final health/status: NOT RUN after upgrade-validation stop condition
- Scanner-based security certification: NOT EXECUTED
- CI status: NOT CERTIFIED

Final decision: NOT PRODUCTION CERTIFIED
