# Phase 3.8B Production Certification Report

Date: 2026-07-03
Git commit: `795d99d`
Final decision: NOT PRODUCTION CERTIFIED

## Docker Image Evidence

```text
zolexoraerp-backend        latest  0ef82e499d4b  916MB
zolexoraerp-scheduler      latest  fd17eaebb3c9  916MB
zolexoraerp-socketio       latest  2483affdb2f0  916MB
zolexoraerp-worker-long    latest  1496e88bbfda  916MB
zolexoraerp-worker-short   latest  ebd5a52d392e  916MB
mariadb                    10.11   be981e411332  104MB
redis                      7-alpine 6ab0b6e73817 16.3MB
nginx                      stable-alpine 0d3b80406a13 26MB
```

## App Versions

```text
frappe                16.25.0
erpnext               16.26.1
zolexora_core         1.0.0
zolexora_branding     1.0.0
zolexora_platform     1.0.0
zolexora_integrations 1.0.0
```

Payments is present in the runtime image and installed successfully in the isolated clean-site compatibility test. Payments is not installed on the main certification site because `INSTALL_PAYMENTS=0`.

## Commands Executed

```bash
docker compose -f compose.yaml ps
docker compose -f compose.yaml exec -T backend bash -lc 'bench --site ${SITE_NAME:-site1.example.com} list-apps || true'
docker compose -f compose.yaml exec -T backend bash -lc 'bench --site ${SITE_NAME:-site1.example.com} console ...'
docker compose -f compose.yaml exec -T backend bash -lc 'find apps -path "*payment_gateway*" -maxdepth 8 -type f | sort'
docker compose -f compose.yaml exec -T backend bash -lc 'grep -R "Payment Gateway" -n apps/payments apps/erpnext | head -100 || true'
ZOLEXORA_ALLOW_CLEAN_SITE_TEST=1 ./scripts/payments-clean-site-test.sh
docker compose -f compose.yaml down -v
docker compose -f compose.yaml build
docker compose -f compose.yaml up -d
./scripts/init-site.sh
./scripts/init-site.sh
docker compose -f compose.yaml build
docker compose -f compose.yaml up -d
./scripts/init-site.sh
./scripts/healthcheck.sh
./scripts/backup.sh
bash -lc 'latest_backup="$(find backups -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"; echo "$latest_backup"; ./scripts/restore.sh "$latest_backup"'
```

## Validation Results

| Gate | Result | Evidence |
| --- | --- | --- |
| Payments investigation | PASSED | `Payment Gateway` DocType source is in Payments, not ERPNext; polluted site had partial Payments state. |
| Clean Payments reproduction | PASSED | Isolated site `payments-test.local` installed `payments 0.0.1` successfully. |
| Docker build | PASSED | Final image build completed successfully. |
| Docker Compose startup | PASSED | `docker compose up -d` completed and all containers reported healthy. |
| Bootstrap | PASSED | `./scripts/init-site.sh` completed on the final image. |
| Second bootstrap/idempotency | PASSED | Second post-clean bootstrap completed before final worker-probe patch; final bootstrap also completed after final rebuild. |
| Required app installation | PASSED | ERPNext and all Zolexora apps installed; Payments intentionally skipped on main site. |
| Healthcheck | PASSED | All critical checks passed, including MariaDB, Redis, HTTP, Socket.IO, scheduler, workers, smoke validation, and background job execution. |
| Backup | PASSED | Backup created database, public files, private files, site config, and SHA256 manifest. |
| Restore | FAILED | Checksum verification failed before restore execution because `SHA256SUMS` used repository-relative paths. |
| Disaster recovery | NOT CERTIFIED | Not run after restore stop condition. |
| Upgrade validation | NOT CERTIFIED | Not run after restore stop condition. |
| Security review | PARTIAL | Documentation review exists; scanner-based certification not executed. |
| CI status | NOT CERTIFIED | GitHub Actions was not executed. |

## Healthcheck Summary

```text
PASS Docker Compose services are running and healthy
PASS MariaDB connectivity
PASS Redis cache ping
PASS Redis queue ping
PASS Redis socketio ping
PASS Backend HTTP availability
PASS Frontend HTTP ping
PASS Socket.IO process
PASS Scheduler process
PASS Short worker process
PASS Long worker process
PASS Site exists
PASS Installed app list available
PASS Administrator and company smoke validation
PASS Background worker execution
healthcheck completed successfully
```

## Backup Evidence

Backup folder:

```text
backups/20260703_093717
```

Artifacts:

```text
20260703_093718-site1_example_com-database.sql.gz
20260703_093718-site1_example_com-files.tar
20260703_093718-site1_example_com-private-files.tar
20260703_093718-site1_example_com-site_config_backup.json
SHA256SUMS
```

Backup verification output reported all artifacts `OK`.

## Restore Failure Evidence

Failed command:

```bash
bash -lc 'latest_backup="$(find backups -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"; echo "$latest_backup"; ./scripts/restore.sh "$latest_backup"'
```

Error:

```text
sha256sum: backups/20260703_093717/20260703_093718-site1_example_com-database.sql.gz: No such file or directory
sha256sum: WARNING: ... FAILED open or read
4 listed files could not be read
failed during step: Verifying checksum manifest
```

No destructive restore was executed. The failure occurred before database restore.

## Remediation Applied After Stop

`scripts/backup.sh` now writes checksum manifests using backup-relative file names.

`scripts/restore.sh` now verifies backup-relative manifests first and retries legacy repository-relative manifests for backups generated before the fix.

Certification remains stopped until backup and restore are rerun successfully after this remediation.

## Remaining Risks

- Main certification path has Payments disabled by `INSTALL_PAYMENTS=0`; payment workflows are blocked until Payments is enabled and certified on the main path.
- Restore has not been certified after the checksum remediation.
- Disaster recovery and upgrade validation were not executed after the restore stop condition.
- Scanner-based security certification was not executed.
- GitHub Actions was not executed.

## Final Decision

NOT PRODUCTION CERTIFIED.
