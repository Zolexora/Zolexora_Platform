"""Verification of Firebase-issued identity tokens.

Firebase is an identity provider only. Marketplace roles and sessions remain
server-authoritative and are never read from client-controlled token claims.
"""

import asyncio
from typing import Any

from fastapi import HTTPException
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token

from core.config import settings

_google_request = GoogleRequest()


def _verify(token: str) -> dict[str, Any]:
    if not settings.FIREBASE_PROJECT_ID:
        raise HTTPException(503, "Firebase authentication is not configured")
    try:
        claims = id_token.verify_firebase_token(
            token,
            _google_request,
            audience=settings.FIREBASE_PROJECT_ID,
        )
    except Exception as exc:
        raise HTTPException(401, "Invalid Firebase identity token") from exc

    subject = claims.get("uid") or claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(401, "Firebase identity token has no subject")
    return claims


async def verify_firebase_token(token: str) -> dict[str, Any]:
    """Validate signature, issuer, audience and expiry using Firebase keys."""
    return await asyncio.to_thread(_verify, token)
