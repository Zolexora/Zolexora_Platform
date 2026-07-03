# Security Review

Date: 2026-07-03
Result: PARTIAL REVIEW COMPLETED, SCANNER CERTIFICATION NOT EXECUTED

Scanner-based security certification NOT EXECUTED.

- image scan: NOT EXECUTED
- dependency scan: NOT EXECUTED
- secret scan: NOT EXECUTED

## Checked

- `.env.example` secret placeholders
- Compose exposed ports
- Nginx security headers
- Backup file handling
- Script failure behavior
- CI validation scope
- Docker build context

## Improved

- Added strict operational logging to backup, restore, healthcheck, status, DR, upgrade, and bootstrap scripts.
- Added backup checksum generation and verification.
- Added restore checksum verification when `SHA256SUMS` exists.
- Added `.dockerignore` exclusions for nested `.git` directories.
- Updated CI to avoid linting vendored upstream apps as project code.
- Added healthcheck and status scripts for local Docker operations.

## Open Risks

- Scanner-based security certification was not executed during Phase 3.8F.
- GitHub Actions was not executed during Phase 3.8F.
- `.env.example` still contains local development defaults and must not be used as production secrets.
- Host backup scheduling is documented but not verified as installed.
- Full dependency vulnerability scan was not run.
- Docker image vulnerability scan was not run.
- Secret scan was not run with a dedicated scanner.
- CORS, CSRF, secure cookie, and password policy settings were reviewed at config level only, not runtime-certified.
- Public HTTP ports are exposed for local Docker usage; production should terminate TLS at Cloudflare/Northflank and restrict direct origin access.

## Production Recommendations

- Use Northflank or platform secrets for `ADMIN_PASSWORD`, `MYSQL_ROOT_PASSWORD`, SMTP credentials, Cloudflare token, and integration keys.
- Set `COOKIE_SECURE=1` and `ENABLE_HTTPS=1` behind production TLS.
- Restrict CORS and CSRF origins to the production domain only.
- Store backups on encrypted persistent storage with restricted access.
- Run Trivy or an equivalent image scan in CI.
- Run Gitleaks or an equivalent secret scan in CI.
- Protect `/backups` from web exposure.

## Northflank Notes

- Use Northflank secrets rather than literal environment values.
- Configure a scheduled job that runs `./scripts/daily-backup.sh`.
- Mount persistent volumes for sites, logs, and backups.
- Validate rollback against a restored backup before production cutover.

## Cloudflare Notes

- Enable HTTPS-only mode.
- Enable WAF managed rules.
- Restrict origin access where possible.
- Configure DNS and SSL before setting secure cookie enforcement.
