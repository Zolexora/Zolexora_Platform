# Phase 3.8J Remediation Report — Static Asset Serving & Payments Verification

Date: 2026-07-05
Status: COMPLETED & VERIFIED
Target Branch: main

## Executive Summary

Phase 3.8J addresses Frappe/ERPNext Login UI static asset serving failures and automates frontend asset compilation across container lifecycles in Zolexora ERP. The root cause of static asset 404 errors was identified as volume misalignment in `compose.yaml` (where mounting `assets` directly at `/home/frappe/frappe-bench/sites/assets` conflicted with base image entrypoint symlinking and Nginx app file resolution) combined with unbuilt asset bundles.

All container configurations, initialization scripts, backup/restore procedures, health checks, and upgrade validation pipelines have been updated and verified. The `payments` app (v0.0.1 / version-16) is confirmed active and healthy.

## Root Cause Analysis

1. **Volume Misalignment & Mount Point Collision**:
   - In `compose.yaml`, the `assets` volume was originally mounted directly to `/home/frappe/frappe-bench/sites/assets` for backend and worker services.
   - The base image entrypoint script (`/usr/local/bin/entrypoint.sh`) executes `rm -rf /home/frappe/frappe-bench/sites/assets` to create a symlink to `/home/frappe/frappe-bench/assets`.
   - Because Docker mounts cannot be removed via `rm -rf`, entrypoint failed with `rm: cannot remove '/home/frappe/frappe-bench/sites/assets': Device or resource busy`, causing backend and worker containers to continuously crash or restart.
   - Furthermore, Nginx required access to `/home/frappe/frappe-bench/apps/` because Frappe asset directories symlink app public assets (e.g. `/home/frappe/frappe-bench/sites/assets/frappe -> /home/frappe/frappe-bench/apps/frappe/frappe/public`). Without mounting the `apps` volume into Nginx, static asset requests for app bundles returned HTTP 404.

2. **Missing Asset Build Automation**:
   - Runtime asset compilation (`bench build`) was missing from container startup workflows, resulting in uncompiled or hash-mismatched CSS/JS bundle assets on login pages.

## Fixes Applied

1. **`compose.yaml`**:
   - Fixed volume alignment: set `assets` volume mount path in `x-defaults` and `backend` to `/home/frappe/frappe-bench/assets`, allowing `entrypoint.sh` to successfully create the symlink at `/home/frappe/frappe-bench/sites/assets -> /home/frappe/frappe-bench/assets`.
   - Added `apps` named volume (`apps:/home/frappe/frappe-bench/apps`) across `x-defaults` and `nginx` so compiled frontend assets (`dist/`) and app static files (`public/`) are shared read-only with Nginx.

2. **`scripts/init-site.sh`**:
   - Added stale `bench_migrate.lock` cleanup prior to running `bench migrate` to prevent lock timeout errors during re-runs.
   - Automated frontend asset building (`bench build`) and website cache clearing during site initialization.
   - Ensured full idempotency on repeated execution.

3. **`scripts/restore.sh`**:
   - Added static asset compilation (`bench build`) and cache clearing to post-restore steps to guarantee static assets are immediately served after restoring backups.

4. **`scripts/healthcheck.sh`**:
   - Maintained comprehensive 17-point automated health check suite, including Login CSS asset extraction and HTTP 200 OK verification.

## Command Execution & Verification Evidence

### 1. Phase 7 — Container Rebuild & Retest
- `docker compose -f compose.yaml down`: Successfully stopped and removed container stack.
- `docker compose -f compose.yaml build --pull`: Built images with zero errors.
- `docker compose -f compose.yaml up -d`: All 10 services started and reached `healthy` status (`backend`, `mariadb`, `nginx`, `redis-cache`, `redis-queue`, `redis-socketio`, `scheduler`, `socketio`, `worker-long`, `worker-short`).
- `./scripts/init-site.sh` (Run 1 & Run 2): Both runs completed with 0 errors, validating complete idempotency.
- `./scripts/healthcheck.sh`: 17 of 17 health checks passed (100% pass rate).

### 2. Phase 8 — Payments App & Asset Serving Verification
- Installed app listing:
  ```text
  frappe                16.25.0 UNVERSIONED
  erpnext               16.26.1 UNVERSIONED
  zolexora_core         1.0.0   UNVERSIONED
  zolexora_branding     1.0.0   UNVERSIONED
  zolexora_platform     1.0.0   UNVERSIONED
  zolexora_integrations 1.0.0   UNVERSIONED
  payments              0.0.1   UNVERSIONED
  ```
- Payments app status: CONFIRMED ACTIVE AND INSTALLED.
- Login page CSS asset serving test:
  - Extracted CSS asset URLs from `http://localhost:8080/login`.
  - All CSS asset URLs (including `website.bundle.*.css`, `erpnext-web.bundle.*.css`, `zolexora-theme.css`, `login.bundle.*.css`) returned HTTP 200 OK.

### 3. Phase 9 — Final Regression Gates
- `./scripts/healthcheck.sh`: All 17 checks PASSED.
- `./scripts/status.sh`: All 10 containers healthy, memory/CPU normal, queue depth clear, backup present.
- `./scripts/backup.sh` & SHA256SUMS: Backup created at `backups/20260705_232216`, checksum verification returned `OK` for all archives.
- `RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh`: Rebuilt container stack, executed migration, compiled assets, and passed health checks. Output: `Upgrade validation completed successfully`.

## Verification Instructions

To independently verify this remediation:
1. Run `./scripts/healthcheck.sh` and confirm all 17 checks pass.
2. Run `curl -s http://localhost:8080/login | grep -oE '/assets/[^"]+\.css'` and test returned paths via `curl -I http://localhost:8080/<PATH>` to verify HTTP 200 OK.
3. Run `docker compose -f compose.yaml exec -T backend bench --site site1.example.com list-apps` to confirm `payments` app is listed.
4. Run `RUN_UPGRADE_BUILD=1 ./scripts/upgrade-validation.sh` to confirm end-to-end upgrade readiness.
