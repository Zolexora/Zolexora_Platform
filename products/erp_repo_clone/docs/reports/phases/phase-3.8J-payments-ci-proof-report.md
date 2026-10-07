# Phase 3.8J Payments-Enabled CI Proof Report

Date: 2026-07-06
Branch: `main`
Proof commit: `fc74f37`
Certification tag: `phase-3.8j-production-certified-payments-ci`

## Certification Decision

PRODUCTION CERTIFIED WITH OFFICIAL PAYMENTS ENABLED

GitHub Actions now validates both supported Docker paths:

- Default safe path: `INSTALL_PAYMENTS=0`
- Payments-enabled production path: `INSTALL_PAYMENTS=1`

## Remote GitHub Actions Evidence

- Workflow: `CI` (`.github/workflows/ci.yml`)
- Run ID: `28751892318`
- Result: PASSED
- Static validation: PASSED in 31s
- Matrix job `docker-operational-validation (INSTALL_PAYMENTS=1)`: PASSED in 12m28s
- Matrix job `docker-operational-validation (INSTALL_PAYMENTS=0)`: PASSED in 13m02s
- Destructive disaster recovery job: intentionally skipped by workflow guard (`if: false`)

## Payments-Enabled CI Evidence

The `INSTALL_PAYMENTS=1` matrix job performed a real submodule checkout and validated Payments through build, bootstrap, healthcheck, backup, restore, import validation, and upgrade validation.

Evidence lines from the remote job:

```text
Submodule path 'apps/payments': checked out 'cca07d9f9392e2ea0e521c5975151db9e4b6c321'
PAYMENTS_CI_OK
PAYMENTS_RESTORE_CI_OK
upgrade validation report written to docs/upgrade-validation-report.md
```

The `PAYMENTS_CI_OK` assertion verified:

- `payments` is installed in `frappe.get_installed_apps()`.
- `Payment Gateway` DocType exists.

The `PAYMENTS_RESTORE_CI_OK` assertion verified the same state after backup restore.

## Default Path Evidence

The `INSTALL_PAYMENTS=0` matrix job passed the same operational workflow without requiring Payments:

- Docker build.
- Compose startup.
- Clean bootstrap.
- Idempotent bootstrap.
- Healthcheck.
- Backup generation and checksum validation.
- Restore.
- Post-restore healthcheck.
- Custom app import validation.
- `RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh`.

## CI Corrections Applied

- Added a GitHub Actions matrix for `INSTALL_PAYMENTS=0` and `INSTALL_PAYMENTS=1`.
- Configured CI to write and print the matrix value into `.env`.
- Added explicit Payments assertions for the `INSTALL_PAYMENTS=1` job.
- Added post-restore Payments assertions for the `INSTALL_PAYMENTS=1` job.
- Added backup checksum verification before restore in CI.
- Restored `.gitmodules` metadata for `apps/frappe`, `apps/erpnext`, and `apps/payments`.
- Configured `actions/checkout` with `submodules: recursive`.
- Made Docker build fail clearly if `INSTALL_PAYMENTS=1` and `apps/payments` is not a valid Python project.
- Made `scripts/init-site.sh` require Payments when `INSTALL_PAYMENTS=1`.

## Security Scanner Status

Phase 3.8J did not rerun or change scanner reports. Security scanner evidence remains the Phase 3.8I real-tool evidence:

- Gitleaks 8.30.1: PASSED, 0 findings.
- Trivy 0.72.0 FS: EXECUTED, 17 HIGH and 2 CRITICAL accepted upstream dependency findings, 0 secrets.
- Trivy 0.72.0 image: EXECUTED, 232 HIGH and 57 CRITICAL accepted upstream base-image/runtime findings, 0 secrets.
- pip-audit 2.10.1: PASSED, 0 known vulnerabilities after audit venv remediation.

## Final Gate Status

| Gate | Status |
|---|---|
| Remote CI matrix `INSTALL_PAYMENTS=0` | PASSED |
| Remote CI matrix `INSTALL_PAYMENTS=1` | PASSED |
| Payments installed in CI | PASSED |
| Payment Gateway DocType exists in CI | PASSED |
| Backup checksum validation in CI | PASSED |
| Restore in CI | PASSED |
| Post-restore Payments assertion in CI | PASSED |
| Upgrade validation in CI | PASSED |
| Real scanner evidence | PASSED/ACCEPTED from Phase 3.8I |
