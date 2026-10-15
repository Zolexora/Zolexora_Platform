from app.schemas.gym_schemas import AccessVerificationIn
from app.services.turnstile_service import TurnstileEngine
from app.services.mock_data import MOCK_MEMBERS, MOCK_GATE_DEVICES

def test_turnstile_engine_granted():
    # Vikram Singhania (Active Black Iron VIP)
    req = AccessVerificationIn(
        deviceId="gate-dev-01",
        credentialType="RFID_TAG",
        credentialValue="RFID-88910-A",
        gateZone="MAIN_ENTRY",
        direction="ENTRY"
    )
    result = TurnstileEngine.verify_and_log(req)
    assert result.accessGranted is True
    assert result.decision == "GRANTED"
    assert result.memberId == "mem-001"
    assert "Vikram" in result.memberName

def test_turnstile_engine_denied_expired():
    # Dev Kapoor (Expired Bronze Pass)
    req = AccessVerificationIn(
        deviceId="gate-dev-01",
        credentialType="RFID_TAG",
        credentialValue="RFID-EXPIRED-DEV",
        gateZone="MAIN_ENTRY",
        direction="ENTRY"
    )
    result = TurnstileEngine.verify_and_log(req)
    assert result.accessGranted is False
    assert result.decision == "DENIED_EXPIRED"
    assert "expired" in result.message.lower()

def test_turnstile_engine_unknown_credential():
    req = AccessVerificationIn(
        deviceId="gate-dev-01",
        credentialType="RFID_TAG",
        credentialValue="RANDOM-UNKNOWN-CARD-9999",
        gateZone="MAIN_ENTRY",
        direction="ENTRY"
    )
    result = TurnstileEngine.verify_and_log(req)
    assert result.accessGranted is False
    assert result.decision == "DENIED_UNKNOWN_CREDENTIAL"

def test_turnstile_tier_restricted_zone():
    # Arjun Mehta has SILVER tier, trying to enter VIP Lounge
    req = AccessVerificationIn(
        deviceId="gate-dev-03",
        credentialType="RFID_TAG",
        credentialValue="RFID-10044-C",
        gateZone="VIP_LOUNGE",
        direction="ENTRY"
    )
    result = TurnstileEngine.verify_and_log(req)
    assert result.accessGranted is False
    assert result.decision == "DENIED_TIER_RESTRICTED"
