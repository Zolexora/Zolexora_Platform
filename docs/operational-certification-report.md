# Zolexora ERP Operational Certification Report

Date: 2026-07-03
Site: `site1.example.com`
Phase: 3.8 Operational Certification
Result: Not certified

## Certification Decision

Zolexora ERP is not RC1 Certified.

Certification stopped before destructive restore, upgrade, security, performance, UI, disaster recovery, and deployment validation because mandatory operational gates failed.

## Evidence Summary

| Area | Result | Evidence |
| --- | --- | --- |
| Running containers | Pass | `docker compose -f compose.yaml ps` showed MariaDB, Redis, backend, scheduler, workers, Socket.IO, and Nginx running healthy. |
| Site smoke validation | Partial | Runtime `zolexora_core.site_setup.smoke_validate` returned Administrator present, company present, scheduler enabled, and no missing workspaces. |
| Backup creation | Pass | `bash scripts/backup.sh` created `backups/20260703_030357`. |
| Backup artifact integrity | Pass | Database gzip integrity passed, public/private file tar listings passed, all backup files were readable, and SHA-256 checksums were generated. |
| Backup scheduling | Fail | `crontab -l` returned `no crontab for chickenman`; `systemctl --user list-timers --all` showed no Zolexora backup timer. |
| Platform dependency immutability | Fail | [docker/Dockerfile](/home/chickenman/Documents/my_projects/ZolexoraERP/docker/Dockerfile:7) runs `bench get-app` for Payments instead of relying only on immutable platform dependencies from `frappe/erpnext:version-16`. |
| Runtime/source consistency | Fail | Runtime installed apps omit `payments`, while [site_setup.py](/home/chickenman/Documents/my_projects/ZolexoraERP/apps/zolexora_core/zolexora_core/site_setup.py:78) requires it in `smoke_validate`. |

## Stop Condition

The certification rules require stopping if any requirement fails. Backup scheduling failed, and the platform dependency handling does not comply with the mandatory architecture constraints. Later certification phases were not executed and are not estimated.

## Required Remediation

1. Implement an actual production backup schedule using host cron, systemd timer, or platform-native scheduled job management.
2. Add a machine-verifiable backup schedule check to CI or an operations script.
3. Remove ad hoc Payments fetching from the Dockerfile, or update the architecture decision if Payments is not actually bundled in the selected official image.
4. Rebuild the Docker image from current source and rerun clean bootstrap to eliminate runtime/source drift.
5. Rerun Phase 3.8 from the beginning after the above blockers are resolved.

