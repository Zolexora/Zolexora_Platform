# Phase 3.8B Remediation Report

Date: 2026-07-03
Production certification blocked: Yes
Certification decision: NOT PRODUCTION CERTIFIED

## Failed Command

```bash
bash -lc 'latest_backup="$(find backups -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"; echo "$latest_backup"; ./scripts/restore.sh "$latest_backup"'
```

## Exact Error Output

```text
backups/20260703_093717
2026-07-03T09:37:35+05:30 [INFO] [restore] Locating required backup archives
2026-07-03T09:37:35+05:30 [INFO] [restore] Validating archive readability
2026-07-03T09:37:35+05:30 [INFO] [restore] Verifying checksum manifest
sha256sum: backups/20260703_093717/20260703_093718-site1_example_com-database.sql.gz: No such file or directory
sha256sum: backups/20260703_093717/20260703_093718-site1_example_com-files.tar: No such file or directory
sha256sum: backups/20260703_093717/20260703_093718-site1_example_com-private-files.tar: No such file or directory
sha256sum: backups/20260703_093717/20260703_093718-site1_example_com-site_config_backup.json: No such file or directory
sha256sum: WARNING: backups/20260703_093717/20260703_093718-site1_example_com-database.sql.gz: FAILED open or read
backups/20260703_093717/20260703_093718-site1_example_com-files.tar: FAILED open or read
backups/20260703_093717/20260703_093718-site1_example_com-private-files.tar: FAILED open or read
backups/20260703_093717/20260703_093718-site1_example_com-site_config_backup.json: FAILED open or read
4 listed files could not be read
2026-07-03T09:37:35+05:30 [ERROR] [restore] failed during step: Verifying checksum manifest
```

## Root Cause

`scripts/backup.sh` generated `SHA256SUMS` with repository-relative file paths such as:

```text
backups/20260703_093717/20260703_093718-site1_example_com-database.sql.gz
```

`scripts/restore.sh` verified the manifest from inside the backup directory:

```bash
(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
```

That made `sha256sum` look for `backups/20260703_093717/...` inside `backups/20260703_093717`, so checksum verification failed before restore execution.

## Impacted Files

- `scripts/backup.sh`
- `scripts/restore.sh`
- `docs/phase-3.8-production-certification-report.md`
- `docs/phase-3.8B-remediation-report.md`

## Remediation Applied

`scripts/backup.sh` now writes checksum entries using backup-relative basenames.

`scripts/restore.sh` now:

- verifies backup-relative manifests first
- retries legacy repository-relative manifests for backups created before this fix
- still fails loudly if neither checksum path style verifies

No Frappe, ERPNext, or Payments core files were modified.

## Safe Fix Plan

1. Rerun `./scripts/backup.sh` to generate a corrected manifest.
2. Rerun `./scripts/restore.sh "$latest_backup"`.
3. If restore passes, continue with disaster recovery and upgrade validation.
4. Keep `INSTALL_PAYMENTS=0` on the main path until Payments is explicitly enabled and certified.

## Certification Status

Certification is blocked until restore is rerun and passes with checksum verification, migration, cache clear, attachment integrity, and smoke validation.
