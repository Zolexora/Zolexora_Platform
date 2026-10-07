"""Typed public identity and session contracts."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _email(value: str) -> str:
    normalized = value.strip().lower()
    if len(normalized) > 320 or not _EMAIL_RE.fullmatch(normalized):
        raise ValueError("Invalid email address")
    return normalized


def _password(value: str) -> str:
    if not 8 <= len(value) <= 256 or not any(char.isdigit() for char in value):
        raise ValueError("Password must be 8-256 characters and contain a digit")
    return value


class RegisterRequest(StrictModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=8, max_length=256)
    name: str = Field(min_length=1, max_length=100)

    _normalize_email = field_validator("email")(_email)
    _validate_password = field_validator("password")(_password)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be empty")
        return value


class VerifyOtpRequest(StrictModel):
    email: str = Field(max_length=320)
    otp: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")

    _normalize_email = field_validator("email")(_email)

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        if len(value) != 6 or not value.isascii() or not value.isdigit():
            raise ValueError("OTP must be exactly 6 digits")
        return value


class ResendOtpRequest(StrictModel):
    email: str = Field(max_length=320)
    _normalize_email = field_validator("email")(_email)


class LoginRequest(StrictModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=1, max_length=256)
    _normalize_email = field_validator("email")(_email)


class PhoneLoginRequest(StrictModel):
    phone: str = Field(min_length=10, max_length=20)
    password: str = Field(min_length=1, max_length=256)


class ForgotPasswordRequest(StrictModel):
    email: str = Field(max_length=320)
    _normalize_email = field_validator("email")(_email)


class ResetPasswordRequest(StrictModel):
    token: str = Field(min_length=32, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)
    _validate_password = field_validator("new_password")(_password)


class ProfileUpdateRequest(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    picture: str | None = Field(default=None, max_length=2048)


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["buyer", "seller", "admin"]
    coin_balance: int
    is_active: bool
    is_email_verified: bool
    auth_provider: str
    picture: str | None = None
    created_at: str


class AuthResponse(BaseModel):
    user: UserPublic
    session_token: str | None = None


class OtpSentResponse(BaseModel):
    status: Literal["otp_required"] = "otp_required"
    email: str


class MessageResponse(BaseModel):
    message: str


# ── Unified Multi-Platform Auth Contracts (Web & Android) ────────────────────

class CheckEmailRequest(StrictModel):
    email: str = Field(max_length=320)
    _normalize_email = field_validator("email")(_email)


class CheckEmailResponse(BaseModel):
    exists: bool
    masked_phone: str | None = None
    auth_methods: list[str] = ["password", "otp"]


class CheckPhoneRequest(StrictModel):
    phone: str = Field(min_length=10, max_length=15)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = re.sub(r"\D", "", v)
        if len(clean) < 10:
            raise ValueError("Phone number must be at least 10 digits")
        return clean[-10:]


class CheckPhoneResponse(BaseModel):
    exists: bool
    masked_phone: str | None = None
    masked_email: str | None = None


class SendLoginOtpRequest(StrictModel):
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=15)
    channel: Literal["email", "sms"] = "email"


class VerifyLoginOtpRequest(StrictModel):
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=15)
    otp: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class GoogleAuthRequest(StrictModel):
    id_token: str | None = Field(default=None, max_length=4096)
    email: str = Field(max_length=320)
    name: str | None = Field(default=None, max_length=100)
    google_id: str | None = Field(default=None, max_length=128)

    _normalize_email = field_validator("email")(_email)


class FirebaseTokenExchangeRequest(StrictModel):
    id_token: str = Field(min_length=32, max_length=4096)
    registration_name: str | None = Field(default=None, max_length=100)
    allow_buyer_registration: bool = True

    @field_validator("registration_name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class FirebaseEmailEnrollmentRequest(StrictModel):
    """A Firebase email/password token presented by an already authenticated user."""

    id_token: str = Field(min_length=32, max_length=4096)


class GoogleAuthResponse(BaseModel):
    is_new_user: bool
    email: str
    verified: bool = True
    user: UserPublic | None = None
    session_token: str | None = None


class SendAuthOtpRequest(StrictModel):
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=15)
    channel: Literal["email", "sms"] = "email"
    purpose: str = "auth"


class VerifyAuthOtpRequest(StrictModel):
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=15)
    otp: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")
    purpose: str = "auth"


class CompleteUnifiedRegistrationRequest(StrictModel):
    email: str = Field(max_length=320)
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=256)
    phone: str = Field(min_length=10, max_length=15)
    email_otp: str | None = Field(default=None, max_length=6)
    phone_otp: str | None = Field(default=None, max_length=6)
    google_verified: bool = False
    platform: Literal["web", "android"] = "web"
    pnv_token: str | None = Field(default=None, max_length=256)
    firebase_id_token: str | None = Field(default=None, max_length=4096)

    _normalize_email = field_validator("email")(_email)
    _validate_password = field_validator("password")(_password)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Full Name must be entered manually and cannot be empty")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = re.sub(r"\D", "", v)
        if len(clean) < 10:
            raise ValueError("Phone number must be at least 10 digits")
        return clean[-10:]
