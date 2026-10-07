# Disaster Recovery Report

Date: 2026-07-05T19:35:59+05:30
Result: PASSED

## Commands Executed

```bash
./scripts/init-site.sh
bench --site site1.example.com execute zolexora_core.site_setup.create_dr_validation_data
./scripts/backup.sh
bench --site site1.example.com execute zolexora_core.site_setup.destroy_dr_validation_data
./scripts/restore.sh backups/20260705_193521
bench --site site1.example.com execute zolexora_core.site_setup.validate_dr_validation_data
./scripts/healthcheck.sh
```

## Backup Directory

`backups/20260705_193521`

## Checksum Evidence

```text
d7b22df2ccf29a247901513b61a79201cdd166bb2fcf2137cebfb0d6055c2e20  20260705_193521-site1_example_com-database.sql.gz
f9b6286b3bf9f4f10ddc9f7195d3038331f95974b05805d546054ebbec6fc04b  20260705_193521-site1_example_com-files.tar
20c6e3cb1194b13e7d7a441ee5c5347d48a2405aae6621552ac8c4e7aa6bc24f  20260705_193521-site1_example_com-private-files.tar
7f9b9caa94410bb2c4bdd7b0128c457feef318f93ec8ea456ec0d5903f80a445  20260705_185721-site1_example_com-site_config_backup.json
df9ae718d31c390e25c369ff409394104fc1a913173cb9a0bfb7b2623095dbb2  20260705_191340-site1_example_com-site_config_backup.json
df9ae718d31c390e25c369ff409394104fc1a913173cb9a0bfb7b2623095dbb2  20260705_193521-site1_example_com-site_config_backup.json
```

## Created Data

```json
{"item": "ZEX-DR-ITEM-0001", "item_group": "Zolexora DR Item Group", "customer": "Zolexora DR Customer", "customer_group": "Zolexora DR Customer Group", "territory": "Zolexora DR Territory", "supplier": "Zolexora DR Supplier", "supplier_group": "Zolexora DR Supplier Group", "public_file": "5586f7563b", "private_file": "a1ae33a730"}
```

## Destroyed Data

```json
{"deleted": ["File:zolexora-dr-public.txt", "File:zolexora-dr-private.txt", "Item:ZEX-DR-ITEM-0001", "Customer:Zolexora DR Customer", "Supplier:Zolexora DR Supplier"]}
```

## Validation JSON

```json
{"site": "site1.example.com", "administrator_exists": true, "company_exists": true, "missing_apps": [], "missing_workspaces": [], "payments_installed": true, "install_payments": true, "scheduler_enabled": true, "item_exists": true, "customer_exists": true, "supplier_exists": true, "public_file_exists": true, "private_file_exists": true, "attachment_integrity": {"checked": 2, "missing": 0}, "validator": "create_dr_validation_data"}
```

## Decision

Disaster recovery certification passed for deterministic validation data and attachment restoration.
