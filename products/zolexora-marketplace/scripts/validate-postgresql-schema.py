#!/usr/bin/env python3
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "services/marketplace-api"
sys.path.insert(0, str(API))

from sqlalchemy import CheckConstraint, ForeignKeyConstraint, UniqueConstraint  # noqa: E402
from sqlalchemy.dialects import postgresql  # noqa: E402
from sqlalchemy.schema import CreateIndex, CreateTable  # noqa: E402

from database.models import metadata  # noqa: E402

REQUIRED = {
    "users", "user_profile", "buyer_address", "storefront", "storefront_domain",
    "seller_organization", "seller_org_member", "seller_storefront_grant",
    "master_product", "product_variant", "storefront_listing", "inventory_ledger", "inventory_reservation",
    "shopping_cart", "shopping_cart_item", "checkout_quote", "marketplace_order", "order_item",
    "payment_record", "refund_record", "shipment", "idempotency_record",
    "integration_outbox", "external_reference", "audit_event",
}
# One commerce model (migration 0020): sellers are organisations; no local roles (0019).
RETIRED = {"product", "listing", "inventory_balance", "cart", "cart_item", "role", "permission", "user_role", "role_permission"}


def main() -> None:
    assert set(metadata.tables) >= REQUIRED, REQUIRED - set(metadata.tables)
    assert not set(metadata.tables) & RETIRED, set(metadata.tables) & RETIRED
    constraints = [item for table in metadata.tables.values() for item in table.constraints]
    assert sum(isinstance(item, ForeignKeyConstraint) for item in constraints) >= 20
    assert sum(isinstance(item, UniqueConstraint) for item in constraints) >= 15
    assert sum(isinstance(item, CheckConstraint) for item in constraints) >= 25
    sql = []
    for table in metadata.sorted_tables:
        sql.append(str(CreateTable(table).compile(dialect=postgresql.dialect())))
        sql.extend(str(CreateIndex(index).compile(dialect=postgresql.dialect())) for index in table.indexes)
    rendered = "\n".join(sql)
    assert "TIMESTAMP WITH TIME ZONE" in rendered and "BIGINT" in rendered and "FOREIGN KEY" in rendered
    assert "storefront_id" in rendered and "organization_id" in rendered and "9007199254740991" in rendered
    assert "password_hash" not in rendered  # credentials belong to the auth service
    assert not re.search(r"\b(api_key|client_secret|webhook_secret|private_key|access_token)\b", rendered, re.I)

    active = [
        API / "database", API / "shared/database", API / "main.py",
        API / "requirements.txt", ROOT / "package.json",
    ]
    files = [path for root in active for path in ([root] if root.is_file() else root.rglob("*.py"))]
    source = "\n".join(path.read_text() for path in files)
    assert not re.search(r"\b(oracledb|OracleConfig|MARKETPLACE_ORACLE|oracle\+oracledb|FROM DUAL)\b", source)


if __name__ == "__main__":
    main()
