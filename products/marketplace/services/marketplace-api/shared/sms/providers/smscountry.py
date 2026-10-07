"""
shared/sms/providers/smscountry.py
──────────────────────────────────
SMSCountry provider implementation with multi-account support and quota exhaustion detection.
"""

import base64
import logging
from typing import Optional
import httpx

from core.config import settings
from shared.sms.base import BaseSmsProvider
from shared.sms.models import SmsSendResult

logger = logging.getLogger("zolexora.sms.smscountry")

_QUOTA_EXHAUSTED_KEYWORDS = (
    "insufficient",
    "balance",
    "credit",
    "limit exceeded",
    "quota",
    "exhausted",
    "out of funds",
)


class SMSCountryProvider(BaseSmsProvider):
    """
    SMSCountry HTTP REST API Provider.
    Supports multiple distinct accounts/keys for quota failover.
    """

    def __init__(
        self,
        account_id: str = "smscountry_primary",
        auth_key: str = "",
        auth_token: str = "",
        sender_id: str = "ZOLEXA",
        api_base_url: str = "https://restapi.smscountry.com/v0.1",
        priority: int = 0,
    ) -> None:
        super().__init__(account_id=account_id, priority=priority)
        self.auth_key = auth_key
        self.auth_token = auth_token
        self.sender_id = sender_id
        self.api_base_url = api_base_url.rstrip("/")

    @property
    def provider_name(self) -> str:
        return "smscountry"

    def _is_live_configured(self) -> bool:
        return bool(self.auth_key and self.auth_token and not self.auth_key.startswith("replace-"))

    async def send_otp(self, phone: str, otp: str, template: Optional[str] = None) -> SmsSendResult:
        """Deliver OTP via SMSCountry."""
        msg = template.format(otp=otp) if template else f"Your Zolexora verification OTP is {otp}. Valid for 5 minutes. Do not share this code."
        return await self.send_sms(phone=phone, message=msg)

    async def send_sms(self, phone: str, message: str) -> SmsSendResult:
        """Send an SMS via SMSCountry REST API."""
        if not self._is_live_configured():
            if str(settings.APP_ENV).lower() in {"dev", "development", "local", "test"}:
                logger.info(
                    "[DEV SMSCountry %s] phone=%s message=%s",
                    self.account_id,
                    phone,
                    message,
                )
                return SmsSendResult(
                    success=True,
                    provider=self.provider_name,
                    account_id=self.account_id,
                    message_id=f"dev-mock-{self.account_id}",
                    details={"mode": "simulated_dev"},
                )
            return SmsSendResult(
                success=False,
                provider=self.provider_name,
                account_id=self.account_id,
                error="SMSCountry credentials not configured",
            )

        # Normalize phone number (strip whitespace and +)
        dest_number = phone.strip().lstrip("+")
        url = f"{self.api_base_url}/Accounts/{self.auth_key}/SMSes/"
        auth_header = base64.b64encode(f"{self.auth_key}:{self.auth_token}".encode()).decode("utf-8")
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/json",
        }
        payload = {
            "Text": message,
            "Number": dest_number,
            "SenderId": self.sender_id,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                
                # Check for rate limit or quota exhaustion status codes
                if res.status_code in {402, 429}:
                    err_msg = f"HTTP {res.status_code} - Quota exhausted or payment required"
                    self.mark_exhausted(err_msg)
                    logger.warning("[SMSCountry %s] Quota exhausted: %s", self.account_id, err_msg)
                    return SmsSendResult(
                        success=False,
                        provider=self.provider_name,
                        account_id=self.account_id,
                        error=err_msg,
                        quota_exhausted=True,
                    )

                body = res.json() if res.headers.get("content-type", "").startswith("application/json") else {"raw": res.text}
                
                if res.is_success:
                    msg_id = body.get("MessageUUID") or body.get("Success", {}).get("MessageUUID") if isinstance(body, dict) else None
                    return SmsSendResult(
                        success=True,
                        provider=self.provider_name,
                        account_id=self.account_id,
                        message_id=msg_id or "delivered",
                        details=body if isinstance(body, dict) else {},
                    )

                # Inspect error message for quota indicators
                err_text = str(body).lower()
                is_quota = any(kw in err_text for kw in _QUOTA_EXHAUSTED_KEYWORDS)
                if is_quota:
                    self.mark_exhausted(str(body))
                    logger.warning("[SMSCountry %s] Quota/Balance exhausted: %s", self.account_id, body)
                    return SmsSendResult(
                        success=False,
                        provider=self.provider_name,
                        account_id=self.account_id,
                        error=str(body),
                        quota_exhausted=True,
                    )

                return SmsSendResult(
                    success=False,
                    provider=self.provider_name,
                    account_id=self.account_id,
                    error=f"SMSCountry send failed (HTTP {res.status_code}): {body}",
                )

        except Exception as exc:
            logger.error("[SMSCountry %s] Network exception: %s", self.account_id, exc)
            return SmsSendResult(
                success=False,
                provider=self.provider_name,
                account_id=self.account_id,
                error=f"SMSCountry network error: {exc}",
            )
