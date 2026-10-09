import os
import sys
from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../backend-shared")))
try:
    from security import decode_jwt_token
except ImportError:
    import jwt
    import secrets
    _EPHEMERAL_ADMIN_JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_hex(32)
    def decode_jwt_token(token, secret_key=None, verify_signature=False):
        secret = secret_key or os.getenv("JWT_SECRET") or _EPHEMERAL_ADMIN_JWT_SECRET
        return jwt.decode(token, secret, algorithms=["HS256"], options={"verify_signature": verify_signature})

security = HTTPBearer(auto_error=False)


async def require_superadmin(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    """Verifies that the caller has genuine SuperAdmin or PlatformAdmin permissions."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SuperAdmin authorization required"
        )

    token = credentials.credentials
    try:
        # Cryptographic signature verification is strictly enforced
        payload = decode_jwt_token(token, verify_signature=True)
        role = payload.get("role")
        if role not in ("SuperAdmin", "PlatformAdmin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient administrative privileges"
            )
        superadmin_email = os.getenv("SUPERADMIN_EMAIL", "")
        return {
            "id": payload.get("sub") or payload.get("user_id"),
            "role": role,
            "email": payload.get("email") or superadmin_email,
            "name": payload.get("name", "Administrator")
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrative session or token"
        )

