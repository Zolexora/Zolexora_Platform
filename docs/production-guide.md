# Production Guide

## Architecture Overview

Zolexora ERP runs ERPNext v16 on Docker Compose with MariaDB, Redis cache, Redis queue, Redis Socket.IO, backend, scheduler, short worker, long worker, Socket.IO, and Nginx services.

The current repository includes vendored `frappe`, `erpnext`, and `payments` directories under `apps/`, plus Zolexora custom apps.

## Local Deployment

```bash
cp .env.example .env
docker compose -f compose.yaml build
docker compose -f compose.yaml up -d
./scripts/init-site.sh
./scripts/init-site.sh
./scripts/healthcheck.sh
```

## Production Deployment

Use the same image and scripts, but inject secrets through the hosting platform. Do not use development passwords from `.env.example`.

## Northflank Notes

- Create persistent volumes for sites, logs, database, and backups.
- Configure environment variables as Northflank secrets.
- Add a scheduled job for `./scripts/daily-backup.sh`.
- Run `./scripts/healthcheck.sh` after deployment.
- Run `ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh` only in staging.

## Cloudflare DNS, SSL, and WAF

- Point DNS to the Northflank route.
- Enable HTTPS.
- Enable WAF managed rules.
- Restrict CORS and CSRF trusted origins to the production domain.

## Environment Variables

Required production variables include:

- `SITE_NAME`
- `ADMIN_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `FRAPPE_PORT`
- `HTTP_PORT`
- `HTTPS_PORT`
- `BACKUP_RETENTION_DAYS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `COOKIE_SECURE`
- `ENABLE_HTTPS`

## Backup Procedure

```bash
./scripts/backup.sh
```

The script creates a timestamped backup directory under `backups/`, verifies database/public/private file archives, and writes `SHA256SUMS`.

## Restore Procedure

```bash
./scripts/restore.sh backups/<timestamp>
```

Restore requires database, public files, and private files archives. Checksums are verified when available. Restore also recreates Zolexora Workspaces after restore-time migration before smoke validation, because Frappe migration can remove dynamically created Workspaces as orphan records.

## Disaster Recovery Procedure

Run only in local/staging environments:

```bash
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh
```

Phase 3.8F status: disaster recovery passed after deterministic DR validation master data was made idempotent.

## Upgrade Procedure

```bash
RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh
```

Upgrade validation rebuilds/pulls the target image when `RUN_UPGRADE_BUILD=1`, recreates app services from the built images, runs migration, recreates Zolexora Workspaces after migration, validates custom app imports in bench/Frappe context, runs smoke validation, checks workers, and validates upgrade integrity.

Phase 3.8F status: upgrade validation passed.

## Monitoring

```bash
./scripts/status.sh
```

## Health Checks

```bash
./scripts/healthcheck.sh
```

## Logs

```bash
docker compose -f compose.yaml logs --tail=200
docker compose -f compose.yaml logs -f backend scheduler worker-short worker-long
```

## Troubleshooting

- If app installation fails with `App <name> not in apps.txt`, rerun `./scripts/init-site.sh` from the updated script that appends available apps to `sites/apps.txt`.
- If restore fails checksum validation, treat the backup as unsafe.
- If workers fail healthcheck, inspect queue Redis and worker logs.

## Maintenance Checklist

- Verify daily backups.
- Verify latest backup checksum.
- Run healthcheck after deployments.
- Review recent errors weekly.
- Test restore in staging monthly.
- Run image and secret scans before releases.

## Release Checklist

- Docker build passes.
- Compose startup passes.
- Bootstrap passes twice.
- Healthcheck passes.
- Backup and restore pass.
- DR test passes in staging.
- Upgrade validation passes.
- CI passes.
- Security review has no Critical open findings.
