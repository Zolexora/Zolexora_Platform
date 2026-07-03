# Phase 3.8A Remediation Report

Date: 2026-07-03
Production certification blocked: Yes

## Initial Findings Before Edit

Runtime app directories:

```text
erpnext
frappe
payments
zolexora_branding
zolexora_core
zolexora_integrations
zolexora_platform
```

Initial `sites/apps.txt`:

```text
frappe
erpnext
zolexora_core
zolexora_branding
zolexora_platform
zolexora_integrations
```

Installed apps before remediation:

```text
frappe                16.25.0
erpnext               16.26.1
zolexora_core         1.0.0
zolexora_branding     1.0.0
zolexora_platform     1.0.0
zolexora_integrations 1.0.0
```

Container health before remediation: all Compose services were running healthy.

## Remediation Applied

`scripts/init-site.sh` now performs an idempotent bench app registry sync before app installation:

- appends only when the app directory exists
- does not overwrite `sites/apps.txt`
- does not duplicate entries
- fails for missing required apps
- treats Payments as optional if `apps/payments` is absent
- logs each registry decision

After remediation, `sites/apps.txt` included:

```text
frappe
erpnext
zolexora_core
zolexora_branding
zolexora_platform
zolexora_integrations
payments
```

## Failed Command

```bash
./scripts/init-site.sh
```

## Error Output

```text
An error occurred while installing payments: Web Form: Options must be a valid DocType for field Payment Gateway in row 62
frappe.core.doctype.doctype.doctype.WrongOptionsDoctypeLinkError: Web Form: Options must be a valid DocType for field Payment Gateway in row 62
```

## Root Cause

The original `App payments not in apps.txt` blocker was fixed. The new blocker occurs inside the official Payments app install flow. Payments attempts to add Web Form custom fields that link to `Payment Gateway`, but the site does not have `Payment Gateway` available as a valid DocType at the point that custom field validation runs.

The relevant source exists in the vendored official app:

```text
apps/payments/payments/payments/doctype/payment_gateway/payment_gateway.json
```

No Frappe, ERPNext, or Payments core files were modified.

## Impacted Files

- `scripts/init-site.sh`
- persistent Docker `sites` volume
- official Payments install state on `site1.example.com`

## Safe Fix Plan

1. Do not patch Payments core.
2. Reproduce on a clean site volume to determine whether the failure is caused by the previously partially initialized site state.
3. If clean install also fails, validate Payments install order with a Frappe-supported sequence such as migrating/syncing Payments DocTypes before Payments `after_install` runs, or use the official image/app version combination where Payments v16 installation is known compatible.
4. Remove any partially created Payments custom fields only through Frappe-supported uninstall/cleanup commands or by recreating the local test site volume.
5. Rerun Phase 3.8A from the beginning.

## Certification Status

NOT PRODUCTION CERTIFIED.

