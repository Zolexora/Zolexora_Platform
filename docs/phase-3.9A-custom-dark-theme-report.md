# Phase 3.9A Custom Dark Theme Report

Date: 2026-07-06

## Decision

PHASE 3.9A CUSTOM DARK THEME PASSED

Final proof commit:

```text
a0b8f6e
```

GitHub Actions run:

```text
28758639348
```

## Scope

Theme work is isolated to `apps/zolexora_branding`.

Changed files:

- `apps/zolexora_branding/zolexora_branding/public/css/zolexora_dark.css`
- `apps/zolexora_branding/zolexora_branding/hooks.py`
- `scripts/healthcheck.sh`

Core apps were not modified:

- Frappe core: not modified
- ERPNext core: not modified
- Payments core: not modified

## Theme Implementation

The custom dark theme is registered through `zolexora_branding` hooks:

- Desk CSS: `/assets/zolexora_branding/css/zolexora_dark.css`
- Web/login CSS: `/assets/zolexora_branding/css/zolexora_dark.css`

The stylesheet defines Zolexora dark variables:

- Background: `#07111f`
- Panel: `#0f1b2d`
- Soft panel: `#17243a`
- Border: `#26364f`
- Text: `#e6edf7`
- Muted text: `#9fb0c8`
- Accent: `#2f81f7`

Styled surfaces include:

- Desk body and main layout
- Top navbar
- Search bar and Awesomplete menus
- Desk/sidebar navigation
- Workspace cards and widgets
- Lists, forms, modals, and primary buttons
- Login page card, controls, and actions

## Asset Proof

Build command:

```text
bench build
bench --site site1.example.com clear-cache
bench --site site1.example.com clear-website-cache
```

Runtime asset path:

```text
sites/assets/zolexora_branding/css/zolexora_dark.css
```

HTTP proof:

```text
GET/HEAD /assets/zolexora_branding/css/zolexora_dark.css -> HTTP/1.1 200 OK
Content-Type: text/css
```

Authenticated Desk HTML included:

```text
/assets/zolexora_branding/css/zolexora_dark.css
```

Login HTML included:

```text
/assets/zolexora_branding/css/zolexora-theme.css
/assets/zolexora_branding/css/zolexora_dark.css
```

## Browser Verification

Headless Chrome rendered the local login page successfully:

```text
http://site1.example.com:8080/login
```

Verified:

- Login page rendered with dark navy/charcoal background.
- Login card, labels, inputs, and buttons were readable.
- No raw HTML regression was observed.
- No broken primary branding CSS asset was observed.

Desk verification:

- Authenticated login endpoint returned `{"message":"Logged In"}`.
- `/app` redirected to `/desk`.
- `/desk` returned the full Desk shell with Frappe/ERPNext assets and `zolexora_dark.css`.

## Runtime Regression Proof

Healthcheck:

```text
./scripts/healthcheck.sh
```

Result:

```text
healthcheck completed successfully
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
backups/20260706_045303
```

Checksum result:

```text
database.sql.gz: OK
files.tar: OK
private-files.tar: OK
site_config_backup.json: OK
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
Zolexora dark theme CSS availability: PASS
```

Post-upgrade Payments regression:

```text
payments installed: True
Payment Gateway DocType: Payment Gateway
```

## Remote CI

Passed.

GitHub Actions run:

```text
28758639348
```

Matrix results:

| Job | Result | Duration |
| --- | --- | --- |
| static-validation | passed | 34s |
| docker-operational-validation (`INSTALL_PAYMENTS=0`) | passed | 12m35s |
| docker-operational-validation (`INSTALL_PAYMENTS=1`) | passed | 12m54s |

Default path proof:

```text
Zolexora dark theme CSS availability: PASS
INSTALL_PAYMENTS=0 path validated
sha256sum -c SHA256SUMS
Zolexora dark theme CSS availability: PASS after restore
INSTALL_PAYMENTS=0 post-restore path validated
upgrade validation report written to docs/upgrade-validation-report.md
```

Payments-enabled path proof:

```text
Zolexora dark theme CSS availability: PASS
PAYMENTS_CI_OK
Payment Gateway DocType assertion passed
sha256sum -c SHA256SUMS
Zolexora dark theme CSS availability: PASS after restore
PAYMENTS_RESTORE_CI_OK
Payment Gateway DocType assertion passed after restore
upgrade validation report written to docs/upgrade-validation-report.md
```

## Notes

The local Docker `apps` named volume predated the new CSS source file, so the live local volume was synchronized with the source file before local browser and healthcheck verification. Fresh CI and fresh deployments receive the file through the rebuilt image.
