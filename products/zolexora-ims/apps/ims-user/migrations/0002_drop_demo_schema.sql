-- One-time reset for business scoping (step 4 of the IMS auth migration).
-- The 0001 tables keyed rows globally and tied them to a local organizations/users table; they held
-- demo data only (ORG_ZOLEXORA_00x). This drops them. The IMS backend then creates the new tables from
-- services/user-api/schema.sql on its next start. Run once per D1 database, e.g.:
--   wrangler d1 execute zolexora-ims-1-db --remote --file=apps/ims-user/migrations/0002_drop_demo_schema.sql
PRAGMA defer_foreign_keys = true;
DROP TABLE IF EXISTS cash_drawer_logs;
DROP TABLE IF EXISTS pos_tables;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS aggregator_orders;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS selling_point_expenses;
DROP TABLE IF EXISTS selling_point_purchases;
DROP TABLE IF EXISTS selling_point_sales;
DROP TABLE IF EXISTS issuance_transactions;
DROP TABLE IF EXISTS supplier_transactions;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS selling_points;
DROP TABLE IF EXISTS stores;
DROP TABLE IF EXISTS organizations;
