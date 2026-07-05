# Upgrade Validation Report

Date: 2026-07-05T20:14:10+05:30
Result: PASSED for local v16 build and migration validation

## Versions Before

```text

frappe                16.25.0 UNVERSIONED
erpnext               16.26.1 UNVERSIONED
zolexora_core         1.0.0   UNVERSIONED
zolexora_branding     1.0.0   UNVERSIONED
zolexora_platform     1.0.0   UNVERSIONED
zolexora_integrations 1.0.0   UNVERSIONED
payments              0.0.1   UNVERSIONED
```

## Versions After

```text

frappe                16.25.0 UNVERSIONED
erpnext               16.26.1 UNVERSIONED
zolexora_core         1.0.0   UNVERSIONED
zolexora_branding     1.0.0   UNVERSIONED
zolexora_platform     1.0.0   UNVERSIONED
zolexora_integrations 1.0.0   UNVERSIONED
payments              0.0.1   UNVERSIONED
```

## Smoke Validation

```json
{"site": "site1.example.com", "administrator_exists": true, "company_exists": true, "missing_apps": [], "missing_workspaces": [], "payments_installed": true, "install_payments": true, "scheduler_enabled": true}
```

## Workspace Recreation

```json
{"created": ["Zolexora Dashboard", "Zolexora Accounts", "Zolexora Sales", "Zolexora Purchase", "Zolexora Inventory", "Zolexora CRM", "Zolexora Fleet", "Zolexora Logistics", "Zolexora Analytics", "Zolexora Administration", "Zolexora AI"], "existing": [], "skipped": []}
```

## Import Validation

```json
{"installed_apps_checked": ["zolexora_core", "zolexora_branding", "zolexora_platform", "zolexora_integrations", "payments"], "imported_modules": ["zolexora_core", "zolexora_core.hooks", "zolexora_core.site_setup", "zolexora_branding", "zolexora_branding.hooks", "zolexora_platform", "zolexora_platform.hooks", "zolexora_integrations", "zolexora_integrations.hooks", "payments", "payments.hooks"], "failed_imports": []}
```

## Worker Validation

```json
{"job_executed": true, "key": "zolexora_worker_probe:417753071c49421489e4da5633b04ab8"}
```

## Upgrade Integrity

```json
{"failed_patches": [], "schema_conflicts": [], "schema_conflict_check": "bench migrate completed before this validation"}
```

## Upgrade Evidence

Image build/pull, migration, post-migration Workspace recreation, hook imports, smoke validation, worker probe, and failed-patch/schema-conflict checks completed.
