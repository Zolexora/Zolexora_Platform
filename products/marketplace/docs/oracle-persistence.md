# Oracle persistence foundation

## Implemented and runtime-validated

Marketplace uses SQLAlchemy 2.x metadata, Alembic forward-only migrations, and python-oracledb thin mode under `services/marketplace-api/database/` and `migrations/`. Oracle 19c-compatible SQL is the minimum target: identifiers remain within Oracle's 128-character limit, JSON payloads use CLOB-compatible text with `IS JSON`, and timestamps use Oracle `TIMESTAMP WITH TIME ZONE`.

There is no import-time connection, startup schema creation, `metadata.create_all()`, or static production storefront fallback. Synchronous Oracle work is isolated behind repositories and FastAPI threadpool execution. Pool size and wait time are bounded by `MARKETPLACE_ORACLE_*`; errors expose no connection details.

The first migration creates persisted storefront/domain records and the Phase 3 integration reliability schema. It contains no credentials, external tenant, ERP organization, or live mapping seed. Oracle migrations use separate operator credentials; future runtime credentials should have narrower permissions and later reference OCI Vault.

Phase 5 executed the migration from an empty disposable local schema on Oracle Database 23ai Free 23.9.0.25.07 using python-oracledb thin mode. A second upgrade was a no-op; all 13 tables, constraints, JSON checks, function indexes, and the immutable-key trigger were introspected and exercised. This validates Oracle execution, not OCI Autonomous Database operational parity.

## Storefront bootstrap

`python scripts/bootstrap_storefronts.py` is dry-run by default; `--apply` writes only the two canonical storefronts and five explicit domains. Repeated execution preserves matching rows. Conflicting domain ownership stops the operation. It never creates ERP mappings.

## Health

`/api/health` remains process liveness-compatible. `/api/ready` runs bounded `SELECT 1 FROM DUAL`; missing or unavailable Oracle returns a safe 503. ERP availability is not part of Marketplace readiness.

## Migration policy

Only Alembic upgrades are supported. Applied revisions are immutable; corrections use a new forward migration. Revision 0001 was corrected before its first Oracle execution because repository and Phase 4 evidence showed it had never been applied to a durable schema. Oracle DDL can commit implicitly, so transactional rollback is not promised. SQLite is not accepted as Oracle evidence. See `services/marketplace-api/migrations/README.md`.

## Not implemented

No legacy data import, commerce migration, live ERP client, worker, webhook, replay, reconciliation job, OCI resource, Vault integration, or production mapping exists. MongoDB, Supabase, Redis, and Cloudinary remain transitional for their current domains.

## Activation blockers

- Decide one legal company versus two using GST/legal evidence.
- Obtain ERP adoption or supersession of the proposed v1 contract and verify commercial tenant isolation.
- Validate OCI Autonomous Database compatibility and provision production Database/Vault separately in a later authorized phase.

## Unresolved legal-company gate

- Business owner: Marketplace legal/finance leadership, confirmed with the ERP accounting owner.
- Evidence required: GST registrations, legal entity names, invoice issuer, warehouse ownership, settlement bank ownership, and inter-company policy.
- One-company consequence: both storefronts share one ERP organization while sales channel, cost center, warehouse, invoice series/tax configuration, and payment clearing references remain distinct where required.
- Two-company consequence: each storefront maps to its own ERP organization, GST/tax and invoice configuration, warehouses, and payment/clearing accounts; inter-company flows may be required.
- ERP mapping consequence: `storefront_erp_mapping` supports either arrangement but remains inactive until evidence is approved.
- Cutover prerequisite: approved written mapping plus tested Oracle and ERP configuration.
- Current status: unresolved; no production mapping is seeded or accepted.
