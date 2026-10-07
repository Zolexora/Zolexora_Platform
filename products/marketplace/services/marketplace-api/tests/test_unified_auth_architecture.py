import pytest
from unittest.mock import AsyncMock, patch
from auth.services import mask_phone, mask_email
from auth.schemas import CompleteUnifiedRegistrationRequest


def test_mask_helpers():
    """Verify phone and email masking."""
    assert mask_phone("9876543210") == "******3210"
    assert mask_phone("+919876543210") == "******3210"
    assert mask_phone(None) is None
    assert mask_email("user@example.com") == "u***@example.com"
    assert mask_email(None) is None


def test_manual_name_validation_cannot_be_empty():
    """Verify registration request requires non-empty manual name."""
    with pytest.raises(ValueError):
        CompleteUnifiedRegistrationRequest(
            email="newuser@example.com",
            name="   ",
            password="Password123!",
            phone="9876543210",
            email_otp="123456",
            phone_otp="654321",
        )


@pytest.mark.asyncio
async def test_check_email_account_existing_and_new():
    """Verify check-email returns appropriate status and auth methods."""
    from auth.services import check_email_account
    mock_repo = AsyncMock()
    
    # Case 1: User does not exist
    mock_repo.get_by_email.return_value = None
    res_new = await check_email_account("nonexistent@example.com", mock_repo)
    assert res_new["exists"] is False

    # Case 2: User exists
    mock_repo.get_by_email.return_value = {
        "id": "12345678-1234-5678-1234-567812345678",
        "email": "existing@example.com",
        "name": "Existing User",
    }
    with patch("auth.services.connection") as mock_conn:
        mock_ctx = AsyncMock()
        mock_ctx.fetchval.return_value = "9876543210"
        mock_conn.return_value.__aenter__.return_value = mock_ctx
        res_existing = await check_email_account("existing@example.com", mock_repo)
        assert res_existing["exists"] is True
        assert res_existing["masked_phone"] == "******3210"
        assert "password" in res_existing["auth_methods"]
        assert "otp" in res_existing["auth_methods"]


@pytest.mark.asyncio
async def test_google_auth_existing_vs_new():
    """Verify Google OAuth bypass for existing users vs required registration for new users."""
    from auth.services import authenticate_google_user
    mock_repo = AsyncMock()

    # Existing user -> is_new=False
    mock_repo.get_by_email.return_value = {"id": "uid-1", "email": "google@example.com", "name": "Google User"}
    is_new, user = await authenticate_google_user("google@example.com", mock_repo)
    assert is_new is False
    assert user is not None

    # New user -> is_new=True, user=None
    mock_repo.get_by_email.return_value = None
    is_new, user = await authenticate_google_user("newgoogle@example.com", mock_repo)
    assert is_new is True
    assert user is None


@pytest.mark.asyncio
async def test_firebase_exchange_links_verified_email_to_existing_identity():
    """A verified Firebase email can establish a one-to-one Marketplace link."""
    from auth.services import exchange_firebase_identity

    repo = AsyncMock()
    repo.get_by_external_identity.return_value = None
    repo.get_by_email.return_value = {
        "id": "12345678-1234-5678-1234-567812345678",
        "email": "buyer@example.com",
        "password_hash": "not-returned",
    }

    user = await exchange_firebase_identity(
        {
            "sub": "firebase-subject",
            "email": "buyer@example.com",
            "email_verified": True,
        },
        repo,
    )

    assert user["email"] == "buyer@example.com"
    assert "password_hash" not in user
    repo.link_external_identity.assert_awaited_once_with(
        user_id="12345678-1234-5678-1234-567812345678",
        provider="firebase",
        subject="firebase-subject",
    )


@pytest.mark.asyncio
async def test_firebase_password_exchange_accepts_marketplace_verified_email():
    """Marketplace email OTP verification remains valid for Firebase password tokens."""
    from auth.services import exchange_firebase_identity

    repo = AsyncMock()
    repo.get_by_external_identity.return_value = None
    repo.get_by_email.return_value = {
        "id": "12345678-1234-5678-1234-567812345678",
        "email": "buyer@example.com",
        "is_email_verified": True,
        "password_hash": "not-returned",
    }

    user = await exchange_firebase_identity(
        {
            "sub": "password-firebase-subject",
            "email": "buyer@example.com",
            "email_verified": False,
            "firebase": {"sign_in_provider": "password"},
        },
        repo,
    )

    assert user["email"] == "buyer@example.com"
    repo.link_external_identity.assert_awaited_once_with(
        user_id="12345678-1234-5678-1234-567812345678",
        provider="firebase",
        subject="password-firebase-subject",
    )


@pytest.mark.asyncio
async def test_otp_authenticated_user_can_enroll_matching_firebase_email_password():
    """OTP recovery can attach an unverified Firebase email/password account only to its owner."""
    from auth.services import enroll_firebase_email_identity

    repo = AsyncMock()
    repo.get_by_external_identity.return_value = None
    user = {"id": "12345678-1234-5678-1234-567812345678", "email": "buyer@example.com"}

    result = await enroll_firebase_email_identity(
        {"sub": "firebase-subject", "email": "buyer@example.com"}, user, repo,
    )

    assert result == user
    repo.link_external_identity.assert_awaited_once_with(
        user_id=user["id"], provider="firebase", subject="firebase-subject",
    )


@pytest.mark.asyncio
async def test_otp_recovery_cannot_link_a_different_firebase_email():
    """OTP session and Firebase email must name the same Marketplace account."""
    from fastapi import HTTPException
    from auth.services import enroll_firebase_email_identity

    repo = AsyncMock()
    with pytest.raises(HTTPException, match="does not match"):
        await enroll_firebase_email_identity(
            {"sub": "firebase-subject", "email": "other@example.com"},
            {"id": "12345678-1234-5678-1234-567812345678", "email": "buyer@example.com"},
            repo,
        )
    repo.link_external_identity.assert_not_awaited()


@pytest.mark.asyncio
async def test_firebase_phone_only_identity_must_be_linked_to_email_first():
    """Phone-only tokens never create a Marketplace identity."""
    from fastapi import HTTPException
    from auth.services import exchange_firebase_identity

    repo = AsyncMock()
    repo.get_by_external_identity.return_value = None

    with pytest.raises(HTTPException, match="Link a verified email"):
        await exchange_firebase_identity({"sub": "phone-subject"}, repo)
    repo.create_identity.assert_not_awaited()


@pytest.mark.asyncio
async def test_complete_unified_registration_flow():
    """Verify complete registration enforces email verification, phone verification, and identity creation."""
    from auth.services import complete_unified_registration
    mock_repo = AsyncMock()
    mock_repo.get_by_email.return_value = None
    mock_repo.create_identity.return_value = {
        "id": "12345678-1234-5678-1234-567812345678",
        "email": "brandnew@example.com",
        "name": "Manual User Name",
        "role": "buyer",
        "coin_balance": 20,
        "is_active": True,
        "is_email_verified": True,
        "auth_provider": "password",
        "created_at": "2026-08-18T12:00:00Z",
    }

    with patch("auth.services.verify_email_otp_challenge", return_value=(True, "Verified")), \
         patch("auth.services.verify_phone_otp_challenge", return_value=(True, "Verified")), \
         patch("auth.services.transaction") as mock_tx:
        mock_ctx = AsyncMock()
        mock_tx.return_value.__aenter__.return_value = mock_ctx
        user = await complete_unified_registration(
            email="brandnew@example.com",
            name="Manual User Name",
            password="SecurePassword123!",
            phone="9876543210",
            email_otp="123456",
            phone_otp="654321",
            platform="web",
            repo=mock_repo,
        )
        assert user["name"] == "Manual User Name"
        assert user["email"] == "brandnew@example.com"
        mock_repo.create_identity.assert_called_once()


@pytest.mark.asyncio
async def test_complete_registration_accepts_phone_claim_after_email_link():
    """A signed Firebase token can retain a verified phone after password linking."""
    from auth.services import complete_unified_registration

    repo = AsyncMock()
    repo.get_by_email.return_value = None
    repo.create_identity.return_value = {
        "id": "12345678-1234-5678-1234-567812345678",
        "email": "linked@example.com",
        "name": "Linked User",
        "role": "buyer",
        "coin_balance": 20,
        "is_active": True,
        "is_email_verified": True,
        "auth_provider": "firebase",
        "created_at": "2026-08-19T12:00:00Z",
    }

    with patch("auth.services._recent_phone_verification", return_value=False), \
         patch("auth.services.verify_phone_otp_challenge") as verify_phone, \
         patch("auth.services.transaction") as mock_tx:
        mock_tx.return_value.__aenter__.return_value = AsyncMock()
        user = await complete_unified_registration(
            email="linked@example.com",
            name="Linked User",
            password="SecurePassword123!",
            phone="9876543210",
            google_verified=True,
            firebase_provider="password",
            firebase_phone_verified=True,
            platform="web",
            repo=repo,
        )

    assert user["email"] == "linked@example.com"
    verify_phone.assert_not_awaited()
