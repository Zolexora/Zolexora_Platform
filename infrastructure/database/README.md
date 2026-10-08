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
- **MariaDB Backup & Restore**:
  - `scripts/backup.sh`: Creates full MariaDB database backups.
  - `scripts/restore.sh`: Restores MariaDB databases and assets.
  - `scripts/daily-backup.sh`: Automated daily snapshot scheduler.
- **Host & VPS Deployment Engine**:
  - `infrastructure/deployment/backup.sh`: Provider-neutral backup runner.
  - `infrastructure/deployment/restore.sh`: Restores system snapshots.
  - `infrastructure/deployment/verify-backup.sh`: Verifies backup integrity.
