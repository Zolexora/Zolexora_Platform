"""Gateway connections: a business connects its own Razorpay or Cashfree account to IMS through the provider's
partner OAuth (the provider's own sign-in and consent screen). IMS keeps only the resulting tokens, encrypted
with IMS_ENCRYPTION_KEY, and never sees the business's API keys.

Platform values (Infisical /Zolexora_IMS), issued when Zolexora is an approved partner. A provider is offered
only when all of its values and the shared ones are set:
  Razorpay  IMS_RAZORPAY_CLIENT_ID, IMS_RAZORPAY_CLIENT_SECRET, IMS_RAZORPAY_WEBHOOK_SECRET; IMS_RAZORPAY_MODE test|live
  Cashfree  IMS_CASHFREE_PARTNER_API_KEY, IMS_CASHFREE_CLIENT_ID; IMS_CASHFREE_ENV TEST|PRODUCTION
  Shared    IMS_ENCRYPTION_KEY (base64 of 32 random bytes), IMS_PUBLIC_URL (the web app's public URL, no trailing /)

Written from the providers' partner docs and tested against fakes only. Lines marked VERIFY must be checked
against each provider's sandbox before the Connect buttons are offered to businesses.
"""
import base64
import json
import os
import secrets
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

try:
    from .payments import PaymentError
except ImportError:
    from payments import PaymentError


class ConnectionRejected(PaymentError):
    """The provider refused the code or token (revoked, expired): the business must connect again."""


def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def public_url() -> str:
    return _env("IMS_PUBLIC_URL").rstrip("/")


def callback_url(provider: str) -> str:
    return f"{public_url()}/api/v1/payment/connections/{provider}/callback"


# --- Token encryption (AES-256-GCM, bound to the business and provider) ---------------------------------------
def _key() -> bytes:
    key = base64.b64decode(_env("IMS_ENCRYPTION_KEY") or "")
    if len(key) != 32:
        raise PaymentError(503, "IMS_ENCRYPTION_KEY must be base64 of 32 bytes (Infisical /Zolexora_IMS).")
    return key


def seal(data: Dict[str, Any], org_id: str, provider: str) -> str:
    nonce = secrets.token_bytes(12)
    ct = AESGCM(_key()).encrypt(nonce, json.dumps(data).encode(), f"{org_id}:{provider}".encode())
    return "v1." + base64.urlsafe_b64encode(nonce + ct).decode()


def unseal(token: str, org_id: str, provider: str) -> Dict[str, Any]:
    raw = base64.urlsafe_b64decode(token.split(".", 1)[1])
    return json.loads(AESGCM(_key()).decrypt(raw[:12], raw[12:], f"{org_id}:{provider}".encode()))


# --- HTTP ------------------------------------------------------------------------------------------------------
async def _post(url: str, **kw) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(url, **kw)
    except httpx.HTTPError as e:
        raise PaymentError(502, "Payment provider unreachable") from e
    data = res.json() if res.content else {}
    if res.status_code in (400, 401, 403):
        raise ConnectionRejected(400, "The payment provider refused the connection; connect the account again.")
    if res.status_code >= 400:
        raise PaymentError(502, f"Payment provider error (HTTP {res.status_code})")
    return data


# --- Providers -------------------------------------------------------------------------------------------------
# Each returns tokens as {"access_token", "refresh_token", "expires_in", "account_id", ...}.
class Razorpay:
    name = "Razorpay"
    AUTH = "https://auth.razorpay.com"

    def available(self) -> bool:
        return all(_env(k) for k in ("IMS_RAZORPAY_CLIENT_ID", "IMS_RAZORPAY_CLIENT_SECRET", "IMS_RAZORPAY_WEBHOOK_SECRET",
                                     "IMS_ENCRYPTION_KEY", "IMS_PUBLIC_URL"))

    def _client(self) -> Dict[str, str]:
        return {"client_id": _env("IMS_RAZORPAY_CLIENT_ID"), "client_secret": _env("IMS_RAZORPAY_CLIENT_SECRET")}

    async def authorize_url(self, state: str) -> str:
        return f"{self.AUTH}/authorize?" + urlencode({
            "client_id": _env("IMS_RAZORPAY_CLIENT_ID"), "response_type": "code",
            "redirect_uri": callback_url("razorpay"), "scope": "read_write", "state": state})

    def _tokens(self, data: Dict[str, Any], account_id: Optional[str] = None) -> Dict[str, Any]:
        return {"access_token": data["access_token"], "refresh_token": data["refresh_token"],
                "public_token": data.get("public_token"), "expires_in": int(data.get("expires_in") or 0),
                "account_id": data.get("razorpay_account_id") or account_id}

    async def exchange(self, code: str, params: Dict[str, str]) -> Dict[str, Any]:
        data = await _post(f"{self.AUTH}/token", json={
            **self._client(), "grant_type": "authorization_code", "redirect_uri": callback_url("razorpay"),
            "code": code, "mode": _env("IMS_RAZORPAY_MODE") or "live"})
        return self._tokens(data)

    async def refresh(self, tokens: Dict[str, Any]) -> Dict[str, Any]:
        data = await _post(f"{self.AUTH}/token", json={
            **self._client(), "grant_type": "refresh_token", "refresh_token": tokens["refresh_token"]})
        return self._tokens(data, tokens.get("account_id"))  # VERIFY: refresh response repeats public_token

    async def revoke(self, tokens: Dict[str, Any]) -> None:
        for hint in ("access_token", "refresh_token"):
            await _post(f"{self.AUTH}/revoke", json={**self._client(), "token_type_hint": hint, "token": tokens[hint]})

    def engine_config(self, tokens: Dict[str, Any]) -> Dict[str, Any]:
        # VERIFY: Razorpay's OAuth docs sign checkout payments with the app's client_secret.
        return {"razorpay_access_token": tokens["access_token"], "razorpay_public_token": tokens.get("public_token"),
                "razorpay_signing_secret": _env("IMS_RAZORPAY_CLIENT_SECRET")}


class Cashfree:
    name = "Cashfree"
    API = {"TEST": "https://api-sandbox.cashfree.com", "PRODUCTION": "https://api.cashfree.com"}

    def available(self) -> bool:
        return all(_env(k) for k in ("IMS_CASHFREE_PARTNER_API_KEY", "IMS_CASHFREE_CLIENT_ID", "IMS_ENCRYPTION_KEY", "IMS_PUBLIC_URL"))

    @staticmethod
    def env() -> str:
        return "PRODUCTION" if _env("IMS_CASHFREE_ENV").upper() == "PRODUCTION" else "TEST"

    def _base(self) -> str:
        return f"{self.API[self.env()]}/partners/oauth"

    def _headers(self) -> Dict[str, str]:
        return {"x-partner-apikey": _env("IMS_CASHFREE_PARTNER_API_KEY"), "oauth-client-id": _env("IMS_CASHFREE_CLIENT_ID")}

    async def authorize_url(self, state: str) -> str:
        # The redirect URL is set in the Cashfree partner dashboard: callback_url("cashfree").
        data = await _post(f"{self._base()}/auth_link", headers=self._headers(),
                           json={"response_type": "code", "scope": "read_write", "state": state})
        return data["auth_link"]

    def _tokens(self, data: Dict[str, Any], account_id: Optional[str] = None) -> Dict[str, Any]:
        return {"access_token": data["access_token"], "refresh_token": data["refresh_token"],
                "expires_in": int(data.get("expires_in") or 0), "account_id": data.get("merchant_id") or account_id}

    async def exchange(self, code: str, params: Dict[str, str]) -> Dict[str, Any]:
        data = await _post(f"{self._base()}/token", headers=self._headers(), json={"grant_type": "authorization_code", "code": code})
        return self._tokens(data, params.get("merchant_id"))

    async def refresh(self, tokens: Dict[str, Any]) -> Dict[str, Any]:
        # The old refresh token stops working the moment this succeeds: the caller stores the new one at once.
        data = await _post(f"{self._base()}/token", headers=self._headers(),
                           json={"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"]})
        return self._tokens(data, tokens.get("account_id"))

    async def revoke(self, tokens: Dict[str, Any]) -> None:
        await _post(f"{self._base()}/{tokens['account_id']}/revoke", headers=self._headers())

    def engine_config(self, tokens: Dict[str, Any]) -> Dict[str, Any]:
        return {"cashfree_access_token": tokens["access_token"], "cashfree_env": self.env()}


PROVIDERS = {"razorpay": Razorpay(), "cashfree": Cashfree()}
