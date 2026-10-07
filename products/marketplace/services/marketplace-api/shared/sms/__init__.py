"""
shared/sms package
──────────────────
Multi-account SMS provider orchestrator, SMSCountry adapter, and Phone OTP verification.
"""

from shared.sms.base import BaseSmsProvider
from shared.sms.models import SmsSendResult, PhoneOtpSendRequest, PhoneOtpVerifyRequest
from shared.sms.providers.smscountry import SMSCountryProvider
from shared.sms.service import SmsService, get_sms_service
from shared.sms.otp import create_phone_otp_challenge, verify_phone_otp_challenge

__all__ = [
    "BaseSmsProvider",
    "SmsSendResult",
    "PhoneOtpSendRequest",
    "PhoneOtpVerifyRequest",
    "SMSCountryProvider",
    "SmsService",
    "get_sms_service",
    "create_phone_otp_challenge",
    "verify_phone_otp_challenge",
]
