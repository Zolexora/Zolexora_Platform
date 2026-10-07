# Database Operations Runbook

This runbook defines the contracts and tools for executing database migrations, backup/exports, and isolated restore verifications for Zolexora Marketplace on Oracle Cloud Infrastructure (OCI).

## 1. Database Migrations

**Contract:**
All schema modifications MUST be performed using Alembic. Never use `metadata.create_all()` in production or modify applied revisions manually.

**Tooling:**
- **Generate a new migration:**
  ```bash
  cd services/marketplace-api
  alembic revision --autogenerate -m "description_of_change"
  ```
- **Apply migrations (forward only):**
  ```bash
  cd services/marketplace-api
  alembic upgrade head
  ```
- **Verify migration status:**
  ```bash
  cd services/marketplace-api
  alembic current
  ```

## 2. Backup and Export

**Contract:**
Production database backups are managed automatically by OCI Autonomous Database (ADB). However, logical exports are required for offsite archiving or staging environment synchronization.

**Tooling:**
- **Oracle Data Pump (expdp):**
  Logical exports MUST use Data Pump.
  ```bash
  expdp admin/SECRET@zolexora_tp schemas=MARKETPLACE directory=DATA_PUMP_DIR dumpfile=marketplace_export.dmp logfile=marketplace_export.log
  ```
- Backups MUST NOT contain plaintext secrets or PII without masking, unless exported to an equivalently secure vault.

## 3. Isolated Restore Verification

**Contract:**
No system is production-ready without evidence of successful restore and verification in an isolated environment.

**Tooling & Process:**
1. **Provision isolated environment:**
   Use OCI Free Tier or a disposable Oracle 23ai Free database to simulate a restore environment.
2. **Import Data:**
   ```bash
   impdp admin/SECRET@isolated_db schemas=MARKETPLACE directory=DATA_PUMP_DIR dumpfile=marketplace_export.dmp logfile=marketplace_import.log
   ```
3. **Verify Integrity:**
   Run the backend verification suite against the isolated database.
   ```bash
   cd services/marketplace-api
   DATABASE_URL="oracle+oracledb://..." pytest
   ```
4. **Sign-off:**
   The restore test is considered successful ONLY when the full backend suite passes with zero data-related failures.
