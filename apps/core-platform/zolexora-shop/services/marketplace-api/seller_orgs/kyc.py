"""Seller KYC secrets. Organisation metadata is shown to every member, so it keeps only the last
four digits of the PAN, payout account and Aadhaar. The full PAN and account number (needed for
payouts) are encrypted in seller_kyc with SELLER_KYC_ENCRYPTION_KEY (a Fernet key in Infisical);
full Aadhaar numbers are never stored.
"""

import uuid
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from core.config import settings

# Metadata keys (as the seller apps send them) -> kept secret as / reduced to last four digits.
_SECRET = {"pan": "pan", "accountNumber": "account_number", "account_number": "account_number"}
_LAST4_ONLY = {"aadhaar", "aadhaar_number"}
_DROPPED = {"confirmAccountNumber", "confirm_account_number"}


def _last4(value: Any) -> str:
    return "".join(ch for ch in str(value) if ch.isalnum())[-4:]


def split(metadata: dict | None) -> tuple[dict | None, dict]:
    """(metadata safe to show members, secrets to encrypt)."""
    if not metadata:
        return metadata, {}
    public, secrets = {}, {}
    for key, value in metadata.items():
        if key in _DROPPED:
            continue
        if key in _SECRET and value:
            secrets[_SECRET[key]] = str(value).strip()
            public[f"{_SECRET[key]}_last4"] = _last4(value)
        elif key in _LAST4_ONLY:
            if value:
                public["aadhaar_last4"] = _last4(value)
        elif key not in _SECRET:
            public[key] = value
    return public, secrets


def _fernet() -> Fernet:
    key = settings.SELLER_KYC_ENCRYPTION_KEY
    if not key:
        raise HTTPException(503, "Seller KYC storage is not configured")
    return Fernet(key.encode())


def require_key(secrets: dict) -> None:
    """Fail before anything is written when there are secrets but no key."""
    if secrets:
        _fernet()


async def store(conn, org_id, secrets: dict) -> None:
    if not secrets:
        return
    f = _fernet()
    enc = {k: f.encrypt(v.encode()).decode() for k, v in secrets.items()}
    await conn.execute(
        """INSERT INTO seller_kyc (organization_id, pan_ciphertext, account_number_ciphertext) VALUES ($1, $2, $3)
           ON CONFLICT (organization_id) DO UPDATE SET
             pan_ciphertext = COALESCE(EXCLUDED.pan_ciphertext, seller_kyc.pan_ciphertext),
             account_number_ciphertext = COALESCE(EXCLUDED.account_number_ciphertext, seller_kyc.account_number_ciphertext),
             updated_at = now()""",
        uuid.UUID(str(org_id)), enc.get("pan"), enc.get("account_number"))


async def read(conn, org_id) -> dict:
    row = await conn.fetchrow("SELECT pan_ciphertext, account_number_ciphertext FROM seller_kyc WHERE organization_id = $1",
                              uuid.UUID(str(org_id)))
    if not row:
        return {"pan": None, "account_number": None}
    f = _fernet()

    def plain(token):
        try:
            return f.decrypt(token.encode()).decode() if token else None
        except InvalidToken:
            raise HTTPException(500, "Seller KYC could not be decrypted with the configured key")
    return {"pan": plain(row["pan_ciphertext"]), "account_number": plain(row["account_number_ciphertext"])}
