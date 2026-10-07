# Zolexora ERP Phase 3.6 RC1 Validation Report

Report generated: 2026-07-03T01:30:20+05:30

Validation scope: production validation, QA, Docker deployment verification, and release-candidate certification for Zolexora ERP MVP.

Certification decision: **Not RC1 Certified**

Zolexora ERP cannot be marked RC1 Certified because the clean documented installation path does not complete. The final validated blocker is in site bootstrap during `zolexora_core` installation:

```text
frappe.exceptions.LinkValidationError: Could not find Warehouse Type: Transit
```

This occurs when `zolexora_core.site_setup._create_company()` inserts the default company during the app `after_install` hook. ERPNext then attempts default warehouse creation and fails because the required `Warehouse Type: Transit` master data is not present.

## Executive Summary

The release candidate is not production-ready. Docker image build was validated successfully after remediation, and the stack can start with MariaDB, Redis, backend, workers, scheduler, Socket.IO, and Nginx. However, the clean installation gate fails during custom app bootstrap. Since clean installation is a mandatory release rule, backup/restore, upgrade, security certification, performance certification, API certification, UI certification, disaster recovery, and release scoring cannot be certified.

No production readiness score is assigned. Per the release rule, scores must be based only on completed verification, and the required prerequisite validation did not complete.

## Validation Environment

- Host project path: `/home/chickenman/Documents/my_projects/ZolexoraERP`
- Host timezone: Asia/Kolkata
- Validation date: 2026-07-03
- Runtime target: Docker Compose
- Compose file: `compose.yaml`
- Docker image base: `frappe/erpnext:version-16`
- Site name from environment: `site1.example.com`
- Validation mode: local clean-volume Docker validation

## Commands Executed

```bash
docker compose -f compose.yaml config
docker compose -f compose.yaml build
docker compose -f compose.yaml up -d
./scripts/init-site.sh
docker compose -f compose.yaml down -v
docker compose -f compose.yaml up -d
./scripts/init-site.sh
```

Additional targeted checks were run for service state, logs, Python compile, lint availability, and unit test discovery.

## Remediations Applied During Validation

The following release-readiness remediations were applied because they blocked objective validation before the application bootstrap blocker was reached.

### Docker and Frappe Runtime Configuration

- Removed obsolete Compose `version` field.
- Added MariaDB healthcheck using authenticated `mariadb-admin ping`.
- Added Redis healthchecks for cache, queue, and Socket.IO Redis.
- Added backend startup configuration using `configure-common-site`.
- Added dependency health gates so backend waits for database and Redis services.
- Added healthchecks for backend, scheduler, workers, Socket.IO, and Nginx.
- Added `scripts/configure-common-site.sh` to write Frappe common site config from environment variables.

### Bootstrap Script Fixes

- Replaced invalid `bench new-site --mariadb-host` with valid ERPNext/Frappe v16 option `--db-host`.
- Changed bootstrap `docker compose exec` calls to non-interactive `-T` where appropriate.
- Ensured common site config is written before `bench new-site`.

### Frappe App Packaging Fixes

- Removed invalid ERPNext standard module claims from custom app `modules.txt`.
- Added minimal Python packages expected by Frappe for custom modules:
  - `apps/zolexora_core/zolexora_core/zolexora_core/__init__.py`
  - `apps/zolexora_branding/zolexora_branding/zolexora_branding/__init__.py`
  - `apps/zolexora_platform/zolexora_platform/zolexora_platform/__init__.py`
  - `apps/zolexora_integrations/zolexora_integrations/zolexora_integrations/__init__.py`

## Detailed Validation Results

### 1. Fresh Installation Test

Status: **Failed**

Evidence:

- Docker images built successfully.
- Clean volumes were removed using:

```bash
docker compose -f compose.yaml down -v
```

- Stack started from clean volumes using:

```bash
docker compose -f compose.yaml up -d
```

- Documented bootstrap command was run:

```bash
./scripts/init-site.sh
```

Failure:

```text
frappe.exceptions.LinkValidationError: Could not find Warehouse Type: Transit
```

Root cause:

`zolexora_core.site_setup.setup_site()` runs as `after_install`. It calls `_create_company()`, which inserts `Company` before ERPNext required warehouse type seed data is available or verified.

Impact:

- Site creation does not complete.
- Zolexora apps do not all install successfully.
- Administrator login and dashboard load cannot be verified.
- Clean clone deployment cannot be certified.

### 2. Docker Validation

Status: **Partially Passed, Not Certified**

Verified:

- Docker Compose config validates after remediation.
- Docker image build succeeds.
- MariaDB becomes healthy.
- Redis cache becomes healthy.
- Redis queue becomes healthy.
- Redis Socket.IO becomes healthy.
- Backend becomes healthy before site bootstrap.

Final observed service state after failed bootstrap:

```text
zolexora-backend          healthy
zolexora-mariadb          healthy
zolexora-redis-cache      healthy
zolexora-redis-queue      healthy
zolexora-redis-socketio   healthy
zolexora-nginx            unhealthy
zolexora-scheduler        unhealthy
zolexora-socketio         unhealthy
zolexora-worker-long      unhealthy
zolexora-worker-short     unhealthy
```

Notes:

- The unhealthy final state is downstream of incomplete site creation and healthchecks that expect service processes/routes to be ready.
- Automatic restart and failure recovery were not certified.
- Startup logs originally showed Redis misconfiguration to localhost; this was remediated by writing Frappe `common_site_config.json`.

### 3. Site Bootstrap Validation

Status: **Failed**

Verified:

- `bench new-site` starts successfully after replacing `--mariadb-host` with `--db-host`.
- Frappe DocType sync completes.
- ERPNext DocType sync completes.

Failed:

- `zolexora_core` installation fails in `after_install`.
- Company creation fails because ERPNext cannot find `Warehouse Type: Transit`.

Not verified:

- Company creation
- Currency
- Timezone
- Administrator login
- Custom roles
- Workspaces
- Fixtures
- Custom app install completion

### 4. Database Validation

Status: **Not Certified**

Partial observations:

- MariaDB starts and passes healthcheck.
- Frappe and ERPNext DocType sync began and reached 100%.

Not completed:

- Full migrations
- Constraints
- Indexes
- Foreign keys
- Custom DocTypes
- Fixtures
- Seed data
- Rollback testing

Reason:

Clean site bootstrap fails before the database reaches a completed install state.

### 5. Backup and Restore Certification

Status: **Not Executed**

Reason:

Backup and restore certification requires a successfully installed site with data. Clean install failed.

Additional risk identified:

- `scripts/restore.sh` restores only the database backup file.
- File backups for public/private files are not restored by the script.
- This means attachments and file-backed data would not be certified even after site bootstrap is fixed.

### 6. Upgrade Validation

Status: **Not Executed**

Reason:

Upgrade validation requires a working installed baseline. Clean install failed.

### 7. Security Validation

Status: **Not Certified**

Executed:

- Basic secret pattern scan with `rg`.

Observed:

- `.env` exists in the working tree.
- `.env.example` contains placeholder/default secrets such as `ChangeMe123!`.
- Production secret handling was not certified.

Not executed:

- Dependency scan
- Container vulnerability scan
- Static analysis security scan
- Permission audit
- Authentication audit
- Authorization audit
- CSRF verification
- CORS verification
- Session validation

Reason:

Application bootstrap failed before a testable running application existed.

### 8. Performance Validation

Status: **Not Executed**

Reason:

Performance testing requires a functioning installed site and load data. Clean install failed.

Required future dataset:

- 100,000 Items
- 50,000 Customers
- 10,000 Suppliers
- 250,000 Sales Orders
- 500,000 Stock Ledger Entries

### 9. API Validation

Status: **Not Executed**

Reason:

APIs cannot be certified until the site installs and authentication can be exercised.

### 10. Branding Validation

Status: **Not Certified**

Observed:

- Branding app contains logo, favicon, CSS, and JavaScript assets.

Not verified:

- Login branding
- Dashboard branding
- Print formats
- Email templates
- Browser title
- Dark mode
- Absence of ERPNext branding

Reason:

Dashboard/login could not be loaded due to failed site bootstrap.

### 11. UI/UX Validation

Status: **Not Executed**

Reason:

No installed site was available for browser validation.

### 12. Multi-Company Validation

Status: **Not Executed**

Reason:

Initial company creation fails during bootstrap.

### 13. Disaster Recovery

Status: **Not Executed**

Reason:

DR testing requires a successfully installed baseline and known-good backup/restore path. Clean install failed.

### 14. CI/CD Validation

Status: **Partially Reviewed, Not Certified**

Observed:

- GitHub Actions workflow exists at `.github/workflows/ci.yml`.
- Workflow runs Black/Ruff and Docker build.

Problems:

- Host test discovery from `apps/` found zero tests.
- Per-app tests fail on host because `frappe` is not installed:

```text
ModuleNotFoundError: No module named 'frappe'
```

- `black` was not available on the local host.
- CI does not validate clean site bootstrap.
- CI does not validate backup/restore.
- CI does not validate deployment rollback.
- CI does not validate Northflank deployment.

### 15. Documentation Validation

Status: **Failed**

Documented install commands did not work before remediation:

```bash
./scripts/init-site.sh
```

Original failure:

```text
Error: No such option: --mariadb-host
```

After remediation, the script progresses further but still fails during Zolexora app install due to `Warehouse Type: Transit`.

### 16. Code Quality Validation

Status: **Not Certified**

Executed:

```bash
ruff check apps
python3 -m compileall apps scripts
```

Results:

- `ruff check apps`: passed.
- `python3 -m compileall apps scripts`: passed.
- `python3 -m black --check apps`: failed because `black` is not installed on host.
- Unit tests fail outside a Frappe environment due to missing `frappe`.

Not executed:

- Duplicate code detection
- Unused code detection
- Type checking
- Dependency audit
- Coverage report

### 17. Test Coverage

Status: **Not Certified**

Observed:

- Test files exist for all four apps.
- Tests are shallow unit tests.
- Host-level app tests fail due to missing Frappe dependency.

Not available:

- Coverage percentage
- Integration tests
- Migration tests
- Docker tests
- Security tests
- End-to-end tests
- Smoke test suite for clean install

### 18. Release Artifacts

Status: **Not Generated**

Reason:

Release artifacts should not be produced for a failed RC certification.

Not generated:

- Version number
- Release notes
- Changelog
- Docker image tags
- Deployment package
- Migration notes
- Known issues release package
- Support matrix

## Root Cause Analysis

### RC Blocker 1: Bootstrap Company Creation Depends on Missing ERPNext Master Data

Location:

- `apps/zolexora_core/zolexora_core/site_setup.py`
- Function: `_create_company()`

Failure:

```text
frappe.exceptions.LinkValidationError: Could not find Warehouse Type: Transit
```

Likely cause:

ERPNext company insertion triggers default warehouse creation. The target ERPNext v16 image expects a `Warehouse Type` document named `Transit`. The custom bootstrap does not ensure this seed exists before creating the company.

Recommended remediation:

1. Make `setup_site()` idempotent and dependency-aware.
2. Ensure required ERPNext master data exists before inserting `Company`.
3. Prefer ERPNext-supported setup APIs where available instead of manually inserting company data.
4. Add an automated smoke test that runs `bench new-site` with all Zolexora apps from clean volumes.

### RC Blocker 2: Restore Script Does Not Restore Files

Location:

- `scripts/restore.sh`

Issue:

The restore script finds and restores only `*-database.sql.gz`. It does not restore public or private file archives.

Impact:

Backup/restore certification cannot pass because attachments and file-backed records would be at risk.

Recommended remediation:

1. Restore database backup.
2. Restore private files archive.
3. Restore public files archive.
4. Verify attachment records and physical files after restore.

### RC Blocker 3: CI Does Not Prove Installability

Location:

- `.github/workflows/ci.yml`

Issue:

CI runs formatting/lint and Docker build only. It does not run:

- Clean site creation
- App installation
- Migration
- Smoke login/API checks
- Backup/restore

Recommended remediation:

Add a CI job that starts the Compose stack, runs `./scripts/init-site.sh`, checks installed apps, verifies `bench --site <site> migrate`, and runs a smoke endpoint/login validation.

### RC Blocker 4: Test Suite Is Not Executable on Host

Issue:

Per-app tests import modules that import `frappe`, but the host test environment does not install Frappe.

Observed error:

```text
ModuleNotFoundError: No module named 'frappe'
```

Recommended remediation:

Run tests inside the ERPNext/Frappe container or provide a test dependency environment that installs Frappe correctly.

## Certification Matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| Fresh installation | Failed | `Warehouse Type: Transit` bootstrap failure |
| Docker build | Passed | `docker compose -f compose.yaml build` completed |
| Docker runtime health | Not certified | Some services unhealthy after failed bootstrap |
| Site bootstrap | Failed | `zolexora_core` after-install failure |
| Database validation | Not certified | Install incomplete |
| Backup | Not executed | Requires installed site |
| Restore | Not executed | Requires backup and installed site |
| Upgrade validation | Not executed | Requires installed baseline |
| Security validation | Not certified | Full scan not run |
| Performance validation | Not executed | Requires installed site and load data |
| API validation | Not executed | Requires installed site |
| Branding validation | Not certified | UI not accessible |
| UI/UX validation | Not executed | UI not accessible |
| Multi-company validation | Not executed | Initial company creation fails |
| Disaster recovery | Not executed | Requires installed baseline |
| CI/CD validation | Not certified | CI lacks bootstrap validation |
| Documentation validation | Failed | Documented install path fails |
| Code quality | Not certified | Partial lint/compile only |
| Test coverage | Not certified | No coverage report |
| Release artifacts | Not generated | RC failed |

## Final Certification Scores

Scores are intentionally not assigned.

The release criteria explicitly require scores to be based only on completed verification. Since clean installation and bootstrap failed, the following scores remain unscored:

- Security Score: Not scored
- Performance Score: Not scored
- Reliability Score: Not scored
- Maintainability Score: Not scored
- Upgrade Compatibility Score: Not scored
- Production Readiness Score: Not scored

## Required Remediation List

1. Fix `zolexora_core.site_setup.setup_site()` so company creation succeeds on a clean ERPNext v16 site.
2. Add prerequisite master-data seeding or use ERPNext setup APIs before company insertion.
3. Rerun clean install from removed Docker volumes.
4. Confirm all custom apps install successfully.
5. Confirm `bench --site site1.example.com migrate` succeeds.
6. Verify Administrator login and dashboard load.
7. Fix healthchecks for scheduler/workers/Socket.IO/Nginx after site creation if they remain unhealthy.
8. Update restore script to restore database, private files, and public files.
9. Add CI clean-install smoke test.
10. Run container/dependency/secret/static security scans.
11. Add executable Frappe-aware test workflow and coverage reporting.
12. Only after clean install passes, run backup/restore, upgrade, performance, API, UI, multi-company, DR, and release artifact validation.

## Release Decision

Zolexora ERP Phase 3.6 is **not RC1 Certified**.

The project must not be released to production until the clean documented installation completes, all containers are healthy, backup/restore is verified, upgrade validation succeeds, no Critical vulnerabilities remain, and all required certification gates are completed.
