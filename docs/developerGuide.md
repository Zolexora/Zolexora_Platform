# Developer Guide

A guide for extending and maintaining Zolexora ERP custom applications.

---

## 1. Custom Apps Layout

- `apps/zolexora_core/` – Core business logic, default roles, custom permissions, and DB setups.
- `apps/zolexora_branding/` – Whitelabel theme CSS, JS, page loaders, and brand logos.
- `apps/zolexora_platform/` – Logistics routing, fleet vehicle trackers, and AI forecasts.
- `apps/zolexora_integrations/` – Third-party API handlers and sync scripts.

---

## 2. Best Practices

### A. Never Edit Frappe/ERPNext Core
All customizations must reside in one of the Zolexora packages. Use Python hooks (`hooks.py`) or customize DocTypes via Custom Fields and Property Setters shipped through fixtures or database migrations.

### B. Whitelisted API Security
Always check user permissions when writing whitelisted APIs. Use `validate_roles()` in `zolexora_core.api` to verify appropriate role access:
```python
from zolexora_core.api import validate_roles

@frappe.whitelist()
def my_api():
    validate_roles(["Manager"])
    # Logic goes here...
```

### C. Workspace Configuration
Do not use deprecated `desktop.py` or `workspace.py` structures. Manage workspaces dynamically as standard `Workspace` DocTypes.

---

## 3. Running Tests
To run unit and integration tests for Zolexora apps inside the Docker backend container:
```bash
docker compose exec backend bench --site site1.example.com run-tests --app zolexora_core
```
