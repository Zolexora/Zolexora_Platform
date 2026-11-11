# Phase 5 Oracle runtime validation audit

## Verdict

**PASS WITH BLOCKERS.** The technical Oracle execution gate passes on a real, explicitly disposable local Oracle database. Migration `0001_oracle_foundation` is usable from an empty schema and remains the single head. Legal-company selection, ERP contract adoption/site isolation, and future OCI Autonomous Database parity remain blocked.

## Starting state and safety

- Date: 2026-07-16 UTC.
- Branch and commit: `main` at `450340a121971b3f5a0e49a86e8e5ba4ed98cf37` (`origin/main`).
- Worktree at entry: modified `.env.example`, Mahila web manifest, `pnpm-lock.yaml`, workspace verifier, Oracle models/repository/migration/tests; untracked `scripts/verify-oracle-runtime.py` and `services/.env.example`. All existing work was preserved.
- Host: Linux `x86_64`; 7.6 GiB RAM, 15 GiB swap, 45 GiB free workspace storage.
- No `MARKETPLACE_ORACLE_TEST_*` variable, listener, or running Oracle container existed.
- Existing local image: `container-registry.oracle.com/database/free:23.9.0.0`, Oracle Container Registry, Linux amd64. It was already cached; no pull, license acceptance, or emulation occurred.
- Target: new Docker container `zolexora-oracle-phase5-test`, bridge network, only `127.0.0.1:1521`, no volume, no imported data, service `FREEPDB1`, dedicated synthetic schema `MARK…TEST`, random in-memory password, and explicit `MARKETPLACE_ORACLE_TEST_ALLOW_DDL=true`.
- The container and schema are local/disposable and contain no Marketplace, customer, payment, production, or ERP data. No remote endpoint was contacted or mutated.
- The container was stopped only for controlled outage tests, restarted, and left running for inspection. It was not removed and no user/schema/database/PDB/tablespace/volume was dropped.

## Migration adoption decision

Git history, tags, documentation, CI configuration, and the Phase 4 audit show that revision `0001_oracle_foundation` was committed but never executed on Oracle or adopted by a durable database. The pre-validation worktree therefore corrected the initial revision directly rather than adding an unverified repair migration. There is still exactly one Alembic head.

## Database and migration evidence

- Database: Oracle Database 23ai Free Release 23.0.0.0.0, version `23.9.0.25.07`.
- Character set: `AL32UTF8`.
- Driver: python-oracledb 3.4.2 thin mode; no Oracle client/wallet or CPU emulation.
- The dedicated schema reported zero objects before Alembic.
- Empty-to-head `alembic upgrade head`: exit 0, measured wall time 1 second.
- `alembic_version`: exactly `0001_oracle_foundation`.
- Second `alembic upgrade head`: exit 0 with no revision execution; no-op confirmed.
- No `metadata.create_all()`, SQLite proof, or downgrade was used.

Dictionary introspection found exactly the intended 13 application tables plus `ALEMBIC_VERSION`:

`STOREFRONT`, `STOREFRONT_DOMAIN`, `EXTERNAL_SYSTEM`, `EXTERNAL_TENANT`, `EXTERNAL_ORGANIZATION`, `EXTERNAL_ENTITY_MAPPING`, `STOREFRONT_ERP_MAPPING`, `INTEGRATION_OUTBOX`, `INTEGRATION_INBOX`, `INTEGRATION_DELIVERY_ATTEMPT`, `INTEGRATION_DEAD_LETTER`, `RECONCILIATION_RUN`, and `RECONCILIATION_ISSUE`.

Actual dictionary totals were 14 primary keys, 16 foreign keys, 10 unique constraints, 113 check/not-null constraints, 35 `TIMESTAMP WITH TIME ZONE` columns, five CLOB columns, and nine NUMBER columns. Defaults, nullability, VARCHAR2 lengths, CLOB payloads, and SQLAlchemy metadata table names matched migration/offline expectations.

Indexes included `IX_OUTBOX_CLAIM`, function-based unique `UQ_DOMAIN_ACTIVE_PRIMARY`, and function-based unique `UQ_STORE_ERP_PERIOD` using `SYS_EXTRACT_UTC(effective_from)`. Five JSON `IS JSON` checks were enabled. `TRG_STOREFRONT_KEY_IMMUTABLE` was enabled and raised ORA-20001 on key mutation.

## Runtime validation results

`scripts/verify-oracle-runtime.py` completed 28 real-Oracle checks:

- Bootstrap dry-run planned seven writes and changed no rows.
- First apply created exactly two storefronts and five approved domains; it created no external system, tenant, organization, ERP mapping, credential, GST, company, warehouse, payment, or legal-entity data.
- Second apply returned no actions and preserved existing valid rows.
- A synthetic conflicting-domain owner was rejected and only that controlled test mutation was cleaned.
- Storefront duplicate key, uppercase key, required column, immutable key, invalid host shapes, global hostname collision, and one-active-primary rules rejected invalid writes.
- Valid and 200 KB JSON CLOBs passed; malformed JSON and required empty-string-as-NULL payloads failed safely.
- Invalid tenant, delivery-attempt/outbox, and reconciliation-issue/run references failed; integration-history parent deletion did not cascade.
- Synthetic one-company/two-channel and two-company/two-organization layouts both worked. No layout was selected or persisted as production configuration; overlap enforcement remained a repository rule.
- Inbox uniqueness deduplicated the same tenant/event, classified same-hash duplicate versus changed-hash conflict, and allowed the same event ID under another tenant.
- Outbox uniqueness rejected a duplicate idempotency key and allowed independent keys; correlation/hash fields remained available.
- Three independent sessions using ordered `FOR UPDATE SKIP LOCKED` plus bounded `fetchmany()` received disjoint batches, left rows available to another claimer, and used explicit rollback. An expired synthetic lease matched the retry predicate. No worker was implemented.
- Repository lookups resolved all five canonical production/development hosts exactly; unknown, malformed, disabled, mismatched, forged, seller/admin, and forwarded-host attempts failed closed. Public output omitted internal IDs.
- Real repository endpoint behavior was 200 while Oracle was available, safe 503 while the local container was stopped, and 200 after restart.
- Engine construction/import left zero checked-out connections. Pool bounds map min 1/max 5 to QueuePool size 1 plus overflow 4. Readiness executed `SELECT 1 FROM DUAL`, returned 200 available, safe 503 unavailable, and recovered to 200. Liveness stayed 200 and ERP was not part of readiness.

## Oracle-specific corrections

1. Escaped Oracle trigger `:OLD`/`:NEW` pseudorecords so SQLAlchemy does not treat them as bind variables.
2. Replaced timezone-column unique-constraint compilation with a `SYS_EXTRACT_UTC(effective_from)` function-based unique index.
3. Replaced Oracle Boolean `IS 1` compilation with numeric `= 1` predicates in the storefront repository.
4. Mapped configured pool min/max to retained pool size and bounded overflow; removed the unused increment knob.
5. Made Mahila mobile test environment cleanup run before each test so aggregate verification is deterministic when public build variables are present.

Regression tests cover all five corrections. Because `0001` had never run on Oracle before this disposable test, corrections 1–3 remain in the canonical initial migration; no repair migration was added.

## Verification summary

- Offline Oracle persistence tests: 18 passed.
- Storefront resolver tests: 54 passed.
- Combined focused storefront/Oracle tests: 72 passed.
- Real Oracle runtime checks: 28 passed; controlled readiness and repository outage/recovery checks also passed.
- Full FastAPI suite: 149 passed, zero skipped; compilation and Ruff passed.
- ERP contracts: 12 schemas, seven examples, proposed OpenAPI 3.1 validated; status remains proposed.
- Client tests: 15 passed across four suites; zero skipped.
- Frozen pnpm install, 10-package guard, 8/8 builds, 7/7 type-checks, 2/2 configured lint tasks plus Ruff, and complete `pnpm verify` passed. Production builds used only the public documented API URL in the command environment.
- Both Compose files parsed; the legacy scale file retains an existing obsolete `version` warning.
- Exactly one lockfile, zero broken symlinks, zero skipped-test markers, zero forbidden ERP coupling hits, private-key/provider-token signature scan passed, and `git diff --check` passed.

## Repeat and cleanup policy

Use only a newly created localhost-only, no-volume container and a generated password. Export the four `MARKETPLACE_ORACLE_TEST_*` values without logging them, create a dedicated empty test schema, set the corresponding runtime Oracle variables, run `alembic upgrade head` twice, then run `.venv/bin/python scripts/verify-oracle-runtime.py`. Never point the verifier at a remote DSN; it rejects anything other than `127.0.0.1:1521/FREEPDB1` and `MARKETPLACE_TEST` with explicit DDL permission.

Stopping/restarting this named local test container is permitted for outage validation. Removal or database/user/PDB/volume cleanup is manual and must reconfirm that the target is this disposable container. Do not reuse its schema as durable development data or a backup.

## Remaining blockers and next objective

- P0: legal/GST evidence must select one-company/two-channel or two-company configuration before any real ERP mapping.
- P0: ERP product owners must adopt or supersede proposed v1 and prove commercial tenant/site isolation.
- P1: the local Free 23ai result does not prove OCI Autonomous Database version, privileges, TLS/wallet, resource limits, or operational parity.
- P1/P2 existing commerce/auth/payment/OCI gaps remain unchanged; migration 0002 and new marketplace features were not started.

Recommended Phase 6 objective: after explicit authorization, validate the unchanged migration and runtime behavior on an isolated disposable OCI non-production target, resolve legal/ERP decision gates, and define the next forward migration only after those gates—not provision or deploy from this worktree.

No commit, push, deployment, OCI provisioning, backup, legacy import, live ERP call, production mapping, or remote database mutation occurred.
