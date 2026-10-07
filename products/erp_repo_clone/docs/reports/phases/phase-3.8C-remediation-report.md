# Phase 3.8C Remediation Report

Date: 2026-07-03
Git commit: c2817bdaf70c13413751c9fd0d569218225fcb5d
Certification scope: Restore re-certification after SHA256SUMS path fix
Main path: INSTALL_PAYMENTS=0

## Certification Decision

NOT PRODUCTION CERTIFIED

Phase 3.8C stopped during restore re-certification. The checksum-path fix was verified with a fresh backup, but restore failed at final smoke validation because required Zolexora Workspaces were missing after migration.

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

Payments strategy remains unchanged:

- Payments is present in the runtime image.
- Payments installed successfully on an isolated clean test site.
- Payments is intentionally not installed on the main site because INSTALL_PAYMENTS=0.
- Payment workflows are not production-certified.
- Zolexora-specific payment logic must remain in zolexora_integrations.

## Mandatory Pre-Check

Command:

```sh
docker compose -f compose.yaml ps
```

Result: PASSED

Evidence:

```text
zolexora-backend          Up 9 hours (healthy)
zolexora-mariadb          Up 10 hours (healthy)
zolexora-nginx            Up 9 hours (healthy)
zolexora-redis-cache      Up 10 hours (healthy)
zolexora-redis-queue      Up 10 hours (healthy)
zolexora-redis-socketio   Up 10 hours (healthy)
zolexora-scheduler        Up 9 hours (healthy)
zolexora-socketio         Up 9 hours (healthy)
zolexora-worker-long      Up 9 hours (healthy)
zolexora-worker-short     Up 6 minutes (healthy)
```

Command:

```sh
./scripts/healthcheck.sh
```

Result: PASSED

Evidence:

```text
2026-07-03T18:37:57+05:30 [INFO] [healthcheck] healthcheck completed successfully
```

Command:

```sh
docker compose -f compose.yaml exec -T backend bash -lc 'bench --site ${SITE_NAME:-site1.example.com} list-apps || true'
```

Result: PASSED

Installed apps:

```text
frappe                16.25.0 UNVERSIONED
erpnext               16.26.1 UNVERSIONED
zolexora_core         1.0.0   UNVERSIONED
zolexora_branding     1.0.0   UNVERSIONED
zolexora_platform     1.0.0   UNVERSIONED
zolexora_integrations 1.0.0   UNVERSIONED
```

Payments was not installed on the main certification site.

## Fresh Backup After Checksum Fix

Command:

```sh
./scripts/backup.sh
```

Result: PASSED

Fresh backup folder:

```text
backups/20260703_183801
```

Artifacts:

```text
20260703_183802-site1_example_com-database.sql.gz
20260703_183802-site1_example_com-files.tar
20260703_183802-site1_example_com-private-files.tar
20260703_183802-site1_example_com-site_config_backup.json
SHA256SUMS
```

Checksum manifest:

```text
56f17e57cd8964ea67ac922bb27208bdaa096efeb321f288b6daab192cbfa19d  20260703_183802-site1_example_com-database.sql.gz
becff738e99d45ddd31e116cfe55180b6bf63955938f7387add7ecb8b3173a27  20260703_183802-site1_example_com-files.tar
cf489254310dcf04f1b16828b8ce4007bdfe0e819212daf9c4bb4fa42f135daa  20260703_183802-site1_example_com-private-files.tar
7f9b9caa94410bb2c4bdd7b0128c457feef318f93ec8ea456ec0d5903f80a445  20260703_183802-site1_example_com-site_config_backup.json
```

Manual checksum command:

```sh
(cd backups/20260703_183801 && sha256sum -c SHA256SUMS)
```

Result: PASSED

Evidence:

```text
20260703_183802-site1_example_com-database.sql.gz: OK
20260703_183802-site1_example_com-files.tar: OK
20260703_183802-site1_example_com-private-files.tar: OK
20260703_183802-site1_example_com-site_config_backup.json: OK
```

The manifest uses backup-relative filenames only. The original Phase 3.8B checksum-path blocker is remediated for newly generated backups.

## Failed Command

Command:

```sh
./scripts/restore.sh backups/20260703_183801
```

Initial sandboxed attempt verified checksums and then failed on Docker API access:

```text
2026-07-03T18:38:18+05:30 [INFO] [restore] Verifying checksum manifest
20260703_183802-site1_example_com-database.sql.gz: OK
20260703_183802-site1_example_com-files.tar: OK
20260703_183802-site1_example_com-private-files.tar: OK
20260703_183802-site1_example_com-site_config_backup.json: OK
2026-07-03T18:38:18+05:30 [INFO] [restore] checksum manifest verified using backup-relative paths
2026-07-03T18:38:18+05:30 [INFO] [restore] Copying backup files into container
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```

The same restore command was rerun with elevated Docker access because container file copy requires Docker API permissions.

Result: FAILED

## Exact Error Output

Restore progressed through checksum verification, database/files restore, migration, cache clear, search-index rebuild, and attachment integrity verification. It failed at final smoke validation:

```text
2026-07-03T18:38:34+05:30 [INFO] [restore] Verifying checksum manifest
20260703_183802-site1_example_com-database.sql.gz: OK
20260703_183802-site1_example_com-files.tar: OK
20260703_183802-site1_example_com-private-files.tar: OK
20260703_183802-site1_example_com-site_config_backup.json: OK
2026-07-03T18:38:34+05:30 [INFO] [restore] checksum manifest verified using backup-relative paths
2026-07-03T18:38:35+05:30 [INFO] [restore] Restoring database and file archives
Site site1.example.com has been restored with files
2026-07-03T18:38:59+05:30 [INFO] [restore] Running migrations
2026-07-03T18:39:12+05:30 [INFO] [restore] Clearing cache
2026-07-03T18:39:14+05:30 [INFO] [restore] Rebuilding search index if supported
2026-07-03T18:39:17+05:30 [INFO] [restore] search index rebuilt
2026-07-03T18:39:17+05:30 [INFO] [restore] Verifying attachment integrity
{"checked": 0, "missing": 0}
2026-07-03T18:39:18+05:30 [INFO] [restore] Running smoke validation
Traceback (most recent call last):
  File "/home/frappe/frappe-bench/apps/frappe/frappe/commands/utils.py", line 297, in execute
    ret = frappe.get_attr(method)(*fn_args, **fn_kwargs)
  File "/home/frappe/frappe-bench/apps/zolexora_core/zolexora_core/site_setup.py", line 137, in smoke_validate
    raise BootstrapError("; ".join(failures))
zolexora_core.site_setup.BootstrapError: Missing workspaces: Zolexora Dashboard, Zolexora Accounts, Zolexora Sales, Zolexora Purchase, Zolexora Inventory, Zolexora Administration
```

During migration, Frappe also removed the dynamic Workspace records as orphan records:

```text
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
```

## Root Cause

The restore checksum-path bug is fixed, but restore is not production-certified because `bench migrate` removes dynamically created Zolexora `Workspace` records as orphan records. `scripts/init-site.sh` creates the custom workspaces after final migration, but `scripts/restore.sh` does not recreate them after its restore-time migration before running `zolexora_core.site_setup.smoke_validate`.

This is the same class of workspace lifecycle risk documented in the bootstrap certification history: dynamic Workspaces created outside app-owned workspace JSON/fixture synchronization can be removed by migration orphan cleanup.

## Impacted Files

- `scripts/restore.sh`
- `scripts/healthcheck.sh`
- `scripts/upgrade-validation.sh`
- `apps/zolexora_core/zolexora_core/site_setup.py`
- `docs/phase-3.8C-remediation-report.md`

No Frappe, ERPNext, or Payments core source code modification is required.

## Safe Fix Plan

1. Keep INSTALL_PAYMENTS=0 on the main production certification path.
2. Do not modify Frappe, ERPNext, or Payments core code.
3. Make Zolexora Workspace restoration deterministic after restore-time migration.
4. Prefer one of these safe approaches:
   - add a restore step after `bench migrate` and before smoke validation to run `bench --site "$SITE" execute zolexora_core.site_setup.create_custom_workspaces`, matching the existing post-migration bootstrap pattern; or
   - promote the required Zolexora Workspaces into app-owned standard workspace JSON/fixtures so Frappe migration owns and preserves them.
5. Re-run Phase 3.8C from the backup/restore gate using a new backup generated after the fix.
6. Only continue to DR, upgrade validation, final health/status, security/CI reporting, and the final production certification report after restore and post-restore healthcheck pass.

## Certification Status

- Backup checksum verification: PASSED
- Restore checksum verification: PASSED
- Database restore: PASSED
- Public files restore: PASSED
- Private files restore: PASSED
- Site config restore/check: PASSED
- Bench migrate: PASSED
- Bench clear-cache: PASSED
- Attachment integrity verification: PASSED
- Restore smoke validation: FAILED
- Post-restore healthcheck: NOT RUN because restore failed
- Disaster recovery certification: NOT RUN because restore failed
- Upgrade validation: NOT RUN because restore failed
- Final health/status: NOT RUN because restore failed
- Scanner-based security certification: NOT EXECUTED in Phase 3.8C
- CI status: NOT CERTIFIED

Final decision: NOT PRODUCTION CERTIFIED
