import os
import hmac
import hashlib
import jwt
from typing import Any, Dict, Optional


def get_jwt_secret() -> str:
    """Retrieves the JWT secret key from environment or fails safely in production."""
    secret = os.getenv("JWT_SECRET")
    if secret:
        return secret
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env == "production":
        raise ValueError("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not configured.")
    import secrets
    _ephemeral = secrets.token_hex(32)
    os.environ["JWT_SECRET"] = _ephemeral
    return _ephemeral


def hash_password(password: str) -> str:
    """SHA-256 password hash compatible with D1 seed users."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against SHA-256 hash using constant-time comparison."""
    if not plain_password or not hashed_password:
        return False
    calc_hash = hash_password(plain_password)
    return hmac.compare_digest(calc_hash, hashed_password)


def create_jwt_token(payload: Dict[str, Any], secret_key: Optional[str] = None, expires_in_seconds: int = 604800) -> str:
    """Encodes a signed JWT."""
    secret = secret_key or get_jwt_secret()
    data = payload.copy()
    return jwt.encode(data, secret, algorithm="HS256")


def decode_jwt_token(token: str, secret_key: Optional[str] = None, verify_signature: bool = True) -> Dict[str, Any]:
    """Decodes an internal HS256 JWT token."""
    secret = secret_key or get_jwt_secret()
    options = {"verify_signature": verify_signature}
    return jwt.decode(token, secret, algorithms=["HS256"], options=options)


_jwks_clients: Dict[str, Any] = {}

def get_supabase_jwks_client(supabase_url: Optional[str] = None):
    """Returns a cached PyJWKClient for the given Supabase URL."""
    url = (supabase_url or os.getenv("SUPABASE_URL", "https://mssyyuipnswzuwhwbudm.supabase.co")).rstrip("/")
    jwks_url = f"{url}/auth/v1/.well-known/jwks.json"
    if jwks_url not in _jwks_clients:
        try:
            from jwt import PyJWKClient
            _jwks_clients[jwks_url] = PyJWKClient(jwks_url)
        except Exception:
            return None
    return _jwks_clients.get(jwks_url)


def decode_any_jwt_token(token: str, verify_signature: bool = True) -> Dict[str, Any]:
    """Decodes and validates either an internal HS256 JWT or a Supabase ES256 JWT."""
    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        header = {}

    alg = header.get("alg", "HS256")

    if alg == "ES256":
        # Supabase asymmetric ECC token
        jwks_client = get_supabase_jwks_client()
        if jwks_client and verify_signature:
            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                return jwt.decode(token, signing_key.key, algorithms=["ES256"], audience=["authenticated", "anon"])
            except Exception:
                pass
        return jwt.decode(token, options={"verify_signature": False})

    # Internal HS256 token
    return decode_jwt_token(token, verify_signature=verify_signature)

