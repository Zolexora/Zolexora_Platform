# Security Review

Date: 2026-07-06
Result: PHASE 3.8J REAL SCANNER REVIEW CARRIED FORWARD WITH PAYMENTS CI VERIFIED

## Executive Summary

Phase 3.8I security certification reviewed static configurations, container settings, environment variable handling, secret management, dependency structures, and real scanner execution using `gitleaks`, `trivy`, and `pip-audit`. Phase 3.8J added remote GitHub Actions matrix validation for both `INSTALL_PAYMENTS=0` and `INSTALL_PAYMENTS=1`; the Payments-enabled job passed explicit `PAYMENTS_CI_OK` and post-restore `PAYMENTS_RESTORE_CI_OK` assertions.

## Security Scanner Analysis & Artifact Status

1. **Gitleaks (Secret Detection)**:
   - *Status*: Verified & Executed with real binary `gitleaks 8.30.1` (`docs/gitleaks-report.json`).
   - *Findings*: Code repository and git commit history checked for hardcoded secrets, API tokens, and private keys. `.env` is properly ignored in `.gitignore`. `.env.example` contains safe placeholder tokens. 0 hardcoded secrets found in codebase.

2. **Trivy (Container & File System Vulnerabilities)**:
   - *Status*: Verified & Executed with real binary `trivy 0.72.0` (`docs/trivy-fs-report.json`, `docs/trivy-backend-image-report.json`).
   - *Findings*: Trivy FS reported 17 HIGH and 2 CRITICAL findings in upstream vendored `apps/frappe/yarn.lock` and `apps/erpnext/banking/yarn.lock`. Trivy image reported 232 HIGH and 57 CRITICAL findings in the `zolexoraerp-backend:latest` Debian/Frappe runtime image, including Chromium/headless shell, Vim packages, Go stdlib metadata, Node packages, and Debian libraries. Trivy secret scanning reported 0 secrets.
   - *Risk decision*: Accepted for Phase 3.8I as upstream dependency/base-image risk. Remediation requires upstream Frappe/ERPNext/base-image refresh and retest.

3. **Pip-Audit (Python Dependency Audit)**:
   - *Status*: Verified & Executed with real command `python -m pip_audit` (`docs/pip-audit-report.json`).
   - *Findings*: Initial audit found 5 advisories in the temporary audit venv's own `pip 25.1.1`. The audit environment was remediated by upgrading `pip` to `26.1.2`; rerun result: 0 known vulnerabilities.

## Codebase Controls & Audit Items Checked

- `.env.example` secret placeholders: Confirmed safe synthetic defaults.
- Compose exposed ports: Port 8000 (backend internal), Port 8080 (HTTP Nginx), Port 8443 (HTTPS Nginx).
- Nginx security headers: Host header verification and proxy header sanitization configured.
- Backup file handling: `SHA256SUMS` checksum manifests generated and validated during backup/restore.
- Script failure behavior: `set -euo pipefail` and `trap fail_report ERR` enforced across all `./scripts/*.sh`.
- Docker build context: `.dockerignore` excludes `.git`, `node_modules`, `backups`, and temporary test artifacts.
- Official Payments App: `apps/payments` code sandboxed and enabled conditionally via `INSTALL_PAYMENTS=1`.
- Payments-enabled CI: GitHub Actions run `28751892318` passed matrix jobs for `INSTALL_PAYMENTS=0` and `INSTALL_PAYMENTS=1`; the Payments path verified installed app state and `Payment Gateway` DocType before and after restore.

## Production Hardening Recommendations

- Rebuild production images from refreshed upstream ERPNext/Frappe base images and rerun Trivy to reduce Debian, Chromium, Node, Go, and Python runtime findings.
- Use container secret managers (e.g. Northflank secrets, HashiCorp Vault) for `ADMIN_PASSWORD`, `MYSQL_ROOT_PASSWORD`, SMTP, and integration credentials.
- Set `COOKIE_SECURE=1` and `ENABLE_HTTPS=1` in production behind TLS termination.
- Restrict `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to the exact production domain.
- Mount persistent volume storage for `/home/frappe/frappe-bench/backups` with restricted POSIX permissions (`0700`).
- Execute `gitleaks` and `trivy` scans as mandatory gates in CI/CD pipeline.
