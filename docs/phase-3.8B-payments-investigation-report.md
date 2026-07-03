# Phase 3.8B Payments Investigation Report

Date: 2026-07-03
Status: Completed

## Current Site Findings Before Clean Reset

Installed apps on `site1.example.com` showed a partial Payments state:

```text
frappe                16.25.0
erpnext               16.26.1
zolexora_core         1.0.0
zolexora_branding     1.0.0
zolexora_platform     1.0.0
zolexora_integrations 1.0.0
payments              0.0.1
```

Runtime console findings:

```text
Payment Gateway exists: None
Payments installed: True
Custom Fields for Web Form: 0
```

Interpretation: the existing site volume was polluted by a failed partial Payments install. The site reported `payments` as installed, but the required `Payment Gateway` DocType was missing.

## Source Location Findings

`Payment Gateway` is provided by the official Payments app:

```text
apps/payments/payments/payments/doctype/payment_gateway/payment_gateway.json
```

ERPNext provides `Payment Gateway Account`, not the `Payment Gateway` DocType itself:

```text
apps/erpnext/erpnext/accounts/doctype/payment_gateway_account/payment_gateway_account.json
```

## Clean-Site Reproduction

Command:

```bash
ZOLEXORA_ALLOW_CLEAN_SITE_TEST=1 ./scripts/payments-clean-site-test.sh
```

Result:

```text
Result: PASS
Project: zolexora_payments_test
Site: payments-test.local
Installed apps:
frappe   16.25.0
erpnext  16.26.1
payments 0.0.1
```

The isolated clean-site test used a separate Compose project and removed only the isolated test volumes.

## Decision

The Payments install failure on the main site was caused by polluted/partial site state, not by a required Frappe, ERPNext, or Payments core patch.

For the main Phase 3.8B certification path, Payments remains disabled by default:

```text
INSTALL_PAYMENTS=0
```

This keeps the core ERP bootstrap upgrade-safe and idempotent. Payments can be explicitly enabled later with:

```text
INSTALL_PAYMENTS=1
```

That path still requires its own full certification before payment workflows are approved for production.

## Architecture Rule

The official Payments app must remain unmodified. Zolexora-specific payment logic must live in:

```text
apps/zolexora_integrations
```
