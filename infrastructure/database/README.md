# Centralized Database Architecture & Operations

This directory houses centralized database schemas, migrations, and operational procedures for the platform.

## Layout

```text
infrastructure/database/
├── migrations/             # Timestamped and numbered database migrations
│   ├── 001_auth_migration.sql
│   ├── 20260530151849_init_schema.sql
│   └── 202609100001_phase1_foundation.sql
├── schemas/                # Baseline and versioned schema definitions
│   ├── schema.sql
│   └── schema_v2.sql
└── README.md
```

## Operational Tooling

Platform-wide database operations are managed via standardized operational scripts:
- **ERP (MariaDB) backup & restore** — `products/zolexora-erp/scripts/`:
  - `backup-frappe-site.sh`: Creates a verified site backup.
  - `restore-frappe-site.sh <backup-dir>`: Restores a site from backup.
  - `check-frappe-stack-health.sh`: Health-checks the ERP stack.
