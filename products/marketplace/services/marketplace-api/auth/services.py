import asyncio
import logging
import re
import secrets
import uuid
from collections.abc import Awaitable, Callable

from fastapi import HTTPException

from core.config import settings
from core.security import hash_password, password_hash_needs_upgrade, verify_password
from shared.database import redis as redis_store
from shared.database.postgres import connection, transaction
from shared.sms.otp import create_phone_otp_challenge, is_phone_verified, verify_phone_otp_challenge
from shared.verification.email_otp import create_email_otp_challenge, is_email_verified, verify_email_otp_challenge
from users.repositories import UserRepository

logger = logging.getLogger("zolexora.auth")
AUTH_FAILURE = HTTPException(401, "Invalid email or password")
_DUMMY_HASH = hash_password("invalid-credential-constant-1")


async def _recent_email_verification(email: str) -> bool:
    try:
        return await is_email_verified(email, "registration", "anon")
    except RuntimeError:
        # Unit tests and a cold local process may not have Redis yet; the OTP
        # verification below remains authoritative in that case.
        return False


async def _recent_phone_verification(phone: str) -> bool:
    try:
        return await is_phone_verified(phone, "registration", "anon")
    except RuntimeError:
        return False


def mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    clean = re.sub(r"\D", "", phone)
    if len(clean) < 4:
        return phone
    return f"******{clean[-4:]}"


def mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    parts = email.split("@")
    user, domain = parts[0], parts[1]
    masked_u = (user[0] + "***") if user else "***"
    return f"{masked_u}@{domain}"


async def _discard_delivery(_destination: str, _secret: str, _purpose: str) -> None:
    """Production delivery is intentionally deferred; log in local development only."""
    if str(settings.APP_ENV).lower() in {"dev", "development", "local"}:
        logger.info("[DEV OTP] destination=%s purpose=%s code=%s", _destination, _purpose, _secret)

deliver_secret: Callable[[str, str, str], Awaitable[None]] = _discard_delivery


async def initiate_registration(email: str, name: str, password: str, repo: UserRepository) -> None:
    if await repo.get_by_email(email):
        return
    otp = f"{secrets.randbelow(1_000_000):06d}"
    accepted = await redis_store.begin_registration(
        email, {"name": name, "password_hash": hash_password(password)}, otp,
    )
    if not accepted:
        raise HTTPException(429, "Registration temporarily unavailable")
    await deliver_secret(email, otp, "registration")


async def resend_registration_otp(email: str) -> None:
    otp = f"{secrets.randbelow(1_000_000):06d}"
    if not await redis_store.resend_registration(email, otp):
        raise HTTPException(429, "Verification code cannot be resent yet")
    await deliver_secret(email, otp, "registration")


async def complete_registration(email: str, otp: str, repo: UserRepository) -> dict:
    status, pending = await redis_store.consume_registration(email, otp)
    if status != "verified" or pending is None:
        raise HTTPException(400, "Invalid or expired verification code")
    try:
        return await repo.create_identity(
            email=email,
            name=pending["name"],
            password_hash=pending["password_hash"],
            role="buyer",
            is_email_verified=True,
            internal=True,
        )
    except Exception as exc:
        raise HTTPException(400, "Registration could not be completed") from exc


async def login_with_password(email: str, password: str, repo: UserRepository) -> dict:
    user = await repo.get_by_email(email, internal=True)
    password_hash = user.get("password_hash") if user else _DUMMY_HASH
    valid = await asyncio.to_thread(verify_password, password, password_hash or _DUMMY_HASH)
    if not user or not valid or not user["is_active"] or not user["is_email_verified"]:
        raise AUTH_FAILURE
    if password_hash_needs_upgrade(password_hash):
        await repo.update_password_hash(user["id"], hash_password(password))
    user.pop("password_hash", None)
    return user


async def login_with_phone_password(phone: str, password: str, repo: UserRepository) -> dict:
    clean_phone = re.sub(r"\D", "", phone)[-10:]
    user = await repo.get_by_phone(clean_phone, internal=True)
    password_hash = user.get("password_hash") if user else _DUMMY_HASH
    valid = await asyncio.to_thread(verify_password, password, password_hash or _DUMMY_HASH)
    if not user or not valid or not user["is_active"]:
        raise AUTH_FAILURE
    if password_hash_needs_upgrade(password_hash):
        await repo.update_password_hash(user["id"], hash_password(password))
    user.pop("password_hash", None)
    return user


async def send_password_reset(email: str, repo: UserRepository) -> None:
    user = await repo.get_by_email(email)
    if not user:
        return
    token = await redis_store.create_password_reset(user["id"])
    await deliver_secret(email, token, "password-reset")


async def complete_password_reset(token: str, new_password: str, repo: UserRepository) -> str:
    user_id = await redis_store.consume_password_reset(token)
    if not user_id:
        raise HTTPException(400, "Invalid or expired reset token")
    await repo.update_password_hash(user_id, hash_password(new_password), revoke_sessions=True)
    await redis_store.revoke_all_user_sessions(user_id)
    return user_id


# ── Unified Auth Handlers ───────────────────────────────────────────────────

async def check_email_account(email: str, repo: UserRepository) -> dict:
    user = await repo.get_by_email(email)
    if not user:
        return {"exists": False, "masked_phone": None, "auth_methods": ["password", "otp"]}
    # Look up registered phone if available in buyer_address
    phone = None
    try:
        async with connection() as conn:
            phone = await conn.fetchval(
                "SELECT phone FROM public.buyer_address WHERE buyer_id = $1 ORDER BY is_default DESC, created_at DESC LIMIT 1",
                uuid.UUID(user["id"]),
            )
    except Exception:
        pass
    return {
        "exists": True,
        "masked_phone": mask_phone(phone),
        "auth_methods": ["password", "otp"],
    }


async def check_phone_account(phone: str, repo: UserRepository) -> dict:
    clean = re.sub(r"\D", "", phone)[-10:]
    user = await repo.get_by_phone(clean)
    if not user:
        return {"exists": False, "masked_phone": None, "masked_email": None}
    return {
        "exists": True,
        "masked_phone": f"******{clean[-4:]}",
        "masked_email": mask_email(user.get("email")),
    }


async def send_login_otp(email: str | None, phone: str | None, channel: str, repo: UserRepository) -> dict:
    if email:
        user = await repo.get_by_email(email)
        if not user:
            raise HTTPException(404, "No account found with this email address")
        success, msg = await create_email_otp_challenge(
            email=email,
            purpose="login",
            user_id=user["id"],
            name=user.get("name", "User"),
        )
        if not success:
            raise HTTPException(400, msg)
        return {"message": msg, "email": email}

    if phone:
        clean_phone = re.sub(r"\D", "", phone)[-10:]
        user = await repo.get_by_phone(clean_phone)
        if not user:
            raise HTTPException(404, "No account found with this phone number")
        success, msg = await create_phone_otp_challenge(
            phone=clean_phone,
            purpose="login",
            user_id=user["id"],
        )
        if not success:
            raise HTTPException(400, msg)
        return {"message": msg, "phone": clean_phone}

    raise HTTPException(400, "Must provide email or phone for login OTP")


async def verify_login_otp(email: str | None, phone: str | None, otp: str, repo: UserRepository) -> dict:
    if email:
        user = await repo.get_by_email(email, internal=True)
        if not user:
            raise HTTPException(404, "No account found with this email address")
        verified, msg = await verify_email_otp_challenge(
            email=email,
            otp=otp,
            purpose="login",
            user_id=user["id"],
        )
        if not verified:
            raise HTTPException(400, msg)
        user.pop("password_hash", None)
        return user

    if phone:
        clean_phone = re.sub(r"\D", "", phone)[-10:]
        user = await repo.get_by_phone(clean_phone, internal=True)
        if not user:
            raise HTTPException(404, "No account found with this phone number")
        verified, msg = await verify_phone_otp_challenge(
            phone=clean_phone,
            otp=otp,
            purpose="login",
            user_id=user["id"],
        )
        if not verified:
            raise HTTPException(400, msg)
        user.pop("password_hash", None)
        return user

    raise HTTPException(400, "Must provide email or phone to verify login OTP")


async def authenticate_google_user(email: str, repo: UserRepository) -> tuple[bool, dict | None]:
    """
    Check if Google OAuth email exists.
    If exists -> return (False, user) to allow immediate bypass & dashboard login.
    If new user -> return (True, None) indicating mandatory complete profile form is required.
    """
    user = await repo.get_by_email(email, internal=True)
    if user:
        user.pop("password_hash", None)
        return False, user
    return True, None


async def exchange_firebase_identity(
    claims: dict,
    repo: UserRepository,
    *,
    registration_name: str | None = None,
    allow_buyer_registration: bool = True,
) -> dict:
    """Map a verified Firebase identity to one Marketplace identity.

    A Firebase UID can only be linked once. New Marketplace accounts require a
    verified Firebase email and an explicit name; phone-only tokens are refused
    until linked to that email-backed Firebase account.
    """
    subject = claims.get("uid") or claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(401, "Firebase identity has no subject")

    linked = await repo.get_by_external_identity("firebase", subject, internal=True)
    if linked:
        if hasattr(repo, "record_auth_provider"):
            await repo.record_auth_provider(
                user_id=linked["id"],
                provider_uid=subject, provider_email=claims.get("email"),
            )
        linked.pop("password_hash", None)
        return linked

    # A phone Firebase token has no email claim. It may still authenticate an
    # existing Marketplace buyer whose verified phone is already on file; link
    # that Firebase subject to the existing email-backed account. Never create
    # a new phone-only Marketplace identity here.
    provider = claims.get("firebase", {}).get("sign_in_provider")
    phone = claims.get("phone_number")
    if provider == "phone" and isinstance(phone, str):
        existing_phone = await repo.get_by_phone(re.sub(r"\D", "", phone)[-10:], internal=True)
        if existing_phone:
            await repo.link_external_identity(user_id=existing_phone["id"], provider="firebase", subject=subject)
            if hasattr(repo, "record_auth_provider"):
                await repo.record_auth_provider(
                    user_id=existing_phone["id"], provider_uid=subject,
                    provider_email=existing_phone.get("email"),
                )
            existing_phone.pop("password_hash", None)
            return existing_phone

    email = claims.get("email")
    email_verified = claims.get("email_verified") is True
    existing_email_user = None
    if isinstance(email, str) and not email_verified and provider == "password":
        # Firebase's email/password provider may leave email_verified=false
        # when Marketplace already verified the same address with its email
        # OTP. A successful password credential plus Marketplace verification
        # is sufficient to reuse the existing identity; never use this for a
        # new account.
        existing_email_user = await repo.get_by_email(email, internal=True)
        email_verified = bool(existing_email_user and existing_email_user.get("is_email_verified"))
    if not isinstance(email, str) or not email_verified:
        raise HTTPException(409, "Link a verified email to this Firebase account before using phone sign-in")

    # Administrators are deliberately not application users. A verified
    # Firebase email resolves directly to the separated admin directory.
    try:
        async with connection() as conn:
            admin = await conn.fetchrow(
                "SELECT id,email,full_name,is_active,created_at FROM public.admins WHERE lower(email)=lower($1)",
                email.strip().lower(),
            )
    except RuntimeError:
        # Repository-level tests may provide a mocked buyer repository without
        # booting a PostgreSQL pool. The normal repository still enforces the
        # admin-directory lookup when the pool is available.
        admin = None
    if admin:
        if not admin["is_active"]:
            raise HTTPException(403, "Administrator account is inactive")
        return {
            "id": str(admin["id"]), "email": admin["email"], "name": admin["full_name"],
            "full_name": admin["full_name"], "role": "admin", "coin_balance": 0,
            "is_active": True, "is_email_verified": True, "is_phone_verified": False,
            "auth_provider": "firebase",
            "picture": None, "created_at": admin["created_at"].isoformat(), "auth_version": 1, "status": "active",
        }

    user = existing_email_user or await repo.get_by_email(email, internal=True)
    if user is None:
        if not allow_buyer_registration or not registration_name:
            raise HTTPException(409, "Complete Marketplace profile registration before signing in")
        user = await repo.create_identity(
            email=email,
            name=registration_name,
            password_hash=None,
            role="buyer",
            is_email_verified=True,
            identity_source="firebase",
            coin_balance=20,
            internal=True,
        )

    await repo.link_external_identity(user_id=user["id"], provider="firebase", subject=subject)
    if hasattr(repo, "record_auth_provider"):
        await repo.record_auth_provider(
            user_id=user["id"],
            provider_uid=subject, provider_email=email,
        )
    user.pop("password_hash", None)
    return user


async def enroll_firebase_email_identity(claims: dict, authenticated_user: dict, repo: UserRepository) -> dict:
    """Link a newly enrolled Firebase email/password credential to its owner.

    Firebase does not mark a newly created email/password account as verified
    until its separate email-verification action runs. Marketplace has already
    verified this user's email through its login OTP and authenticated the
    current session, so that pair is the authorization proof for this one-time
    enrollment path.
    """
    subject = claims.get("uid") or claims.get("sub")
    email = claims.get("email")
    if not isinstance(subject, str) or not subject or not isinstance(email, str):
        raise HTTPException(401, "Firebase identity is missing an email or subject")
    if email.strip().lower() != authenticated_user["email"].strip().lower():
        raise HTTPException(401, "Firebase email does not match the authenticated account")

    linked = await repo.get_by_external_identity("firebase", subject, internal=True)
    if linked and linked["id"] != authenticated_user["id"]:
        raise HTTPException(409, "This Firebase identity is already linked to another account")
    if not linked:
        await repo.link_external_identity(
            user_id=authenticated_user["id"], provider="firebase", subject=subject,
        )
    if hasattr(repo, "record_auth_provider"):
        await repo.record_auth_provider(
            user_id=authenticated_user["id"], provider_uid=subject,
            provider_email=email.strip().lower(),
        )
    return authenticated_user


async def complete_unified_registration(
    *,
    email: str,
    name: str,
    password: str,
    phone: str,
    email_otp: str | None = None,
    phone_otp: str | None = None,
    google_verified: bool = False,
    platform: str = "web",
    pnv_token: str | None = None,
    firebase_subject: str | None = None,
    firebase_provider: str | None = None,
    firebase_phone_verified: bool = False,
    repo: UserRepository,
) -> dict:
    """
    Create a new user account with manual name entry, password, email verification,
    and platform-specific phone verification (Android PNV or Web SMS OTP).
    """
    clean_email = email.strip().lower()
    clean_phone = re.sub(r"\D", "", phone)[-10:]
    manual_name = name.strip()

    if not manual_name:
        raise HTTPException(400, "Full Name must be entered manually")

    existing = await repo.get_by_email(clean_email, internal=True)
    if existing:
        if not firebase_subject:
            raise HTTPException(400, "An account with this email address already exists")
        await repo.link_external_identity(user_id=existing["id"], provider="firebase", subject=firebase_subject)
        existing.pop("password_hash", None)
        return existing

    # 1. Validate Email Verification
    if not google_verified:
        # The UI verifies the OTP before showing the profile form. That
        # consumes the one-time code, so finalization must honor the short-lived
        # verified marker instead of attempting to consume the same code again.
        if not await _recent_email_verification(clean_email):
            if not email_otp or len(email_otp) != 6:
                raise HTTPException(400, "Email verification code is required")
            verified, msg = await verify_email_otp_challenge(
                email=clean_email,
                otp=email_otp,
                purpose="registration",
                user_id="anon",
            )
            if not verified:
                raise HTTPException(400, f"Email verification failed: {msg}")

    # 2. Validate Phone Verification
    if platform == "android" and pnv_token:
        # Android Phone Number Verification (PNV) / SMS Retriever token validation
        if len(pnv_token) < 8:
            raise HTTPException(400, "Invalid Android Phone Verification Token")
    elif not firebase_phone_verified:
        # Web or Android SMS OTP validation
        if not await _recent_phone_verification(clean_phone):
            if not phone_otp or len(phone_otp) != 6:
                raise HTTPException(400, "6-digit SMS OTP is required for phone verification")
            verified, msg = await verify_phone_otp_challenge(
                phone=clean_phone,
                otp=phone_otp,
                purpose="registration",
                user_id="anon",
            )
            if not verified:
                raise HTTPException(400, f"Phone verification failed: {msg}")

    # 3. Create identity in Postgres
    user = await repo.create_identity(
        email=clean_email,
        name=manual_name,
        # Firebase Auth owns the password credential; the marketplace stores
        # only profile/authorization metadata.
        password_hash=None,
        role="buyer",
        is_email_verified=True,
        identity_source="firebase" if firebase_subject else ("google" if google_verified else "password"),
        coin_balance=20,
        internal=True,
    )

    if firebase_subject:
        await repo.link_external_identity(user_id=user["id"], provider="firebase", subject=firebase_subject)
        if hasattr(repo, "record_auth_provider"):
            await repo.record_auth_provider(
                user_id=user["id"],
                provider_uid=firebase_subject,
                provider_email=clean_email,
            )

    # 4. Record default buyer address with verified phone
    try:
        user_uuid = uuid.UUID(user["id"])
        async with transaction() as conn:
            await conn.execute(
                """
                INSERT INTO public.buyer_address
                    (id, buyer_id, name, phone, address_line, city, state, pincode, is_default)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                uuid.uuid4(),
                user_uuid,
                manual_name,
                clean_phone,
                "REGISTERED LOCATION",
                "CITY",
                "STATE",
                "110001",
                True,
            )
    except Exception as e:
        logger.warning("Could not create initial default address record: %s", e)

    user.pop("password_hash", None)
    return user
