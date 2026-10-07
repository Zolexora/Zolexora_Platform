# Legacy MongoDB and Supabase to PostgreSQL import design

**Status: UNIMPLEMENTED and deferred.** MR-02 does not connect to MongoDB or Supabase, read customer records, dual-write, or mutate a production database.

## Source mapping

| Legacy source | Canonical PostgreSQL destination | Stable identity and validation |
| --- | --- | --- |
| Supabase `auth.users` | `users` | Preserve valid UUIDs; UUIDv5-map invalid IDs; normalize/lowercase email; reject duplicate identity; import no token, service key, OTP, or unsupported password hash |
| Supabase `public.users` | `user_profile`, `user_role` | Join by source identity; map profile fields; map `viewer` to `buyer`; require explicit approval for seller/admin; reject unknown roles |
| Supabase addresses | `buyer_address` | Resolve canonical user UUID; reject orphan addresses |
| MongoDB products | `product` | Preserve a valid UUID or derive UUIDv5 from `source-system + collection + legacy-id`; require seller ownership |
| MongoDB storefront product/listing data | `listing` | Resolve exact registered storefront key; require `(storefront_id, seller_id, product_id)` uniqueness |
| MongoDB stock fields | `inventory_balance` | Map only validated on-hand quantity; reserved quantity starts only from reconciled reservation evidence |
| MongoDB carts/items | `cart`, `cart_item` | Resolve one storefront per cart; reject mixed-store listings and ambiguous owner identities |
| MongoDB orders/items | `marketplace_order`, `order_item` | Require immutable storefront and seller; reconcile integer minor-unit totals against item snapshots |
| Supabase/MongoDB payment and refund state | `payment_record`, `refund_record`, `external_reference` | Preserve provider-neutral references; never import credentials or unverified provider payloads |
| Shipping documents | `shipment`, `external_reference` | Normalize accepted fulfillment state; retain only safe external identifiers |

## Determinism and conflicts

The future importer must maintain a source-key ledger and use UUIDv5 for legacy identifiers that are not valid canonical UUIDs. Repeated dry-runs must produce identical identifiers and hashes. Conflicting email, storefront, seller ownership, external reference, currency, or money totals stop that record; no last-write-wins behavior is permitted.

## Required execution phases

1. Export immutable source snapshots through separately authorized tooling.
2. Run an offline format/schema validation and dry-run that writes no canonical rows.
3. Reconcile record counts, orphan counts, ownership, storefront totals, inventory totals, order money totals, and duplicate external references.
4. Import into an empty disposable PostgreSQL database in explicit transactions, recording source keys and rejected records.
5. Repeat reconciliation and application smoke tests before any cutover authorization.
6. For rollback before cutover, discard the disposable target. After cutover, use a separately approved forward repair; never reverse-import into legacy systems.

Executable import tooling, production credentials, cutover, dual-write, customer-data mutation, and deletion of recoverable legacy definitions are deferred to a later authorized milestone.

## MR-03 identity dry-run artifact

`services/marketplace-api/scripts/migrate_supabase_identities.py` accepts only an immutable local JSON export containing `auth_users` and `public_users`. It performs no network or database operation and has no apply mode. Output is stable JSON with mapped/rejected counts, deterministic IDs, normalized email, verified state, canonical role, and `password_reset_required`; sensitive source fields are ignored and never echoed.

Known seller/admin roles are rejected unless the operator explicitly supplies `--allow-privileged`; unknown roles are always rejected. Duplicate normalized emails stop the later record. Production import must later add approved reconciliation, transactional writes, count/ownership review, and cutover authorization. Legacy Supabase password hashes are not imported: affected identities require password reset.
