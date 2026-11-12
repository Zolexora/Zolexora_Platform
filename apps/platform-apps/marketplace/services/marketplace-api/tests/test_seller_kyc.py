"""H13: members see only the last four digits of PAN, payout account and Aadhaar; PAN and account
are stored encrypted and only a platform admin (sellers:write) reads them, with an audit row.
Also: admins are auth-service accounts with no users row, and can still verify sellers."""

import json
import uuid

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

from core.config import settings
from core.deps import require_permission
from scripts.protect_seller_kyc import protect
from seller_orgs import kyc
from seller_orgs.repository import PostgresSellerRepository
from seller_orgs.router import admin_get_seller_kyc, create_seller_organization
from seller_orgs.schemas import SellerOrgCreate
from tests.commerce_seed import BUYER_1, SEL_1

FORM = {"legalName": "Asha Textiles", "pan": "ABCDE1234F", "aadhaar": "1234 5678 9012",
        "accountNumber": "000123456789", "confirmAccountNumber": "000123456789", "ifsc": "HDFC0001234"}
ADMIN = {"id": str(uuid.uuid4()), "is_admin": True, "permissions": ["sellers:write"]}  # no users row


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setattr(settings, "SELLER_KYC_ENCRYPTION_KEY", Fernet.generate_key().decode())


def test_members_see_last_four_digits_only():
    public, secrets = kyc.split(FORM)
    assert public == {"legalName": "Asha Textiles", "pan_last4": "234F", "aadhaar_last4": "9012",
                      "account_number_last4": "6789", "ifsc": "HDFC0001234"}
    assert secrets == {"pan": "ABCDE1234F", "account_number": "000123456789"}


@pytest.mark.asyncio
async def test_kyc_is_encrypted_and_only_admins_read_it(pg):
    repo = PostgresSellerRepository(pg)
    org = await create_seller_organization(SellerOrgCreate(name="Asha", slug=f"asha-{uuid.uuid4().hex[:6]}", metadata=FORM),
                                           user={"id": BUYER_1}, repo=repo)
    stored = json.dumps(dict(await pg.fetchrow("SELECT o.metadata, k.* FROM seller_organization o JOIN seller_kyc k ON k.organization_id = o.id WHERE o.id = $1", org["id"])), default=str)
    for plain in ("ABCDE1234F", "000123456789", "123456789012", "1234 5678 9012"):
        assert plain not in stored

    assert await admin_get_seller_kyc(org["id"], admin=ADMIN, repo=repo) == {"pan": "ABCDE1234F", "account_number": "000123456789"}
    assert await pg.fetchval("SELECT count(*) FROM seller_audit_log WHERE organization_id = $1 AND action = 'KYC_VIEWED'", org["id"]) == 1
    with pytest.raises(HTTPException) as exc:  # an admin without sellers:write
        await require_permission("sellers:write")({**ADMIN, "permissions": []})
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_without_a_key_no_organisation_is_created(pg, monkeypatch):
    monkeypatch.setattr(settings, "SELLER_KYC_ENCRYPTION_KEY", "")
    with pytest.raises(HTTPException) as exc:
        await create_seller_organization(SellerOrgCreate(name="Asha", slug="asha-nokey", metadata=FORM),
                                         user={"id": BUYER_1}, repo=PostgresSellerRepository(pg))
    assert exc.value.status_code == 503
    assert await pg.fetchval("SELECT count(*) FROM seller_organization WHERE slug = 'asha-nokey'") == 0


@pytest.mark.asyncio
async def test_older_plain_metadata_is_moved_once(pg):
    await pg.execute("UPDATE seller_organization SET metadata = $2::json WHERE id = $1", uuid.UUID(SEL_1), json.dumps(FORM))
    assert await protect(pg) == 1
    assert await protect(pg) == 0
    metadata = json.loads(await pg.fetchval("SELECT metadata FROM seller_organization WHERE id = $1", uuid.UUID(SEL_1)))
    assert "pan" not in metadata and metadata["pan_last4"] == "234F"
    assert (await kyc.read(pg, SEL_1))["account_number"] == "000123456789"


@pytest.mark.asyncio
async def test_an_auth_service_admin_can_verify_a_seller(pg):
    repo = PostgresSellerRepository(pg)
    org = await repo.create_organization(name="New", slug=f"new-{uuid.uuid4().hex[:6]}", owner_user_id=uuid.UUID(BUYER_1))
    out = await repo.update_organization_verification(org_id=org["id"], verification_status="VERIFIED",
                                                      admin_user_id=uuid.UUID(ADMIN["id"]))
    assert out["status"] == "ACTIVE"
