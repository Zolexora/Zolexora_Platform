"""One-off: move PAN, payout account and Aadhaar numbers that older organisations keep in plain
metadata into encrypted seller_kyc (Aadhaar: last four digits only). Safe to re-run.

    bash scripts/setup/with-infisical.sh apps/standalone-apps/marketplace \\
        python services/marketplace-api/scripts/protect_seller_kyc.py
"""

import asyncio
import json
import os
import sys

import asyncpg

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings  # noqa: E402
from seller_orgs import kyc  # noqa: E402

SENSITIVE = {"pan", "accountNumber", "account_number", "aadhaar", "aadhaar_number",
             "confirmAccountNumber", "confirm_account_number"}


async def protect(conn) -> int:
    """Moves the secrets of every organisation that still has them in metadata; returns how many."""
    rows = await conn.fetch("SELECT id, metadata FROM seller_organization WHERE metadata IS NOT NULL")
    moved = 0
    for row in rows:
        metadata = json.loads(row["metadata"]) if isinstance(row["metadata"], str) else row["metadata"]
        if not isinstance(metadata, dict) or not SENSITIVE & metadata.keys():
            continue
        public, secrets = kyc.split(metadata)
        async with conn.transaction():
            await kyc.store(conn, row["id"], secrets)
            await conn.execute("UPDATE seller_organization SET metadata = $2::json, updated_at = now() WHERE id = $1",
                               row["id"], json.dumps(public))
        moved += 1
    return moved


async def main() -> None:
    if not settings.DATABASE_URL:
        sys.exit("DATABASE_URL missing - run through scripts/setup/with-infisical.sh")
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        print(f"Protected KYC of {await protect(conn)} organisation(s).")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
