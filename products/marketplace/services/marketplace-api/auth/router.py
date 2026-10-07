"""Canonical identity and opaque-session endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File as FFile

from auth import services
from auth.schemas import (
    AuthResponse, ForgotPasswordRequest, LoginRequest, PhoneLoginRequest, MessageResponse, OtpSentResponse,
    ProfileUpdateRequest, RegisterRequest, ResendOtpRequest, ResetPasswordRequest,
    UserPublic, VerifyOtpRequest,
    CheckEmailRequest, CheckEmailResponse, CheckPhoneRequest, CheckPhoneResponse,
    SendLoginOtpRequest, VerifyLoginOtpRequest, GoogleAuthRequest, GoogleAuthResponse,
    SendAuthOtpRequest, VerifyAuthOtpRequest, CompleteUnifiedRegistrationRequest,
    FirebaseEmailEnrollmentRequest, FirebaseTokenExchangeRequest,
)
from core.config import settings
from core.firebase_auth import verify_firebase_token
from core.deps import CSRF_COOKIE, SESSION_COOKIE, current_user
from shared.database import redis as redis_store
from users.repositories import UserRepository, get_user_repository

router = APIRouter(prefix="/auth", tags=["auth"])


def _native(request: Request) -> bool:
    native = request.headers.get("x-session-transport") == "native"
    if native and request.headers.get("origin"):
        raise HTTPException(400, "Native session transport is not valid for browser origins")
    return native


def _is_secure() -> bool:
    return str(settings.APP_ENV).lower() in {"prod", "production", "staging"}


def _set_session(request: Request, response: Response, token: str, csrf: str) -> None:
    secure = request.url.scheme == "https" or _is_secure()
    response.set_cookie(
        SESSION_COOKIE, token, max_age=settings.SESSION_TTL_SECONDS,
        httponly=True, secure=secure, samesite="lax", path="/",
    )
    response.set_cookie(
        CSRF_COOKIE, csrf, max_age=settings.SESSION_TTL_SECONDS,
        httponly=False, secure=secure, samesite="lax", path="/",
    )


def _clear_session(request: Request, response: Response) -> None:
    secure = request.url.scheme == "https" or _is_secure()
    response.delete_cookie(SESSION_COOKIE, httponly=True, secure=secure, samesite="lax", path="/")
    response.delete_cookie(CSRF_COOKIE, httponly=False, secure=secure, samesite="lax", path="/")


async def _session_response(request: Request, response: Response, user: dict) -> AuthResponse:
    token, csrf, _record = await redis_store.create_session(user["id"], user.get("auth_version", 1))
    safe_user = {key: value for key, value in user.items() if key not in {"password_hash", "auth_version"}}
    if _native(request):
        return AuthResponse(user=UserPublic(**safe_user), session_token=token)
    _set_session(request, response, token, csrf)
    return AuthResponse(user=UserPublic(**safe_user))


@router.post("/register", response_model=OtpSentResponse)
async def register(req: RegisterRequest, repo: UserRepository = Depends(get_user_repository)) -> OtpSentResponse:
    await services.initiate_registration(req.email, req.name, req.password, repo)
    return OtpSentResponse(email=req.email)


@router.post("/verify-register", response_model=AuthResponse)
async def verify_register(
    req: VerifyOtpRequest, request: Request, response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> AuthResponse:
    return await _session_response(request, response, await services.complete_registration(req.email, req.otp, repo))


@router.post("/resend-otp", response_model=MessageResponse)
@router.post("/resend-otp-body", response_model=MessageResponse, include_in_schema=False)
async def resend_otp(req: ResendOtpRequest) -> MessageResponse:
    await services.resend_registration_otp(req.email)
    return MessageResponse(message="A new verification code has been sent.")


@router.post("/login", response_model=AuthResponse)
async def login(
    req: LoginRequest, request: Request, response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> AuthResponse:
    user = await services.login_with_password(req.email, req.password, repo)
    user["auth_provider"] = "email"
    return await _session_response(request, response, user)


@router.post("/login-phone", response_model=AuthResponse)
async def login_phone(
    req: PhoneLoginRequest, request: Request, response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> AuthResponse:
    user = await services.login_with_phone_password(req.phone, req.password, repo)
    user["auth_provider"] = "phone"
    return await _session_response(request, response, user)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(req: ForgotPasswordRequest, repo: UserRepository = Depends(get_user_repository)) -> MessageResponse:
    await services.send_password_reset(req.email, repo)
    return MessageResponse(message="If this email is registered, reset instructions have been sent.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(req: ResetPasswordRequest, repo: UserRepository = Depends(get_user_repository)) -> MessageResponse:
    await services.complete_password_reset(req.token, req.new_password, repo)
    return MessageResponse(message="Password updated. You can now log in.")


# ── Unified Multi-Platform Authentication (Web & Android) ────────────────────

@router.post("/check-email", response_model=CheckEmailResponse)
async def check_email(
    req: CheckEmailRequest,
    repo: UserRepository = Depends(get_user_repository),
) -> CheckEmailResponse:
    """Check if an email is registered; returns authentication methods & masked phone."""
    res = await services.check_email_account(req.email, repo)
    return CheckEmailResponse(**res)


@router.post("/check-phone", response_model=CheckPhoneResponse)
async def check_phone(
    req: CheckPhoneRequest,
    repo: UserRepository = Depends(get_user_repository),
) -> CheckPhoneResponse:
    """Check if a phone number is registered; returns masked phone & masked email."""
    res = await services.check_phone_account(req.phone, repo)
    return CheckPhoneResponse(**res)


@router.post("/send-login-otp", response_model=MessageResponse)
async def send_login_otp(
    req: SendLoginOtpRequest,
    repo: UserRepository = Depends(get_user_repository),
) -> MessageResponse:
    """Dispatch a 6-digit login OTP to registered email or SMS."""
    res = await services.send_login_otp(req.email, req.phone, req.channel, repo)
    return MessageResponse(message=res.get("message", "Login OTP sent successfully."))


@router.post("/verify-login-otp", response_model=AuthResponse)
async def verify_login_otp(
    req: VerifyLoginOtpRequest,
    request: Request,
    response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> AuthResponse:
    """Verify login OTP and authenticate the existing user."""
    user = await services.verify_login_otp(req.email, req.phone, req.otp, repo)
    user["auth_provider"] = "phone" if req.phone else "email"
    return await _session_response(request, response, user)


@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(
    req: GoogleAuthRequest,
    request: Request,
    response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> GoogleAuthResponse:
    """
    Handle Google OAuth Handshake.
    If user already exists -> directly login and bypass checks.
    If new user -> return is_new_user=True (do NOT auto-create account, require complete profile form).
    """
    if not req.id_token:
        raise HTTPException(400, "Firebase identity token is required")
    claims = await verify_firebase_token(req.id_token)
    firebase_claims = claims.get("firebase", {})
    if firebase_claims.get("sign_in_provider") != "google.com":
        raise HTTPException(401, "Firebase token is not a Google sign-in")
    verified_email = claims.get("email")
    # Firebase can preserve an older email/password account's
    # `email_verified=false` flag after Google is linked. The signed provider
    # claim is the verification proof for this endpoint; non-Google tokens are
    # rejected above.
    if not isinstance(verified_email, str):
        raise HTTPException(401, "Google account email is not verified")
    if verified_email.strip().lower() != req.email:
        raise HTTPException(401, "Firebase token email does not match request")
    linked = await repo.get_by_external_identity("firebase", claims.get("sub"), internal=True)
    if linked:
        linked.pop("password_hash", None)
        linked["auth_provider"] = "google"
        auth_resp = await _session_response(request, response, linked)
        return GoogleAuthResponse(
            is_new_user=False,
            email=verified_email,
            verified=True,
            user=auth_resp.user,
            session_token=auth_resp.session_token,
        )
    is_new, user = await services.authenticate_google_user(verified_email, repo)
    if not is_new and user is not None:
        existing_subject = await repo.get_external_identity_subject(user["id"])
        if existing_subject and existing_subject != claims.get("sub"):
            raise HTTPException(
                409,
                "Sign in with your existing email/password account first, then link Google to that same account.",
            )
        await repo.link_external_identity(user_id=user["id"], provider="firebase", subject=claims.get("sub"))
        user["auth_provider"] = "google"
        auth_resp = await _session_response(request, response, user)
        return GoogleAuthResponse(
            is_new_user=False,
            email=verified_email,
            verified=True,
            user=auth_resp.user,
            session_token=auth_resp.session_token,
        )
    return GoogleAuthResponse(
        is_new_user=True,
        email=verified_email,
        verified=True,
    )


@router.post("/firebase", response_model=AuthResponse)
async def firebase_auth(
    req: FirebaseTokenExchangeRequest,
    request: Request,
    response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> AuthResponse:
    """Verify a Firebase ID token, then create the existing opaque session."""
    claims = await verify_firebase_token(req.id_token)
    user = await services.exchange_firebase_identity(
        claims,
        repo,
        registration_name=req.registration_name,
        allow_buyer_registration=req.allow_buyer_registration,
    )
    provider = claims.get("firebase", {}).get("sign_in_provider")
    user["auth_provider"] = {"google.com": "google", "phone": "phone", "password": "email"}.get(provider, "firebase")
    return await _session_response(request, response, user)


@router.post("/enroll-firebase-email", response_model=AuthResponse)
async def enroll_firebase_email(
    req: FirebaseEmailEnrollmentRequest,
    request: Request,
    response: Response,
    user: dict = Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
) -> AuthResponse:
    """Attach a Firebase email/password credential after authenticated email-OTP recovery."""
    claims = await verify_firebase_token(req.id_token)
    if claims.get("firebase", {}).get("sign_in_provider") != "password":
        raise HTTPException(401, "Firebase token is not an email/password sign-in")
    enrolled = await services.enroll_firebase_email_identity(claims, user, repo)
    enrolled["auth_provider"] = "email"
    return await _session_response(request, response, enrolled)


@router.post("/send-phone-otp", response_model=MessageResponse)
async def send_phone_otp(req: SendAuthOtpRequest) -> MessageResponse:
    """Dispatch 6-digit phone verification OTP."""
    if not req.phone:
        raise HTTPException(400, "Phone number is required")
    from shared.sms.otp import create_phone_otp_challenge
    success, msg = await create_phone_otp_challenge(
        phone=req.phone,
        purpose=req.purpose,
        user_id="anon",
    )
    if not success:
        raise HTTPException(400, msg)
    return MessageResponse(message=msg)


@router.post("/verify-phone-otp", response_model=MessageResponse)
async def verify_phone_otp(req: VerifyAuthOtpRequest) -> MessageResponse:
    """Verify 6-digit phone verification OTP."""
    if not req.phone:
        raise HTTPException(400, "Phone number is required")
    from shared.sms.otp import verify_phone_otp_challenge
    verified, msg = await verify_phone_otp_challenge(
        phone=req.phone,
        otp=req.otp,
        purpose=req.purpose,
        user_id="anon",
    )
    if not verified:
        raise HTTPException(400, msg)
    return MessageResponse(message="Phone verified successfully! ✓")


@router.post("/send-email-otp", response_model=MessageResponse)
async def send_email_otp(req: SendAuthOtpRequest) -> MessageResponse:
    """Dispatch 6-digit email verification code."""
    if not req.email:
        raise HTTPException(400, "Email address is required")
    from shared.verification.email_otp import create_email_otp_challenge
    success, msg = await create_email_otp_challenge(
        email=req.email,
        purpose=req.purpose,
        user_id="anon",
        name="Customer",
    )
    if not success:
        raise HTTPException(400, msg)
    return MessageResponse(message=msg)


@router.post("/verify-email-otp", response_model=MessageResponse)
async def verify_email_otp(req: VerifyAuthOtpRequest) -> MessageResponse:
    """Verify 6-digit email verification code."""
    if not req.email:
        raise HTTPException(400, "Email address is required")
    from shared.verification.email_otp import verify_email_otp_challenge
    verified, msg = await verify_email_otp_challenge(
        email=req.email,
        otp=req.otp,
        purpose=req.purpose,
        user_id="anon",
    )
    if not verified:
        raise HTTPException(400, msg)
    return MessageResponse(message="Email verified successfully! ✓")


@router.post("/complete-unified-registration", response_model=AuthResponse, status_code=201)
async def complete_unified_registration(
    req: CompleteUnifiedRegistrationRequest,
    request: Request,
    response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> AuthResponse:
    """
    Finalize registration for Google / Email / Phone onboarding paths.
    Enforces manual name entry, password, email verification, and platform-specific phone verification.
    """
    firebase_subject = None
    firebase_provider = None
    firebase_phone_verified = False
    if req.firebase_id_token:
        claims = await verify_firebase_token(req.firebase_id_token)
        firebase_subject = claims.get("uid") or claims.get("sub")
        firebase_provider = claims.get("firebase", {}).get("sign_in_provider")
        claim_phone = claims.get("phone_number")
        if isinstance(claim_phone, str) and claim_phone[-10:] == req.phone[-10:]:
            firebase_phone_verified = True
        if firebase_provider == "phone":
            if not isinstance(firebase_subject, str) or not firebase_phone_verified:
                raise HTTPException(401, "Firebase phone identity does not match the registered phone")
        elif firebase_provider == "google.com":
            claim_email = claims.get("email")
            if claim_email != req.email or claims.get("email_verified") is not True:
                raise HTTPException(401, "Firebase Google identity does not match the registered email")
        elif firebase_provider == "password":
            claim_email = claims.get("email")
            if claim_email != req.email:
                raise HTTPException(401, "Firebase email identity does not match the registered email")
        else:
            raise HTTPException(401, "Unsupported Firebase registration provider")
    user = await services.complete_unified_registration(
        email=req.email,
        name=req.name,
        password=req.password,
        phone=req.phone,
        email_otp=req.email_otp,
        phone_otp=req.phone_otp,
        google_verified=req.google_verified,
        platform=req.platform,
        pnv_token=req.pnv_token,
        firebase_subject=firebase_subject,
        firebase_provider=firebase_provider,
        firebase_phone_verified=firebase_phone_verified,
        repo=repo,
    )
    user["auth_provider"] = "google" if firebase_provider == "google.com" else ("phone" if firebase_provider == "phone" else "email")
    return await _session_response(request, response, user)


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(current_user)) -> UserPublic:
    return UserPublic(**user)


@router.put("/me", response_model=MessageResponse)
async def update_profile(
    data: ProfileUpdateRequest, user: dict = Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
) -> MessageResponse:
    await repo.update_fields(user["id"], data.model_dump(exclude_none=True))
    return MessageResponse(message="Profile updated")


@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response) -> MessageResponse:
    cookie = request.cookies.get(SESSION_COOKIE)
    authorization = request.headers.get("authorization", "")
    bearer = authorization[7:] if authorization.lower().startswith("bearer ") else None
    if cookie and bearer:
        raise HTTPException(400, "Multiple session credentials are not allowed")
    if cookie:
        origin = request.headers.get("origin")
        csrf_cookie = request.cookies.get(CSRF_COOKIE, "")
        csrf_header = request.headers.get("x-csrf-token", "")
        if origin not in settings.CORS_ORIGINS or not csrf_cookie or csrf_cookie != csrf_header:
            raise HTTPException(403, "CSRF validation failed")
        if not await redis_store.validate_csrf(cookie, csrf_header):
            raise HTTPException(403, "CSRF validation failed")
    if cookie or bearer:
        await redis_store.revoke_session(cookie or bearer or "")
    _clear_session(request, response)
    return MessageResponse(message="Signed out")


@router.post("/revoke-all", response_model=MessageResponse)
async def revoke_all(
    request: Request, response: Response,
    user: dict = Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
) -> MessageResponse:
    await repo.increment_auth_version(user["id"])
    await redis_store.revoke_all_user_sessions(user["id"])
    _clear_session(request, response)
    return MessageResponse(message="All sessions revoked")


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = FFile(...), user: dict = Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
) -> dict:
    if file.content_type and file.content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise HTTPException(400, "Invalid image format. Allowed formats: JPEG, PNG, WebP, GIF")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image size exceeds 5MB limit")
    from core.cloudinary_client import upload_avatar as upload
    url = await upload(user["id"], content, file.content_type or "image/jpeg")
    await repo.update_picture(user["id"], url)
    return {"picture": url, "storage": "cloudinary"}
