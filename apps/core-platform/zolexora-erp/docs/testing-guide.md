# Zolexora ERP Testing Guide

A guide to running unit and integration tests inside Zolexora's application packages.

---

## 1. Test Architecture

Each custom application contains a `tests/` package where test files are isolated:
- `apps/zolexora_core/zolexora_core/tests/`
- `apps/zolexora_branding/zolexora_branding/tests/`
- `apps/zolexora_platform/zolexora_platform/tests/`
- `apps/zolexora_integrations/zolexora_integrations/tests/`

---

## 2. Running Tests in Container

To execute all tests for a specific application:
```bash
docker compose exec backend bench --site site1.example.com run-tests --app zolexora_core
docker compose exec backend bench --site site1.example.com run-tests --app zolexora_branding
docker compose exec backend bench --site site1.example.com run-tests --app zolexora_platform
docker compose exec backend bench --site site1.example.com run-tests --app zolexora_integrations
```
This runs the unit tests inside the Frappe bench environment.

---

## 3. Writing Custom Tests

Ensure your test file starts with `test_` and inherits from `unittest.TestCase`. Standard python test decorators and assertions can be utilized.
For testing database entries, use `frappe.get_doc()` or `frappe.get_all()` to assert records insertion and state validation.
