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

### Static Asset Volume Mount & Bench Build Guidelines

- **Assets Volume Mount**: In `compose.yaml`, the `assets` volume MUST be mounted at `/home/frappe/frappe-bench/assets` for backend and worker services so the container entrypoint (`/usr/local/bin/entrypoint.sh`) can safely create the symlink at `/home/frappe/frappe-bench/sites/assets -> /home/frappe/frappe-bench/assets`. Mounting `assets` directly at `/home/frappe/frappe-bench/sites/assets` causes container startup failure (`Device or resource busy`).
- **Apps Volume Sharing**: The `apps` named volume (`apps:/home/frappe/frappe-bench/apps`) must be mounted in Nginx (`apps:/home/frappe/frappe-bench/apps:ro`) so Nginx can resolve symlinked app public static assets and compiled bundle outputs (`dist/`).
- **Asset Compilation**: Static frontend bundles must be built using `bench build` during site initialization (`./scripts/init-site.sh`) or site restores (`./scripts/restore.sh`). HTML/CSS cache should be cleared using `bench --site <site> clear-cache` and `clear-website-cache` after asset compilation.

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

## Security Scans

```bash
# Real Gitleaks secret detection:
gitleaks detect --source . --redact --verbose --report-format json --report-path docs/gitleaks-report.json

# Real Trivy filesystem and backend image scans:
trivy fs --scanners vuln,secret,config --severity HIGH,CRITICAL --format json --output docs/trivy-fs-report.json .
trivy image --severity HIGH,CRITICAL --format json --output docs/trivy-backend-image-report.json zolexoraerp-backend:latest

# Real pip-audit scan:
python -m pip_audit --format json --output docs/pip-audit-report.json
```

Phase 3.8I scanner reports are evidence artifacts, not blanket zero-risk claims. `gitleaks` and `pip-audit` passed with 0 findings after audit-tool remediation. Trivy executed successfully and reported accepted upstream HIGH/CRITICAL dependency and base-image findings; see `docs/security-review.md` and `docs/phase-3.8I-final-external-proof-report.md`.

## CI Certification

GitHub Actions validates both supported Docker paths:

- `INSTALL_PAYMENTS=0`: default safe ERP path.
- `INSTALL_PAYMENTS=1`: Payments-enabled production path.

The Payments-enabled path must print `PAYMENTS_CI_OK` and `PAYMENTS_RESTORE_CI_OK` in CI before production certification can be claimed.

Phase 3.9A also validates the Zolexora branding CSS through `./scripts/healthcheck.sh`. The healthcheck fetches the login page, verifies a CSS asset is reachable, and checks:

```text
/assets/zolexora_branding/css/zolexora_dark.css
```

This guards against raw HTML, missing CSS, and broken static asset regressions after build, restore, or upgrade validation.

## Zolexora Dark Theme

The custom Zolexora dark theme lives in the branding app:

```text
apps/zolexora_branding/zolexora_branding/public/css/zolexora_dark.css
```

It is registered from:

```text
apps/zolexora_branding/zolexora_branding/hooks.py
```

The served asset URL is:

```text
http://<host>/assets/zolexora_branding/css/zolexora_dark.css
```

After changing branding assets, rebuild and clear caches:

```bash
docker compose -f compose.yaml exec -T backend bash -lc '
cd /home/frappe/frappe-bench
bench build
bench --site site1.example.com clear-cache
bench --site site1.example.com clear-website-cache
'
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
- [x] Security review completed & scanner proof generated (`docs/security-review.md`).
- [x] External verification and remediation report completed (`docs/phase-3.8H-verification-report.md`, `docs/phase-3.8H-verification-remediation-report.md`).
- [x] Phase 3.8I remote GitHub Actions completion verified (`docs/phase-3.8I-final-external-proof-report.md`).
- [x] Phase 3.8J remote GitHub Actions Payments matrix verified (`docs/phase-3.8J-payments-ci-proof-report.md`).
- [ ] Phase 3.9A custom dark theme remote GitHub Actions matrix verified (`docs/phase-3.9A-custom-dark-theme-report.md`).
