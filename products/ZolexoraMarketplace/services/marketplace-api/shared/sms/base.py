"""
shared/sms/base.py
──────────────────
Abstract base interface for SMS providers with multi-account and quota tracking.
"""

from abc import ABC, abstractmethod
from typing import Optional

from shared.sms.models import SmsSendResult


class BaseSmsProvider(ABC):
    """Abstract interface for all SMS provider integrations."""

    def __init__(self, account_id: str = "default", priority: int = 0) -> None:
        self.account_id = account_id
        self.priority = priority
        self.is_exhausted: bool = False
        self.exhausted_reason: Optional[str] = None

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the SMS provider (e.g. 'smscountry', 'twilio', 'msg91')."""
        pass

    @abstractmethod
    async def send_otp(self, phone: str, otp: str, template: Optional[str] = None) -> SmsSendResult:
        """Send a one-time password to the destination phone number."""
        pass

    @abstractmethod
    async def send_sms(self, phone: str, message: str) -> SmsSendResult:
        """Send a general SMS text message."""
        pass

    def mark_exhausted(self, reason: str) -> None:
        """Mark this account as exhausted (limit / quota reached)."""
        self.is_exhausted = True
        self.exhausted_reason = reason

    def reset_exhaustion(self) -> None:
        """Reset the exhaustion status."""
        self.is_exhausted = False
        self.exhausted_reason = None
