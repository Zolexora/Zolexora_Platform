"""
shared/sms/models.py
────────────────────
Data models for SMS operations, OTP challenges, and multi-provider results.
"""

from typing import Optional
from pydantic import BaseModel, Field


class SmsSendResult(BaseModel):
    success: bool
    provider: str
    account_id: str
    message_id: Optional[str] = None
    error: Optional[str] = None
    quota_exhausted: bool = False
    details: dict = Field(default_factory=dict)


class PhoneOtpSendRequest(BaseModel):
    phone: str = Field(..., pattern=r"^[0-9+]{10,15}$")


class PhoneOtpVerifyRequest(BaseModel):
    phone: str = Field(..., pattern=r"^[0-9+]{10,15}$")
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^[0-9]{6}$")
