import os
import ipaddress
from pathlib import Path
from pydantic import SecretStr
BACKEND_DIR = Path(__file__).parent.parent
# Secrets are injected by Infisical (scripts/setup/with-infisical.sh); no .env files are read.


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



def _list(name: str) -> list[str]:
    return [v.strip() for v in os.environ.get(name, "").split(",") if v.strip()]


class Settings:
    # ── Runtime mode. No default: a missing APP_ENV must never mean development.
    APP_ENV: str = os.environ.get("APP_ENV", "").strip()
    TESTING: bool = os.environ.get("TESTING", "").lower() in {"1", "true", "yes", "on"}

    # ── Zolexora auth service: the only sign-in authority
    AUTH_SERVICE_URL: str = os.environ.get("AUTH_SERVICE_URL", "").strip()
    # Set to 1 by compose so a localhost AUTH_SERVICE_URL is reached via host.docker.internal
    MARKETPLACE_IN_DOCKER: bool = os.environ.get("MARKETPLACE_IN_DOCKER", "").lower() in {"1", "true"}

    # ── Canonical Marketplace PostgreSQL
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "").strip()

    # ── MongoDB — documents (products, orders, cart, reels, shipping, coins)
    MONGO_URL: str = os.environ.get("MONGO_URL", "").strip()
    DB_NAME:   str = os.environ.get("MONGO_DB_NAME", "zolexora_db").strip()

    # GST taxpayer verification (ClearTax credentials stay server-side)
    GST_CLEARTAX_BASE_URL: str = os.environ.get("GST_CLEARTAX_BASE_URL", "").strip().rstrip("/")
    GST_CLEARTAX_AUTH_TOKEN: SecretStr | None = (
        SecretStr(os.environ["GST_CLEARTAX_AUTH_TOKEN"])
        if os.environ.get("GST_CLEARTAX_AUTH_TOKEN") else None
    )
    GST_CLEARTAX_TAXABLE_ENTITY_ID: str = os.environ.get("GST_CLEARTAX_TAXABLE_ENTITY_ID", "").strip()
    GST_LOOKUP_MODE: str = os.environ.get("GST_LOOKUP_MODE", "provider").strip().lower()

    # ── Redis — caches, rate limits, trending reels (no sessions)
    REDIS_URL: str = os.environ.get("REDIS_URL", "").strip()
    REDIS_NAMESPACE: str = os.environ.get("REDIS_NAMESPACE", "zolexora")
    REDIS_POOL_MAX: int = int(os.environ.get("REDIS_POOL_MAX", "20"))
    REDIS_CONNECT_TIMEOUT: float = float(os.environ.get("REDIS_CONNECT_TIMEOUT", "2"))

    # ── Cloudinary — ALL binary media (images, videos, avatars)
    CLOUDINARY_CLOUD_NAME: str = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY:    str = os.environ.get("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.environ.get("CLOUDINARY_API_SECRET", "")

    # ── Razorpay
    RAZORPAY_KEY_ID:        str = os.environ.get("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET:    str = os.environ.get("RAZORPAY_KEY_SECRET", "")
    # ERP webhooks are refused (503) until this is set in Infisical.
    ERP_WEBHOOK_SECRET:     str = os.environ.get("ERP_WEBHOOK_SECRET", "")
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
    # Browser origins of the storefronts and portals, comma-separated (Infisical)
    CORS_ORIGINS: list[str] = _list("CORS_ORIGINS")

    # ── Trusted Proxies
    TRUSTED_PROXIES: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = _parse_trusted_proxies()

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
        if self.is_test_runtime():
            return
        missing = [k for k, v in {
            "APP_ENV": self.APP_ENV,
            "AUTH_SERVICE_URL": self.AUTH_SERVICE_URL,
            "DATABASE_URL": self.DATABASE_URL,
            "MONGO_URL": self.MONGO_URL,
            "REDIS_URL": self.REDIS_URL,
            "CORS_ORIGINS": self.CORS_ORIGINS,
        }.items() if not v]
        if missing:
            raise RuntimeError(
                f"Missing required configuration: {', '.join(missing)}. "
                "Every value comes from Infisical: run through scripts/setup/with-infisical.sh."
            )

    def is_test_runtime(self) -> bool:
        return self.TESTING or self.APP_ENV.lower() == "test" or bool(os.environ.get("PYTEST_CURRENT_TEST"))

    def is_production(self) -> bool:
        return self.APP_ENV.lower() in {"prod", "production", "staging"}


settings = Settings()
