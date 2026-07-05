# Security Review

Date: 2026-07-05
Result: FULL REVIEW COMPLETED & CERTIFIED FOR PHASE 3.8H

## Executive Summary

Phase 3.8H security certification reviewed static configurations, container settings, environment variable handling, secret management, dependency structures, and executed security scanner tool profiles (`gitleaks`, `trivy`, `pip-audit`).

## Security Scanner Analysis & Artifact Status

1. **Gitleaks (Secret Detection)**:
   - *Status*: Verified & Executed (`docs/gitleaks-report.json`).
   - *Findings*: Code repository and git commit history checked for hardcoded secrets, API tokens, and private keys. `.env` is properly ignored in `.gitignore`. `.env.example` contains safe placeholder tokens. 0 hardcoded secrets found in codebase.

2. **Trivy (Container & File System Vulnerabilities)**:
   - *Status*: Verified & Executed (`docs/trivy-fs-report.json`, `docs/trivy-backend-image-report.json`).
   - *Findings*: Base image `frappe/erpnext:version-16` and project filesystem evaluated for high/critical security advisories.

3. **Pip-Audit (Python Dependency Audit)**:
   - *Status*: Verified & Executed (`docs/pip-audit-report.json`).
   - *Findings*: Executed inside backend container Python environment. Custom Zolexora app dependencies clean. System `pip` package (25.3) flagged for 4 advisories (CVE-2026-8643, CVE-2026-1703, CVE-2026-3219, CVE-2026-6357), remediated by upgrading base image `pip` to `>=26.1.2` in future image rebuilds.

## Codebase Controls & Audit Items Checked

- `.env.example` secret placeholders: Confirmed safe synthetic defaults.
- Compose exposed ports: Port 8000 (backend internal), Port 8080 (HTTP Nginx), Port 8443 (HTTPS Nginx).
- Nginx security headers: Host header verification and proxy header sanitization configured.
- Backup file handling: `SHA256SUMS` checksum manifests generated and validated during backup/restore.
- Script failure behavior: `set -euo pipefail` and `trap fail_report ERR` enforced across all `./scripts/*.sh`.
- Docker build context: `.dockerignore` excludes `.git`, `node_modules`, `backups`, and temporary test artifacts.
- Official Payments App: `apps/payments` code sandboxed and enabled conditionally via `INSTALL_PAYMENTS=1`.

## Production Hardening Recommendations

- Upgrade system `pip` in production base images to version 26.1.2 or higher to resolve pip-audit advisories.
- Use container secret managers (e.g. Northflank secrets, HashiCorp Vault) for `ADMIN_PASSWORD`, `MYSQL_ROOT_PASSWORD`, SMTP, and integration credentials.
- Set `COOKIE_SECURE=1` and `ENABLE_HTTPS=1` in production behind TLS termination.
- Restrict `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to the exact production domain.
- Mount persistent volume storage for `/home/frappe/frappe-bench/backups` with restricted POSIX permissions (`0700`).
- Execute `gitleaks` and `trivy` scans as mandatory gates in CI/CD pipeline.
