# MR-15 Mahila Legacy Server Cutover and Rollback Runbook

## Phase 1: Pre-Cutover Checks
1. Validate that the canonical Marketplace API is fully operational and has endpoints ready to receive production traffic.
2. Ensure the `docs/mahila-legacy-inventory.md` is complete and covers all legacy schemas.
3. Validate that `pnpm verify` passes on the `main` branch.
4. Obtain database snapshots for MongoDB (`shopkart`) and PostgreSQL (`zolexora_marketplace`).
5. Ensure the Migration script has successfully executed in staging (Dry Run), with all reconciliation reports yielding correct count, ownership, and monetary total equivalencies.

## Phase 2: Cutover Execution
1. Place the Legacy Mahila web application in maintenance mode if necessary.
2. Deploy the updated Mahila Legacy Server logic that permanently responds with `410 Gone` on all `/api` endpoints. Do **NOT** terminate the database cluster yet.
3. Once the 410 redirect is live and no new traffic is mutating the legacy database:
   - Export the final MongoDB snapshot.
   - Run the Production Migration tooling that ingests the JSON payload via the canonical Marketplace API.
   - Wait for idempotency and conflict-resolution logs to finalize.
4. Execute the final Reconciliation Script.
   - Compare Total Users.
   - Compare Total Orders and GMV (Monetary-Total).
   - Verify product/listing associations and seller ownership.
5. Deploy the canonical Web and Mobile apps configured to point to `api.zolexora.com`.

## Phase 3: Verification
1. Place a test order through the updated Mahila Web App to verify catalog, checkout, and payment orchestration endpoints.
2. Log into the Seller Portal to confirm the migrated catalog items appear correctly.
3. Confirm real-time inventory decrement works correctly across storefronts.

## Phase 4: Rollback (If needed)
If the migration fails validation or critical API bugs prevent transactions:
1. Revert the canonical Web and Mobile apps to the previous releases.
2. Restore the Mahila Legacy Server to the previous commit (removing the 410 Gone route).
3. Verify that traffic resumes flowing to the MongoDB legacy backend.
4. The newly migrated data in PostgreSQL remains isolated and will not affect the restored legacy operations. Do not delete PostgreSQL data manually unless planning to re-run the full migration from scratch.
