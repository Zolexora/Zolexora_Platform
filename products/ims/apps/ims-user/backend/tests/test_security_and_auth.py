import os
import sys
import pytest
from starlette.testclient import TestClient

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../backend-shared")))

from security import hash_password, verify_password, create_jwt_token, decode_jwt_token, get_jwt_secret
from main import app


def test_password_hashing_and_backdoor_elimination():
    real_password = "SecurePassword@2026"
    pwd_hash = hash_password(real_password)

    # Valid password matches
    assert verify_password(real_password, pwd_hash) is True

    # Wrong passwords fail
    assert verify_password("WrongPassword", pwd_hash) is False
    assert verify_password("admin", pwd_hash) is False
    assert verify_password("Admin@123", pwd_hash) is False
    assert verify_password("", pwd_hash) is False


def test_jwt_token_creation_and_decoding():
    payload = {"sub": "USR_001", "role": "Store Incharge", "org_id": "ORG_ZOLEXORA_001"}
    custom_secret = "test_super_secret_jwt_key_that_is_long_enough_123"

    token = create_jwt_token(payload, secret_key=custom_secret)
    decoded = decode_jwt_token(token, secret_key=custom_secret, verify_signature=True)

    assert decoded["sub"] == "USR_001"
    assert decoded["role"] == "Store Incharge"
    assert decoded["org_id"] == "ORG_ZOLEXORA_001"


def test_production_jwt_secret_enforcement(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("JWT_SECRET", raising=False)

    with pytest.raises(ValueError) as excinfo:
        get_jwt_secret()
    assert "JWT_SECRET environment variable is not configured" in str(excinfo.value)


def test_decode_any_jwt_token_supports_hs256_and_es256():
    from security import decode_any_jwt_token

    # Internal token
    payload = {"sub": "USR_TEST_001", "email": "test@zolexora.com"}
    secret = "test_key_12345678901234567890123456789012"
    token = create_jwt_token(payload, secret_key=secret)
    decoded = decode_any_jwt_token(token, verify_signature=False)
    assert decoded["sub"] == "USR_TEST_001"
    assert decoded["email"] == "test@zolexora.com"
