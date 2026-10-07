import pytest
from unittest.mock import AsyncMock, patch

from shared.sms.models import SmsSendResult
from shared.sms.base import BaseSmsProvider
from shared.sms.providers.smscountry import SMSCountryProvider
from shared.sms.service import SmsService
from shared.sms.otp import create_phone_otp_challenge, verify_phone_otp_challenge


class MockExhaustedProvider(BaseSmsProvider):
    @property
    def provider_name(self) -> str:
        return "mock_exhausted"

    async def send_otp(self, phone: str, otp: str, template=None) -> SmsSendResult:
        self.mark_exhausted("Insufficient balance")
        return SmsSendResult(
            success=False,
            provider=self.provider_name,
            account_id=self.account_id,
            error="Insufficient credits",
            quota_exhausted=True,
        )

    async def send_sms(self, phone: str, message: str) -> SmsSendResult:
        return await self.send_otp(phone, "")


class MockActiveProvider(BaseSmsProvider):
    @property
    def provider_name(self) -> str:
        return "mock_active"

    async def send_otp(self, phone: str, otp: str, template=None) -> SmsSendResult:
        return SmsSendResult(
            success=True,
            provider=self.provider_name,
            account_id=self.account_id,
            message_id="mock-msg-12345",
        )

    async def send_sms(self, phone: str, message: str) -> SmsSendResult:
        return await self.send_otp(phone, "")


@pytest.mark.asyncio
async def test_sms_service_quota_failover():
    """Verify that SmsService automatically fails over to the next account when quota is exhausted."""
    service = SmsService()
    service._providers = []  # Clear defaults

    p1 = MockExhaustedProvider(account_id="account_primary", priority=1)
    p2 = MockActiveProvider(account_id="account_backup", priority=2)

    service.register_provider(p1)
    service.register_provider(p2)

    result = await service.send_otp(phone="9876543210", otp="123456")

    # Primary failed on quota, backup succeeded
    assert result.success is True
    assert result.provider == "mock_active"
    assert result.account_id == "account_backup"
    assert p1.is_exhausted is True


@pytest.mark.asyncio
async def test_smscountry_dev_simulation():
    """Verify SMSCountry provider behaves safely in test/dev environment."""
    provider = SMSCountryProvider(account_id="dev_test")
    res = await provider.send_otp("9999999999", "654321")
    assert res.success is True
    assert res.provider == "smscountry"
    assert res.account_id == "dev_test"


class MockRedisClient:
    def __init__(self):
        self.data = {}
        self.hashes = {}

    async def exists(self, key):
        return key in self.data or key in self.hashes

    async def ttl(self, key):
        return 60

    async def incr(self, key):
        self.data[key] = self.data.get(key, 0) + 1
        return self.data[key]

    async def expire(self, key, seconds):
        return True

    async def hget(self, key, field):
        return self.hashes.get(key, {}).get(field)

    def pipeline(self, transaction=True):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def hset(self, key, mapping):
        if key not in self.hashes:
            self.hashes[key] = {}
        self.hashes[key].update(mapping)

    async def set(self, key, val, ex=None):
        self.data[key] = val

    async def execute(self):
        pass

    async def eval(self, script, numkeys, key, expected_digest, max_attempts):
        actual_digest = self.hashes.get(key, {}).get("otp_digest")
        if not actual_digest:
            return [0]
        if actual_digest != expected_digest:
            return [-1, 1]
        self.hashes.pop(key, None)
        return [1]


@pytest.mark.asyncio
async def test_email_otp_lifecycle():
    """Verify create and verify email OTP challenge."""
    from shared.verification.email_otp import create_email_otp_challenge, verify_email_otp_challenge
    mock_redis = MockRedisClient()
    with patch("shared.verification.email_otp.get_redis", return_value=mock_redis), \
         patch("shared.verification.email_otp.send_otp_email", new=AsyncMock()) as mock_email:
        # Create challenge
        success, msg = await create_email_otp_challenge(
            email="test-buyer@example.com",
            purpose="test_addr",
            user_id="usr-12345",
            name="Tester",
        )
        assert success is True
        assert mock_email.called
        sent_otp = mock_email.call_args.kwargs.get("otp") or mock_email.call_args[1].get("otp") or mock_email.call_args[0][2]

        # Verify with wrong OTP
        wrong_ok, wrong_msg = await verify_email_otp_challenge(
            email="test-buyer@example.com",
            otp="000000",
            purpose="test_addr",
            user_id="usr-12345",
        )
        assert wrong_ok is False

        # Verify with correct OTP
        valid_ok, valid_msg = await verify_email_otp_challenge(
            email="test-buyer@example.com",
            otp=sent_otp,
            purpose="test_addr",
            user_id="usr-12345",
        )
        assert valid_ok is True
