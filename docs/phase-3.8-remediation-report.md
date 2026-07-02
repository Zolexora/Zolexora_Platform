# Phase 3.8 Remediation Report

Date: 2026-07-03
Production certification blocked: Yes

## Failed Command

```bash
./scripts/init-site.sh
```

## Error Output

```text
An error occurred while installing payments: App payments not in apps.txt
```

## Root Cause

The repository was changed to vendor `apps/payments` after the existing site volume had already been initialized. The rebuilt runtime image contains the Payments app directory, but the persistent bench-level `sites/apps.txt` file in the existing Docker volume did not include `payments`. Frappe refuses to install an app that is not present in `sites/apps.txt`.

## Impacted Files

- `scripts/init-site.sh`
- `docker/Dockerfile`
- `apps/payments`
- Persistent Docker `sites` volume

## Safe Fix Applied

`scripts/init-site.sh` now checks whether an app directory exists in the runtime image and appends that app to `sites/apps.txt` before attempting installation.

## Required Next Validation

Run the certification gates again from the current working tree:

```bash
docker compose -f compose.yaml up -d
./scripts/init-site.sh
./scripts/init-site.sh
./scripts/healthcheck.sh
./scripts/backup.sh
latest_backup="$(find backups -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
./scripts/restore.sh "$latest_backup"
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh
RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh
```

## Certification Decision

NOT PRODUCTION CERTIFIED.

