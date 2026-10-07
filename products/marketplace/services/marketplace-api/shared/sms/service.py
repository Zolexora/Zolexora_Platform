"""
shared/sms/service.py
─────────────────────
Multi-provider, multi-account SMS orchestrator with automatic quota failover.
"""

import os
import logging
from typing import List, Optional

from shared.sms.base import BaseSmsProvider
from shared.sms.models import SmsSendResult
from shared.sms.providers.smscountry import SMSCountryProvider

logger = logging.getLogger("zolexora.sms.service")


class SmsService:
    """
    Central SMS Dispatcher supporting multiple accounts and automatic quota failover.
    """

    def __init__(self) -> None:
        self._providers: List[BaseSmsProvider] = []
        self._init_default_providers()

    def register_provider(self, provider: BaseSmsProvider) -> None:
        """Register an SMS provider/account in priority order."""
        self._providers.append(provider)
        self._providers.sort(key=lambda p: p.priority)

    def _init_default_providers(self) -> None:
        """Initialize provider accounts from environment variables dynamically."""
        # 1. Primary SMSCountry account
        key_1 = os.environ.get("SMSCOUNTRY_AUTH_KEY", "")
        token_1 = os.environ.get("SMSCOUNTRY_AUTH_TOKEN", "")
        sender_1 = os.environ.get("SMSCOUNTRY_SENDER_ID", "ZOLEXA")

        self.register_provider(
            SMSCountryProvider(
                account_id="smscountry_primary",
                auth_key=key_1,
                auth_token=token_1,
                sender_id=sender_1,
                priority=1,
            )
        )

        # 2. Dynamic discovery of tagged SMSCountry accounts (e.g. A1, A2, BACKUP)
        prio = 2
        for key, val in sorted(os.environ.items()):
            if not val or not key.endswith("_AUTH_KEY"):
                continue
            if key == "SMSCOUNTRY_AUTH_KEY":
                continue
            if key.startswith("SMSCOUNTRY_"):
                prefix = key[:-len("_AUTH_KEY")]
                token_k = f"{prefix}_AUTH_TOKEN"
                sender_k = f"{prefix}_SENDER_ID"
                auth_token = os.environ.get(token_k, "")
                sender_id = os.environ.get(sender_k, sender_1)
                tag = prefix.replace("SMSCOUNTRY_", "").lower()
                account_id = f"smscountry_{tag}"

                self.register_provider(
                    SMSCountryProvider(
                        account_id=account_id,
                        auth_key=val,
                        auth_token=auth_token,
                        sender_id=sender_id,
                        priority=prio,
                    )
                )
                prio += 1

    async def send_otp(self, phone: str, otp: str, template: Optional[str] = None) -> SmsSendResult:
        """
        Send an OTP with automatic quota/limit failover across configured accounts.
        """
        last_result: Optional[SmsSendResult] = None

        # Filter unexhausted accounts
        available_providers = [p for p in self._providers if not p.is_exhausted]

        # If all accounts are marked exhausted, reset them in case quota was topped up
        if not available_providers and self._providers:
            logger.info("All SMS accounts marked exhausted; resetting pool for retry")
            for p in self._providers:
                p.reset_exhaustion()
            available_providers = list(self._providers)

        for provider in available_providers:
            logger.info(
                "Dispatching OTP to %s via [%s:%s]",
                phone,
                provider.provider_name,
                provider.account_id,
            )
            result = await provider.send_otp(phone=phone, otp=otp, template=template)

            if result.success:
                return result

            last_result = result

            if result.quota_exhausted:
                logger.warning(
                    "SMS Account [%s:%s] quota exhausted! Failing over to next account...",
                    provider.provider_name,
                    provider.account_id,
                )
                continue  # Try next provider in pool

            # If general failure, still attempt next provider
            logger.warning(
                "SMS send failed on [%s:%s]: %s. Attempting fallback...",
                provider.provider_name,
                provider.account_id,
                result.error,
            )

        return last_result or SmsSendResult(
            success=False,
            provider="none",
            account_id="none",
            error="No available SMS provider accounts",
        )


_sms_service_instance: Optional[SmsService] = None


def get_sms_service() -> SmsService:
    global _sms_service_instance
    if _sms_service_instance is None:
        _sms_service_instance = SmsService()
    return _sms_service_instance
