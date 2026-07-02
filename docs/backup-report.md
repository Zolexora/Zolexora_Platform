# Backup Certification Report

Date: 2026-07-03
Result: Failed due to missing operational schedule

## Verified Backup

Backup directory: `backups/20260703_030357`

Generated files:

| File | Size |
| --- | ---: |
| `20260703_030358-site1_example_com-database.sql.gz` | 893479 bytes |
| `20260703_030358-site1_example_com-files.tar` | 10240 bytes |
| `20260703_030358-site1_example_com-private-files.tar` | 10240 bytes |
| `20260703_030358-site1_example_com-site_config_backup.json` | 291 bytes |

## Integrity Evidence

SHA-256 checksums:

```text
c7a28eb3d2ff10eb1a54c28105cd4525b6b6a4d5ac22cafc85790a096d36f39a  database.sql.gz
102785f53566d9c358a306a278fd79c9e4b7f0ce15f83cccccb5c82ee6d6a3cd  files.tar
2a10a4635b672f380e1bbc27452070477fb4a9dace9370d291f06d0fa38e350c  private-files.tar
2a18a8fabda2e39b4e9c4bfadef029c161e7444032722c9960059bf2f65ff520  site_config_backup.json
```

Validation commands:

| Check | Result |
| --- | --- |
| `gzip -t` on database archive | Pass |
| `tar -tf` on public files archive | Pass |
| `tar -tf` on private files archive | Pass |
| Readability checks on all backup files | Pass |

## Scheduling Evidence

Backup scheduling is not certified.

`crontab -l` returned `no crontab for chickenman`.

`systemctl --user list-timers --all` returned four unrelated user timers and no Zolexora backup timer.

## Retention Evidence

[scripts/backup.sh](/home/chickenman/Documents/my_projects/ZolexoraERP/scripts/backup.sh:19) defaults `BACKUP_RETENTION_DAYS` to 30 and prunes old backup directories. Retention behavior was not certified end to end because there is no active backup schedule.

## Decision

Backup creation and backup integrity passed. Backup certification failed because scheduling is not operationally installed or verifiable.

