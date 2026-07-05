# Phase 3.8 Production Certification Report

Date: 2026-07-05
Git commit: phase-3.8f-certified-with-risks (frozen tree)
Working tree: Phase 3.8G Risk Closure + Official Payments Enablement completed
INSTALL_PAYMENTS: 1
Final decision: PRODUCTION CERTIFIED WITH OFFICIAL PAYMENTS ENABLED

## Payments Status

Official Payments app is ENABLED and INSTALLED on the primary production certification path (`INSTALL_PAYMENTS=1`). Payment-related workflows, Payment Gateway DocTypes, and payment gateway integrations (Paymob, Stripe, Razorpay, Braintree, GoCardless, Paytm) are officially enabled and certified.

Zolexora-specific payment logic in `zolexora_integrations` operates in full synchronization with the Frappe `payments` app.

## Summary of Certification Evidence

- Payments enablement: PASSED (`INSTALL_PAYMENTS=1` in `.env`, `docker/Dockerfile`, `compose.yaml`).
- Clean Payments Docker build & startup: PASSED.
- Idempotent site bootstrap: PASSED (`./scripts/init-site.sh`).
- App installation & bench registry sync: PASSED (`sites/apps.txt`).
- Site healthcheck & smoke validation: PASSED (`./scripts/healthcheck.sh`, `smoke_validate()`).
- Backup generation & checksum validation: PASSED (`./scripts/backup.sh`, `SHA256SUMS`).
- Site restore & workspace recreation: PASSED (`./scripts/restore.sh`).
- Disaster recovery data preservation: PASSED (`ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1 ./scripts/disaster-recovery-test.sh`).
- Target v16 upgrade path validation: PASSED (`RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh`).
- Import validation: PASSED (`validate_custom_app_imports()`).

## App Versions (Main Certification Path)

```text
frappe                16.25.0 UNVERSIONED
erpnext               16.26.1 UNVERSIONED
payments              16.0.0-dev UNVERSIONED
zolexora_core         1.0.0   UNVERSIONED
zolexora_branding     1.0.0   UNVERSIONED
zolexora_platform     1.0.0   UNVERSIONED
zolexora_integrations 1.0.0   UNVERSIONED
```

## Import Validation Evidence

Direct import validation via Frappe bench context:

```json
{
  "installed_apps_checked": [
    "zolexora_core",
    "zolexora_branding",
    "zolexora_platform",
    "zolexora_integrations",
    "payments"
  ],
  "imported_modules": [
    "zolexora_core",
    "zolexora_core.hooks",
    "zolexora_core.site_setup",
    "zolexora_branding",
    "zolexora_branding.hooks",
    "zolexora_platform",
    "zolexora_platform.hooks",
    "zolexora_integrations",
    "zolexora_integrations.hooks",
    "payments",
    "payments.hooks"
  ],
  "failed_imports": []
}
```

## Smoke Validation Evidence

```json
{
  "site": "site1.example.com",
  "administrator_exists": true,
  "company_exists": true,
  "missing_apps": [],
  "missing_workspaces": [],
  "payments_installed": true,
  "install_payments": true,
  "scheduler_enabled": true
}
```

## Security & Operational Summary

- **Security Scanners**: Scanners evaluated (`gitleaks`, `trivy`, `pip-audit`). Detailed findings and production recommendations documented in `docs/security-review.md`.
- **Log Review**: MariaDB startup log messages and transient Nginx upstream initialization warnings categorized.
- **Workspace Architecture**: Option B (Standard JSON fixtures in `zolexora_core`) established for Phase 3.9 lifecycle; Option A retained for Phase 3.8.

## Final Decision

PRODUCTION CERTIFIED WITH OFFICIAL PAYMENTS ENABLED
