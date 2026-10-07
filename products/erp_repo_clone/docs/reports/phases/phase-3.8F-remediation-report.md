# Phase 3.8F Remediation Report

Date: 2026-07-03
Git commit: c2817bdaf70c13413751c9fd0d569218225fcb5d
Main path: INSTALL_PAYMENTS=0

## Certification Decision

PRODUCTION CERTIFIED WITH RISKS

Phase 3.8F fixed upgrade validation import context, reran upgrade validation against freshly built app images, and completed final health/status gates.

## Required Inspection Findings

Repository path:

```text
/home/chickenman/Documents/my_projects/ZolexoraERP
```

Initial working tree contained uncommitted Phase 3.8D and 3.8E fixes and reports.

`scripts/upgrade-validation.sh` previously validated hooks with plain Python:

```text
70:step "Validating hooks import"
71:compose_exec backend python - <<'PY'
```

Backend bench context:

```text
/home/frappe/frappe-bench
apps: erpnext, frappe, payments, zolexora_branding, zolexora_core, zolexora_integrations, zolexora_platform
sites/apps.txt includes payments and all Zolexora apps
main site installed apps: frappe, erpnext, zolexora_core, zolexora_branding, zolexora_platform, zolexora_integrations
```

Import context evidence:

```text
Plain python:
/usr/local/bin/python
plain python import zolexora_core: FAILED: ModuleNotFoundError("No module named 'zolexora_core'")

Bench env python:
/home/frappe/frappe-bench/env/bin/python
bench env python import zolexora_core: OK
```

Bench-context smoke validation worked:

```json
{"site": "site1.example.com", "administrator_exists": true, "company_exists": true, "missing_apps": [], "missing_workspaces": [], "payments_installed": false, "scheduler_enabled": true}
```

## Root Cause

`scripts/upgrade-validation.sh` used plain `/usr/local/bin/python` inside the backend container. That interpreter did not have the bench app paths, so imports such as `zolexora_core` failed even though the apps were installed and worked through `bench --site ... execute`.

## Fix Applied

Updated `apps/zolexora_core/zolexora_core/site_setup.py`:

- Added `validate_custom_app_imports()` to validate required Zolexora apps and hooks from an initialized Frappe site context.
- Added `validate_upgrade_integrity()` to fail if `Patch Log` contains tracebacks after migration.

Updated `scripts/upgrade-validation.sh`:

- Replaced plain Python hook validation with `bench --site "$SITE" execute zolexora_core.site_setup.validate_custom_app_imports`.
- Added service recreation after `RUN_UPGRADE_BUILD=1` image build so migration runs against freshly built app images.
- Added explicit upgrade integrity validation after worker validation.
- Preserved migration, cache clear, post-migration Workspace recreation, smoke validation, scheduler/worker validation, and non-zero failure behavior.

No Frappe, ERPNext, or Payments core source code was modified.

## Validation Evidence

Static validation passed:

```bash
python3 -m py_compile apps/zolexora_core/zolexora_core/site_setup.py
bash -n scripts/upgrade-validation.sh
bash -n scripts/restore.sh
bash -n scripts/disaster-recovery-test.sh
bash -n scripts/healthcheck.sh
```

Direct import validation passed:

```json
{"installed_apps_checked": ["zolexora_core", "zolexora_branding", "zolexora_platform", "zolexora_integrations"], "imported_modules": ["zolexora_core", "zolexora_core.hooks", "zolexora_core.site_setup", "zolexora_branding", "zolexora_branding.hooks", "zolexora_platform", "zolexora_platform.hooks", "zolexora_integrations", "zolexora_integrations.hooks"], "failed_imports": []}
```

Upgrade validation passed:

```text
RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh
Result: PASSED
Image build/pull completed
Target v16 services recreated
Migration completed
Workspaces recreated after migration
Import validation passed
Smoke validation passed
Worker probe passed
Upgrade integrity passed
```

Upgrade integrity evidence:

```json
{"failed_patches": [], "schema_conflicts": [], "schema_conflict_check": "bench migrate completed before this validation"}
```

Final healthcheck passed:

```text
MariaDB connectivity: PASS
Redis cache/queue/socketio ping: PASS
Backend HTTP availability: PASS
Frontend HTTP ping: PASS
Socket.IO process: PASS
Scheduler process: PASS
Short worker process: PASS
Long worker process: PASS
Smoke validation: PASS
Background worker execution: PASS
```

Final status and Compose state showed backend, MariaDB, Nginx, Redis, scheduler, Socket.IO, and workers running healthy.

## Remaining Risks

- Payments remains disabled on the main production certification path.
- Scanner-based security certification was not executed.
- GitHub Actions was not executed.
- Status output includes historical MariaDB aborted-connection warnings and transient Nginx upstream warnings from earlier restarts; final healthcheck and Compose state passed.
- Required Zolexora Workspaces are still recreated after migration; the stronger long-term fix is app-owned standard Workspace JSON/fixtures.

Final decision: PRODUCTION CERTIFIED WITH RISKS
