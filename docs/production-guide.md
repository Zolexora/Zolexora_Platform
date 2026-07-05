# Production Guide

## Architecture Overview

Zolexora ERP runs ERPNext v16 on Docker Compose with MariaDB, Redis cache, Redis queue, Redis Socket.IO, backend, scheduler, short worker, long worker, Socket.IO, Nginx services, and the official Frappe Payments application.

The current repository includes vendored `frappe`, `erpnext`, and `payments` directories under `apps/`, plus Zolexora custom apps (`zolexora_core`, `zolexora_branding`, `zolexora_platform`, `zolexora_integrations`).

```
                      +-------------------+
                      |   Nginx Frontend  | (HTTP / Port 8080)
                      +---------+---------+
                                |
        +-----------------------+-----------------------+
        |                       |                       |
+-------v-------+       +-------v-------+       +-------v-------+
|  backend      |       |  socketio     |       |  mariadb      |
|  (Frappe/     |       +---------------+       |  (Database)   |
|   ERPNext/    |                               +---------------+
|   Payments)   |
+-------+-------+
```

## Local & Staging Deployment

```bash
cp .env.example .env
# Set INSTALL_PAYMENTS=1 in .env to enable Payments app
docker compose -f compose.yaml build
docker compose -f compose.yaml up -d
./scripts/init-site.sh
./scripts/init-site.sh  # Re-run for idempotency check
./scripts/healthcheck.sh
```

## Production Deployment & Secrets

Use the same Compose setup and scripts, but inject secrets through the hosting platform (e.g. Northflank / Kubernetes / Docker Swarm secrets). Never use development passwords from `.env.example`.

### Key Environment Variables:
- `SITE_NAME`: Production Frappe site name (e.g., `erp.zolexora.com`).
- `INSTALL_PAYMENTS`: Set to `1` to build and install Frappe Payments.
- `ADMIN_PASSWORD`: Strong administrator user password.
- `MYSQL_ROOT_PASSWORD`: MariaDB root credentials.
- `COOKIE_SECURE`: Set to `1` when served over HTTPS.
- `ENABLE_HTTPS`: Set to `1` behind reverse proxy with TLS termination.

## Backup Procedure

```bash
./scripts/backup.sh
```

The script creates a timestamped backup directory under `backups/`, verifies database, public files, and private files archives, and writes backup-relative digests to `SHA256SUMS`.

## Restore Procedure

```bash
./scripts/restore.sh backups/<timestamp>
```

Restore requires database, public files, and private files archives. Checksums are verified when available. Restore automatically reinstalls missing apps, recreates Zolexora Workspaces after restore-time migration, and runs health checks.

## Disaster Recovery Procedure

Run only in local/staging environments:

```bash
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh
```

Validates complete destructive database drop and restore sequence while preserving deterministic test items, customers, suppliers, and file attachments.

## Upgrade Procedure

```bash
RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh
```

Upgrade validation rebuilds target images when `RUN_UPGRADE_BUILD=1`, recreates app services from the built images, runs migration, recreates Zolexora Workspaces after migration, validates custom app imports (including `payments`), runs smoke validation, checks background workers, and validates patch log integrity.

## Monitoring & Health Checks

```bash
# Operational metrics, container status, and installed app versions:
./scripts/status.sh

# Comprehensive automated health check:
./scripts/healthcheck.sh
```

## Release & Production Certification Checklist

- [x] `INSTALL_PAYMENTS=1` set and verified in `.env` and Docker build.
- [x] Docker build passes (`docker compose -f compose.yaml build`).
- [x] Compose startup passes (`docker compose up -d`).
- [x] Site bootstrap passes idempotency check (`./scripts/init-site.sh`).
- [x] Payments app installed and Payment Gateway DocType available.
- [x] Automated healthcheck passes (`./scripts/healthcheck.sh`).
- [x] Backup and restore pass checksum verification (`./scripts/backup.sh`, `./scripts/restore.sh`).
- [x] Disaster recovery test passes (`./scripts/disaster-recovery-test.sh`).
- [x] Upgrade validation passes (`RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh`).
- [x] Security review completed (`docs/security-review.md`).
- [x] Workspace long-term fix decision documented (`docs/phase-3.8G-risk-closure-report.md`).
