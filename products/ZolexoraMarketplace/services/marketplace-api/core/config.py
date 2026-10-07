import os
import ipaddress
from pathlib import Path
from pydantic import SecretStr
from dotenv import load_dotenv # Trigger reload

BACKEND_DIR = Path(__file__).parent.parent
# Local development should use the repository's `.env.local` values even when
# a stale secret was exported in the terminal. Deployed environments keep
# their injected secrets authoritative and never allow dotenv files to replace
# them.
_development_env = os.environ.get("APP_ENV", os.environ.get("ENV", "development")).lower() not in {"prod", "production", "staging"}
load_dotenv(BACKEND_DIR / ".env", override=_development_env)
load_dotenv(BACKEND_DIR / ".env.local", override=_development_env)
load_dotenv(BACKEND_DIR / ".env.smsprovider", override=_development_env)


def _parse_trusted_proxies() -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    raw = os.environ.get("TRUSTED_PROXIES", "").strip()
    if not raw:
        return []
    networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for item in raw.split(","):
        token = item.strip()
        if not token:
            continue
        try:
            net = ipaddress.ip_network(token, strict=False)
            networks.append(net)
        except ValueError as exc:
            raise RuntimeError(f"Invalid TRUSTED_PROXIES entry: {token}") from exc
    return networks



def _cors_origins() -> list[str]:
    production = [
        "https://shop.zolexora.com",
        "https://mahilamadel.store",
        "https://www.mahilamadel.store",
        "https://seller.zolexora.com",
        "https://admin.marketplace.zolexora.com",
    ]
    env = os.environ.get("APP_ENV", os.environ.get("ENV", os.environ.get("ENVIRONMENT", "development"))).lower()
    if env in {"prod", "production", "staging"}:
        return production
    local = [
        value.strip()
        for value in os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,"
            "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:3003",
        ).split(",")
        if value.strip().startswith(("http://localhost:", "http://127.0.0.1:", "https://"))
    ]
    return list(dict.fromkeys([*production, *local]))


class Settings:
    # ── Runtime mode / validation controls
    APP_ENV: str = os.environ.get("APP_ENV", os.environ.get("ENV", os.environ.get("ENVIRONMENT", "development")))
    TESTING: bool = os.environ.get("TESTING", "").lower() in {"1", "true", "yes", "on"}
    SKIP_STARTUP_ENV_VALIDATION: bool = os.environ.get("SKIP_STARTUP_ENV_VALIDATION", "").lower() in {"1", "true", "yes", "on"}

    # ── Canonical Marketplace PostgreSQL
    DATABASE_URL: str = (os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DATABASE_URL", "")).strip().strip("\"'")

    # ── MongoDB Atlas — documents (products, orders, cart, reels, shipping, coins)
    MONGO_URL: str = os.environ.get("MONGO_URL", "").strip().strip("\"'")
    DB_NAME:   str = os.environ.get("MONGO_DB_NAME", os.environ.get("DB_NAME", "zolexora_db")).strip().strip("\"'")

    # ── JWT Authentication
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "")
    JWT_EXPIRE_HOURS: int = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))

    # ── Supabase (Transitional / Auth)
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "").strip().strip("\"'")
    SUPABASE_ANON_KEY: str = os.environ.get("SUPABASE_ANON_KEY", "").strip().strip("\"'")
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip().strip("\"'")
    SUPABASE_DB_PASSWORD: str = os.environ.get("SUPABASE_DB_PASSWORD", "").strip().strip("\"'")

    # ── Firebase Authentication identity-token verification
    FIREBASE_PROJECT_ID: str = os.environ.get("FIREBASE_PROJECT_ID", "").strip()

    # GST taxpayer verification (ClearTax credentials stay server-side)
    GST_CLEARTAX_BASE_URL: str = os.environ.get("GST_CLEARTAX_BASE_URL", "").strip().rstrip("/")
    GST_CLEARTAX_AUTH_TOKEN: SecretStr | None = (
        SecretStr(os.environ["GST_CLEARTAX_AUTH_TOKEN"])
        if os.environ.get("GST_CLEARTAX_AUTH_TOKEN") else None
    )
    GST_CLEARTAX_TAXABLE_ENTITY_ID: str = os.environ.get("GST_CLEARTAX_TAXABLE_ENTITY_ID", "").strip()
    GST_LOOKUP_MODE: str = os.environ.get("GST_LOOKUP_MODE", "provider").strip().lower()
    SELLER_MOCK_VERIFIED_FIREBASE_UID: str = os.environ.get("SELLER_MOCK_VERIFIED_FIREBASE_UID", "").strip()

    # ── Default admin seed (optional)
    DEFAULT_ADMIN_EMAIL:    str = os.environ.get("DEFAULT_ADMIN_EMAIL", os.environ.get("ADMIN_EMAIL", ""))
    DEFAULT_ADMIN_PASSWORD: str = os.environ.get("DEFAULT_ADMIN_PASSWORD", os.environ.get("ADMIN_PASSWORD", ""))

    # ── Redis — transient cache, opaque sessions, and verification challenges
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379").strip().strip("\"'")
    REDIS_NAMESPACE: str = os.environ.get("REDIS_NAMESPACE", "zolexora")
    REDIS_POOL_MAX: int = int(os.environ.get("REDIS_POOL_MAX", "20"))
    REDIS_CONNECT_TIMEOUT: float = float(os.environ.get("REDIS_CONNECT_TIMEOUT", "2"))
    SESSION_TTL_SECONDS: int = int(os.environ.get("SESSION_TTL_SECONDS", "86400"))
    OTP_TTL_SECONDS: int = int(os.environ.get("OTP_TTL_SECONDS", "600"))
    OTP_RESEND_COOLDOWN_SECONDS: int = int(os.environ.get("OTP_RESEND_COOLDOWN_SECONDS", "60"))
    REGISTRATION_RATE_WINDOW_SECONDS: int = int(os.environ.get("REGISTRATION_RATE_WINDOW_SECONDS", "3600"))
    REGISTRATION_RATE_LIMIT: int = int(os.environ.get("REGISTRATION_RATE_LIMIT", "5"))
    AUTH_OTP_PEPPER: SecretStr | None = (
        SecretStr(os.environ["AUTH_OTP_PEPPER"])
        if os.environ.get("AUTH_OTP_PEPPER")
        else None
    )

    # ── Cloudinary — ALL binary media (images, videos, avatars)
    CLOUDINARY_CLOUD_NAME: str = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY:    str = os.environ.get("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.environ.get("CLOUDINARY_API_SECRET", "")

    # ── Cloudflare
    CLOUDFLARE_API_TOKEN:  str = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    CLOUDFLARE_ACCOUNT_ID: str = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    CLOUDFLARE_ZONE_ID:    str = os.environ.get("CLOUDFLARE_ZONE_ID", "")

    # ── Email (Resend)
    RESEND_API_KEY: str = os.environ.get("RESEND_API_KEY", "")
    SENDER_EMAIL:   str = os.environ.get("SENDER_EMAIL", "noreply@zolexora.com")

    # ── Razorpay
    RAZORPAY_KEY_ID:        str = os.environ.get("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET:    str = os.environ.get("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

    # ── Cashfree
    CASHFREE_ENVIRONMENT:   str = os.environ.get("CASHFREE_ENVIRONMENT", "SANDBOX")
    CASHFREE_CLIENT_ID:     str = os.environ.get("CASHFREE_CLIENT_ID", "")
    CASHFREE_CLIENT_SECRET: str = os.environ.get("CASHFREE_CLIENT_SECRET", "")

    # ── Shipping webhooks
    SHIPPING_WEBHOOK_SECRET: str = os.environ.get(
        "SHIPPING_WEBHOOK_SECRET",
        os.environ.get("SHIPROCKET_WEBHOOK_SECRET", ""),
    )

    # ── UPI / QR
    UPI_ID:            str = os.environ.get("UPI_ID", "")
    UPI_MERCHANT_NAME: str = os.environ.get("UPI_MERCHANT_NAME", "Zolexora")

    # ── Checkout Quotes
    CHECKOUT_QUOTE_SIGNING_SECRET: SecretStr | None = (
        SecretStr(os.environ["CHECKOUT_QUOTE_SIGNING_SECRET"])
        if os.environ.get("CHECKOUT_QUOTE_SIGNING_SECRET")
        else None
    )
    CHECKOUT_QUOTE_EXPIRY_MINUTES: int = int(os.environ.get("CHECKOUT_QUOTE_EXPIRY_MINUTES", "15"))

    # ── CORS
    CORS_ORIGINS: list[str] = _cors_origins()

    # ── Trusted Proxies
    TRUSTED_PROXIES: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = _parse_trusted_proxies()

    # ── URLs
    BUYER_URL:  str = os.environ.get("ZOLEXORA_SHOP_URL", os.environ.get("BUYER_URL", "https://zolexora.com"))
    ZOLEXORA_SHOP_URL: str = os.environ.get("ZOLEXORA_SHOP_URL", os.environ.get("BUYER_URL", "https://zolexora.com"))
    MAHILA_MADEL_URL: str = os.environ.get("MAHILA_MADEL_URL", "https://mahilamadel.store")
    SELLER_URL: str = os.environ.get("SELLER_URL", "https://seller.zolexora.com")
    ADMIN_URL:  str = os.environ.get("ADMIN_URL",  "https://admin.zolexora.com")

    # ── Storefront configuration
    ZOLEXORA_SHOP_PAYMENT_PROVIDER: str = os.environ.get("ZOLEXORA_SHOP_PAYMENT_PROVIDER", "razorpay")
    MAHILA_MADEL_PAYMENT_PROVIDER: str = os.environ.get("MAHILA_MADEL_PAYMENT_PROVIDER", "razorpay")

    # ── Address & Logistics Integration Placeholders
    GOOGLE_ADDRESS_VALIDATION_API_KEY: SecretStr | None = (
        SecretStr(os.environ["GOOGLE_ADDRESS_VALIDATION_API_KEY"])
        if os.environ.get("GOOGLE_ADDRESS_VALIDATION_API_KEY")
        else None
    )
    SHIPWAY_API_KEY: SecretStr | None = (
        SecretStr(os.environ["SHIPWAY_API_KEY"])
        if os.environ.get("SHIPWAY_API_KEY")
        else None
    )
    SHIPWAY_BASE_URL: str = os.environ.get("SHIPWAY_BASE_URL", "https://app.shipway.com/api")

    # ── Coins
    COINS_PER_REEL_VIEW:   int   = 3
    COINS_CREATOR_PER_VIEW: int  = 3
    MAX_DAILY_COINS:       int   = 150
    COIN_VALUE:            float = 0.01
    MAX_COIN_DISCOUNT:     float = 0.50
    MAX_CART_QUANTITY:     int   = int(os.environ.get("MAX_CART_QUANTITY", "100"))

    SUBSCRIPTION_PLANS: dict = {
        "basic":   {"name": "Basic",   "price": 399, "coins_bonus": 100},
        "premium": {"name": "Premium", "price": 799, "coins_bonus": 250},
    }
    CATEGORIES: list = ["Electronics","Fashion","Home & Living","Beauty","Sports","Food","Other"]

    def validate(self) -> None:
        self.validate_required_runtime_config()

    def validate_required_runtime_config(self) -> None:
        if self._is_test_runtime() or (
            self.SKIP_STARTUP_ENV_VALIDATION and not self._is_production_runtime()
        ):
            return

        missing = [k for k, v in {
            "MONGO_URL": self.MONGO_URL,
            "REDIS_URL": self.REDIS_URL,
        }.items() if not str(v).strip()]
        if self.AUTH_OTP_PEPPER is None:
            missing.append("AUTH_OTP_PEPPER")

        if not str(self.DATABASE_URL).strip():
            missing.append("DATABASE_URL")

        if missing:
            raise RuntimeError(
                "Missing required runtime env vars for Zolexora backend: "
                f"{', '.join(missing)}. Authentication and PostgreSQL profiles "
                "cannot run without this configuration. Set the missing variables "
                "or use TESTING=true/SKIP_STARTUP_ENV_VALIDATION=true only for "
                "non-production test runs."
            )

    def _is_test_runtime(self) -> bool:
        env = str(self.APP_ENV).lower()
        testing_flag = os.environ.get("TESTING", "")
        pytest_current = os.environ.get("PYTEST_CURRENT_TEST", "")
        return (
            self.TESTING
            or testing_flag.lower() in {"1", "true", "yes", "on"}
            or env in {"test", "testing", "pytest"}
            or bool(pytest_current)
        )

    def _is_production_runtime(self) -> bool:
        return str(self.APP_ENV).lower() in {"prod", "production", "staging"}


settings = Settings()
