# Phase 3.9B Branding Report

Date: 2026-07-06

## Decision

PENDING REMOTE CI

Phase 3.9B local/staging proof has passed. Final `PHASE 3.9B BRANDING PASSED` requires GitHub Actions to pass both CI matrix jobs:

- `INSTALL_PAYMENTS=0`
- `INSTALL_PAYMENTS=1`

## Scope

Branding work is isolated to `apps/zolexora_branding`.

Core apps were not modified:

- Frappe core: not modified
- ERPNext core: not modified
- Payments core: not modified

## Brand Metadata

Brand name:

```text
Zolexora ERP
```

Short name:

```text
Zolexora
```

Hook metadata:

- `app_title = "Zolexora ERP"`
- `app_publisher = "Zolexora"`
- `app_description = "Zolexora ERP branding, theme, and UI customization"`
- `app_logo_url = "/assets/zolexora_branding/img/zolexora-icon.svg"`

Website context:

- `favicon = "/assets/zolexora_branding/img/favicon.svg"`
- `splash_image = "/assets/zolexora_branding/img/zolexora-logo.svg"`
- `brand_html = "Zolexora ERP"`

Boot metadata exposes:

- `brand: Zolexora ERP`
- `short_name: Zolexora`
- `logo: /assets/zolexora_branding/img/zolexora-logo.svg`
- `icon: /assets/zolexora_branding/img/zolexora-icon.svg`
- `favicon: /assets/zolexora_branding/img/favicon.svg`

## Assets Added

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

## CSS And JS Branding

The Phase 3.9A dark theme remains registered:

```text
/assets/zolexora_branding/css/zolexora_dark.css
```

Phase 3.9B added scoped CSS rules for:

- Zolexora login wordmark
- Login page title text
- Removal of the default Frappe login cube image
- Desk navbar Zolexora icon

Existing `zolexora.js` now sets the browser tab title to:

```text
Zolexora ERP
```

This is implemented inside `zolexora_branding` without core template modification.

## Asset HTTP Proof

All required assets returned HTTP 200 locally:

```text
GET/HEAD /assets/zolexora_branding/img/zolexora-logo.svg -> HTTP/1.1 200 OK
GET/HEAD /assets/zolexora_branding/img/zolexora-icon.svg -> HTTP/1.1 200 OK
GET/HEAD /assets/zolexora_branding/img/favicon.svg -> HTTP/1.1 200 OK
GET/HEAD /assets/zolexora_branding/css/zolexora_dark.css -> HTTP/1.1 200 OK
```

Login HTML included:

```text
/assets/zolexora_branding/img/favicon.svg
/assets/zolexora_branding/css/zolexora-theme.css
/assets/zolexora_branding/css/zolexora_dark.css
/assets/zolexora_branding/img/zolexora-logo.svg
```

Authenticated Desk HTML included:

```text
/assets/zolexora_branding/img/favicon.svg
/assets/zolexora_branding/css/zolexora_dark.css
/assets/zolexora_branding/js/zolexora.js
zolexora_branding boot metadata
```

## Browser Verification

Headless Chrome rendered:

```text
http://site1.example.com:8080/login
```

Verified:

- Login page remained dark themed.
- Zolexora logo and `Sign in to Zolexora ERP` branding were visible.
- Default Frappe cube logo was no longer visible.
- Login form, forgot password, and email link controls remained visible.
- No raw HTML/CSS regression was observed.
- No broken Zolexora logo/favicon asset was observed.

Desk verification:

- Authenticated Desk HTML loaded.
- Zolexora favicon and CSS were included.
- Zolexora branding metadata was present in `frappe.boot`.
- Desk title branding is applied by the branding app JS after page load.

## Workspace Icons

Workspace creation code was inspected. No placeholder `z` icons were used.

Post-upgrade workspace icon query returned named icons:

```text
Zolexora Accounts: briefcase
Zolexora Administration: setting
Zolexora AI: bolt
Zolexora Analytics: chart-pie
Zolexora CRM: customer
Zolexora Dashboard: dashboard
Zolexora Fleet: delivery
Zolexora Inventory: package
Zolexora Logistics: globe
Zolexora Purchase: truck
Zolexora Sales: graph
```

No workspace creation change was required.

## Local Regression Proof

Build and cache clear:

```text
bench build
bench --site site1.example.com clear-cache
bench --site site1.example.com clear-website-cache
```

Result: passed.

Healthcheck:

```text
./scripts/healthcheck.sh
```

Result:

```text
healthcheck completed successfully
Branding static logo availability: PASS
Zolexora dark theme CSS availability: PASS
```

Status:

```text
./scripts/status.sh
```

Result: passed.

Payments regression:

```text
payments installed: True
Payment Gateway DocType: Payment Gateway
```

Backup:

```text
./scripts/backup.sh
```

Backup directory:

```text
backups/20260706_054142
```

Checksum result:

```text
20260706_054142-site1_example_com-database.sql.gz: OK
20260706_054142-site1_example_com-files.tar: OK
20260706_054142-site1_example_com-private-files.tar: OK
20260706_054142-site1_example_com-site_config_backup.json: OK
```

Upgrade validation:

```text
RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh
```

Result:

```text
upgrade validation report written to docs/upgrade-validation-report.md
```

Post-upgrade healthcheck:

```text
healthcheck completed successfully
```

Post-upgrade Payments regression:

```text
payments installed: True
Payment Gateway DocType: Payment Gateway
```

## Remote CI

Pending.

Required final evidence:

- GitHub Actions run ID
- Commit hash
- `INSTALL_PAYMENTS=0` matrix result
- `INSTALL_PAYMENTS=1` matrix result
- Branding asset healthcheck result
- Payments CI assertions
- Backup checksum
- Restore
- Upgrade validation
