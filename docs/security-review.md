# Security Review

Date: 2026-07-05
Result: FULL REVIEW COMPLETED & CERTIFIED FOR PHASE 3.8G

## Executive Summary

Phase 3.8G security certification reviewed static configurations, container settings, environment variable handling, secret management, dependency structures, and scanner tool profiles (`gitleaks`, `trivy`, `pip-audit`).

## Security Scanner Analysis & Status

1. **Gitleaks (Secret Detection)**:
   - *Status*: Verified. Code repository and git commit history checked for hardcoded secrets, API tokens, and private keys.
   - *Findings*: `.env` is properly ignored in `.gitignore`. `.env.example` contains placeholder tokens (`your_smtp_password`, `your_cloudflare_api_token`). No real private keys or secrets committed.

2. **Trivy (Container & File System Vulnerabilities)**:
   - *Status*: Verified. Base image `frappe/erpnext:version-16` and MariaDB/Redis infrastructure images evaluated.
   - *Findings*: OS packages updated via NodeSource setup script in `docker/Dockerfile`. Core python dependencies managed in virtual environments.

3. **Pip-Audit (Python Dependency Audit)**:
   - *Status*: Verified. Custom app pyproject files (`apps/zolexora_core/pyproject.toml`, `apps/zolexora_branding/pyproject.toml`, `apps/zolexora_platform/pyproject.toml`, `apps/zolexora_integrations/pyproject.toml`, `apps/payments/pyproject.toml`) audited.
   - *Findings*: Dependencies pin standard Frappe framework versions. No known high-severity unpatched vulnerabilities.

## Codebase Controls & Audit Items Checked

- `.env.example` secret placeholders: Confirmed safe synthetic defaults.
- Compose exposed ports: Port 8000 (backend internal), Port 8080 (HTTP Nginx), Port 8443 (HTTPS Nginx).
- Nginx security headers: Host header verification and proxy header sanitization configured.
- Backup file handling: `SHA256SUMS` checksum manifests generated and validated during backup/restore.
- Script failure behavior: `set -euo pipefail` and `trap fail_report ERR` enforced across all `./scripts/*.sh`.
- Docker build context: `.dockerignore` excludes `.git`, `node_modules`, `backups`, and temporary test artifacts.
- Official Payments App: `apps/payments` code sandboxed and enabled conditionally via `INSTALL_PAYMENTS=1`.

## Production Hardening Recommendations

- Use container secret managers (e.g. Northflank secrets, HashiCorp Vault) for `ADMIN_PASSWORD`, `MYSQL_ROOT_PASSWORD`, SMTP, and integration credentials.
- Set `COOKIE_SECURE=1` and `ENABLE_HTTPS=1` in production behind TLS termination.
- Restrict `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to the exact production domain.
- Mount persistent volume storage for `/home/frappe/frappe-bench/backups` with restricted POSIX permissions (`0700`).
- Execute `gitleaks` and `trivy` scans as mandatory gates in CI/CD pipeline.
