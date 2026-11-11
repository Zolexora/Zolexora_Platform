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
infisical login   # secrets: /Zolexora_ERP (key list: docs/secrets.md)
export INSTALL_PAYMENTS=1   # optional: enable Payments app
bash scripts/setup/with-infisical.sh products/zolexora-erp docker compose -f products/zolexora-erp/compose.yaml up -d
./scripts/bootstrap-frappe-site.sh
./scripts/bootstrap-frappe-site.sh  # Re-run for idempotency check
./scripts/check-frappe-stack-health.sh
```

### Static Asset Volume Mount & Bench Build Guidelines

- **Assets Volume Mount**: In `compose.yaml`, the `assets` volume MUST be mounted at `/home/frappe/frappe-bench/assets` for backend and worker services so the container entrypoint (`/usr/local/bin/entrypoint.sh`) can safely create the symlink at `/home/frappe/frappe-bench/sites/assets -> /home/frappe/frappe-bench/assets`. Mounting `assets` directly at `/home/frappe/frappe-bench/sites/assets` causes container startup failure (`Device or resource busy`).
- **Apps Volume Sharing**: The `apps` named volume (`apps:/home/frappe/frappe-bench/apps`) must be mounted in Nginx (`apps:/home/frappe/frappe-bench/apps:ro`) so Nginx can resolve symlinked app public static assets and compiled bundle outputs (`dist/`).
- **Asset Compilation**: Static frontend bundles must be built using `bench build` during site initialization (`./scripts/bootstrap-frappe-site.sh`) or site restores (`./scripts/restore-frappe-site.sh`). HTML/CSS cache should be cleared using `bench --site <site> clear-cache` and `clear-website-cache` after asset compilation.

## Production Deployment & Secrets

Use the same Compose setup and scripts, but inject secrets through the hosting platform (e.g. Northflank / Kubernetes / Docker Swarm secrets). Secrets come only from Infisical (`/Zolexora_ERP`, `prod` env) via a machine identity (`INFISICAL_TOKEN`).

### Key Environment Variables:
- `SITE_NAME`: Production Frappe site name (e.g., `erp.zolexora.com`).
- `INSTALL_PAYMENTS`: Set to `1` to build and install Frappe Payments.
- `ADMIN_PASSWORD`: Strong administrator user password.
- `MYSQL_ROOT_PASSWORD`: MariaDB root credentials.
- `COOKIE_SECURE`: Set to `1` when served over HTTPS.
- `ENABLE_HTTPS`: Set to `1` behind reverse proxy with TLS termination.

## Backup Procedure

```bash
./scripts/backup-frappe-site.sh
```

The script creates a timestamped backup directory under `backups/`, verifies database, public files, and private files archives, and writes backup-relative digests to `SHA256SUMS`.

## Restore Procedure

```bash
./scripts/restore-frappe-site.sh backups/<timestamp>
```

Restore requires database, public files, and private files archives. Checksums are verified when available. Restore automatically reinstalls missing apps, recreates Zolexora Workspaces after restore-time migration, and runs health checks.

## Disaster Recovery Procedure

Run only in local/staging environments:

```bash
ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/tests/test-disaster-recovery.sh
```

Validates complete destructive database drop and restore sequence while preserving deterministic test items, customers, suppliers, and file attachments.

## Upgrade Procedure

```bash
RUN_UPGRADE_BUILD=1 ./scripts/tests/test-upgrade-validation.sh
```

Upgrade validation pulls the CI-built target images when `RUN_UPGRADE_BUILD=1`, recreates app services from them, runs migration, recreates Zolexora Workspaces after migration, validates custom app imports (including `payments`), runs smoke validation, checks background workers, and validates patch log integrity.

## Monitoring & Health Checks

```bash
# Operational metrics, container status, and installed app versions:
./scripts/report-frappe-stack-status.sh

# Comprehensive automated health check:
./scripts/check-frappe-stack-health.sh
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

Phase 3.8I scanner reports are evidence artifacts, not blanket zero-risk claims. `gitleaks` and `pip-audit` passed with 0 findings after audit-tool remediation. Trivy executed successfully and reported accepted upstream HIGH/CRITICAL dependency and base-image findings. Phase 3.6–3.9 certification and phase reports were removed from the tree on 2026-10-31; recover them with `git log --all -- docs/reports`.

## CI Certification

GitHub Actions validates both supported Docker paths:

- `INSTALL_PAYMENTS=0`: default safe ERP path.
- `INSTALL_PAYMENTS=1`: Payments-enabled production path.

The Payments-enabled path must print `PAYMENTS_CI_OK` and `PAYMENTS_RESTORE_CI_OK` in CI before production certification can be claimed.

Phase 3.9A and 3.9B also validate the Zolexora branding CSS and SVG branding assets through `./scripts/check-frappe-stack-health.sh`. The healthcheck fetches the login page, verifies CSS assets are reachable, and checks:

```text
/assets/zolexora_branding/css/zolexora_dark.css
/assets/zolexora_branding/img/zolexora-logo.svg
/assets/zolexora_branding/img/zolexora-icon.svg
/assets/zolexora_branding/img/favicon.svg
/assets/zolexora_branding/images/logo.svg
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
docker compose -f products/zolexora-erp/compose.yaml exec -T backend bash -lc '
cd /home/frappe/frappe-bench
bench build
bench --site site1.example.com clear-cache
bench --site site1.example.com clear-website-cache
'
./scripts/check-frappe-stack-health.sh
```

## Zolexora Branding Assets

Zolexora ERP app branding lives in the branding app:

```text
apps/zolexora_branding
```

Primary brand assets:

```text
apps/zolexora_branding/zolexora_branding/public/img/zolexora-logo.svg
apps/zolexora_branding/zolexora_branding/public/img/zolexora-icon.svg
apps/zolexora_branding/zolexora_branding/public/img/favicon.svg
```

Served URLs:

```text
/assets/zolexora_branding/img/zolexora-logo.svg
/assets/zolexora_branding/img/zolexora-icon.svg
/assets/zolexora_branding/img/favicon.svg
```

Brand metadata is registered from:

```text
apps/zolexora_branding/zolexora_branding/hooks.py
apps/zolexora_branding/zolexora_branding/startup.py
```

The login page uses the Zolexora wordmark and favicon. Desk receives the favicon, dark theme CSS, boot branding metadata, and a scoped title update from the branding app JavaScript. Full server-rendered Desk title replacement is intentionally not forced through Frappe core edits.

After changing brand assets, rebuild and clear caches:

```bash
docker compose -f products/zolexora-erp/compose.yaml exec -T backend bash -lc '
cd /home/frappe/frappe-bench
bench build
bench --site site1.example.com clear-cache
bench --site site1.example.com clear-website-cache
'
./scripts/check-frappe-stack-health.sh
```

## Release & Production Certification Checklist

- [x] `INSTALL_PAYMENTS=1` set and verified in `.env` and Docker build.
- [x] Docker images build in GitHub CI (ERP Docker images workflow).
- [x] Compose startup passes (`docker compose up -d`).
- [x] Site bootstrap passes idempotency check (`./scripts/bootstrap-frappe-site.sh`).
- [x] Payments app installed and Payment Gateway DocType available.
- [x] Automated healthcheck passes (`./scripts/check-frappe-stack-health.sh`).
- [x] Backup and restore pass checksum verification (`./scripts/backup-frappe-site.sh`, `./scripts/restore-frappe-site.sh`).
- [x] Disaster recovery test passes (`./scripts/tests/test-disaster-recovery.sh`).
- [x] Upgrade validation passes (`RUN_UPGRADE_BUILD=1 ./scripts/tests/test-upgrade-validation.sh`).
- [x] Security review completed & scanner proof generated.
- [x] External verification and remediation report completed.
- [x] Phase 3.8I remote GitHub Actions completion verified.
- [x] Phase 3.8J remote GitHub Actions Payments matrix verified.
- [x] Phase 3.9A custom dark theme remote GitHub Actions matrix verified.
- [x] Phase 3.9B app branding and icons remote GitHub Actions matrix verified.
- [x] Phase 3.9C app-owned Zolexora workspace fixtures verified.

