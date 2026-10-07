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
    "users", "buyer_address", "storefront", "storefront_domain", "product", "listing",
    "inventory_balance", "cart", "cart_item", "marketplace_order", "order_item",
    "payment_record", "refund_record", "shipment", "idempotency_record",
    "integration_outbox", "external_reference", "audit_event",
    "user_profile", "role", "permission", "user_role", "role_permission",
}


def main() -> None:
    assert set(metadata.tables) >= REQUIRED
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
    assert "storefront_id" in rendered and "seller_id" in rendered and "9007199254740991" in rendered
    assert "password_hash" in rendered
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
