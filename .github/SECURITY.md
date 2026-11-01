# Security Policy

## Scope

Every first-party product, app and package in this monorepo (`products/*`, `apps/*`, `packages/*`, `platform/*`). Upstream Frappe/ERPNext submodules under `products/zolexora-erp/services/frappe/` should be reported upstream unless the issue is in our integration code.

## Reporting a Vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

1. Email **security@zolexora.com**.
2. Include the affected product/service, impact, and steps or a proof-of-concept to reproduce.
3. You will receive an acknowledgment within 48 hours.
4. Keep the report confidential until a fix is released.

## Practices

- Secrets live in Infisical (see [ADR 0003](../docs/architecture/adrs/0003-secrets-management-infisical.md)); never commit `.env` files or decrypted secrets.
- `gitleaks` runs as a pre-commit hook (`pre-commit install`) and in CI.
