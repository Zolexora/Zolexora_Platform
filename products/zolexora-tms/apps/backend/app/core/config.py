import json
from typing import Annotated, List, Optional
from urllib.parse import quote_plus
from pydantic import AliasChoices, BeforeValidator, Field, computed_field
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict



def _split_list(value):
    """Env lists are comma-separated (a JSON array is also accepted)."""
    if isinstance(value, str):
        value = value.strip()
        if value.startswith("["):
            return json.loads(value)
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


EnvList = Annotated[List[str], NoDecode, BeforeValidator(_split_list)]


class Settings(BaseSettings):
    # Secrets come only from the process environment, injected by `infisical run`
    # (see products/zolexora-tms/scripts/with-secrets.sh). No .env files are read.
    model_config = SettingsConfigDict(extra="ignore")

    # Core Application
    PROJECT_NAME: str = "Zolexora TMS API"
    # Fail closed: anything other than development/test is treated as production.
    ENVIRONMENT: str = Field(default="production", validation_alias="NODE_ENV")
    PORT: int = 4030
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Platform Admins (comma-separated emails via PLATFORM_ADMIN_EMAILS env var)
    PLATFORM_ADMIN_EMAILS: EnvList = Field(default=[], validation_alias="PLATFORM_ADMIN_EMAILS")

    # CORS (comma-separated origins via CORS_ORIGINS env var)
    CORS_ORIGINS: EnvList = Field(default=[], validation_alias="CORS_ORIGINS")

    # Database - Infisical connection credentials
    DATABASE_ZOLEXORA_TMS_HOST: Optional[str] = Field(default=None, validation_alias="DATABASE_ZOLEXORA_TMS_HOST")
    DATABASE_ZOLEXORA_TMS_PORT: Optional[int] = Field(default=None, validation_alias="DATABASE_ZOLEXORA_TMS_PORT")
    DATABASE_ZOLEXORA_TMS_NAME: Optional[str] = Field(default=None, validation_alias="DATABASE_ZOLEXORA_TMS_NAME")
    DATABASE_ZOLEXORA_TMS_USER: Optional[str] = Field(default=None, validation_alias="DATABASE_ZOLEXORA_TMS_USER")
    DATABASE_ZOLEXORA_TMS_PASSWORD: Optional[str] = Field(default=None, validation_alias="DATABASE_ZOLEXORA_TMS_PASSWORD")
    DATABASE_ZOLEXORA_TMS_EXTERNAL_DATABASE_URL: Optional[str] = Field(
        default=None, validation_alias="DATABASE_ZOLEXORA_TMS_EXTERNAL_DATABASE_URL"
    )
    DATABASE_ZOLEXORA_TMS_INTERNAL_DATABASE_URL: Optional[str] = Field(
        default=None, validation_alias="DATABASE_ZOLEXORA_TMS_INTERNAL_DATABASE_URL"
    )

    # Optional direct DATABASE_URL override
    DATABASE_URL_OVERRIDE: Optional[str] = Field(default=None, validation_alias="DATABASE_URL")

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE
        if self.DATABASE_ZOLEXORA_TMS_EXTERNAL_DATABASE_URL:
            return self.DATABASE_ZOLEXORA_TMS_EXTERNAL_DATABASE_URL
        if self.DATABASE_ZOLEXORA_TMS_HOST and self.DATABASE_ZOLEXORA_TMS_USER:
            user = self.DATABASE_ZOLEXORA_TMS_USER
            pwd = quote_plus(self.DATABASE_ZOLEXORA_TMS_PASSWORD or "")
            host = self.DATABASE_ZOLEXORA_TMS_HOST
            port = self.DATABASE_ZOLEXORA_TMS_PORT or 5432
            db_name = self.DATABASE_ZOLEXORA_TMS_NAME
            if not db_name:
                raise ValueError("DATABASE_ZOLEXORA_TMS_NAME must be set alongside DATABASE_ZOLEXORA_TMS_HOST")
            return f"postgresql://{user}:{pwd}@{host}:{port}/{db_name}"
        if self.DATABASE_ZOLEXORA_TMS_INTERNAL_DATABASE_URL:
            return self.DATABASE_ZOLEXORA_TMS_INTERNAL_DATABASE_URL
        raise ValueError(
            "No database URL configured. Set DATABASE_URL or DATABASE_ZOLEXORA_TMS_* environment variables."
        )

    @computed_field
    @property
    def ASYNC_DATABASE_URL(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    # Firebase Auth
    FIREBASE_PROJECT_ID: str = Field(
        default="",
        validation_alias=AliasChoices("FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    )
    # Comma-separated allowed Firebase audience project IDs
    FIREBASE_ALLOWED_PROJECTS: EnvList = Field(default=[], validation_alias="FIREBASE_ALLOWED_PROJECTS")
    JWT_SECRET: Optional[str] = Field(default=None, validation_alias="JWT_SECRET")

    # Payment Gateway (Cashfree)
    CASHFREE_APP_ID: Optional[str] = Field(default=None, validation_alias="CASHFREE_APP_ID")
    CASHFREE_SECRET_KEY: Optional[str] = Field(default=None, validation_alias="CASHFREE_SECRET_KEY")
    CASHFREE_ENV: str = Field(default="TEST", validation_alias="CASHFREE_ENV")  # TEST or PROD

    # Storage (Cloudflare R2 & Cloudinary)
    CLOUDFLARE_ACCOUNT_ID: Optional[str] = Field(
        default=None, validation_alias="CLOUDFLARE_ACCOUNT_ID"
    )
    R2_ACCESS_KEY_ID: Optional[str] = Field(default=None, validation_alias=AliasChoices("CLOUDFLARE_R2_ACCESS_KEY", "STORAGE_ACCESS_KEY_ID"))
    R2_SECRET_ACCESS_KEY: Optional[str] = Field(default=None, validation_alias=AliasChoices("CLOUDFLARE_R2_SECRET_KEY", "STORAGE_SECRET_ACCESS_KEY"))
    R2_BUCKET_NAME: Optional[str] = Field(default=None, validation_alias=AliasChoices("CLOUDFLARE_R2_BUCKET", "STORAGE_BUCKET"))
    R2_ENDPOINT_URL: Optional[str] = Field(default=None, validation_alias=AliasChoices("R2_ENDPOINT_URL", "STORAGE_ENDPOINT_URL"))
    # Public base URL documents are served from (custom domain or r2.dev URL)
    R2_PUBLIC_BASE_URL: Optional[str] = Field(default=None, validation_alias=AliasChoices("R2_PUBLIC_BASE_URL", "STORAGE_PUBLIC_URL_PREFIX"))

    CLOUDINARY_CLOUD_NAME: Optional[str] = Field(default=None, validation_alias="CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_URL: Optional[str] = Field(default=None, validation_alias="CLOUDINARY_URL")

    # Email (Resend)
    RESEND_API_KEY: Optional[str] = Field(default=None, validation_alias="RESEND_API_KEY")

    # Background Tasks (Redis & Dramatiq)
    REDIS_URL_OVERRIDE: Optional[str] = Field(default=None, validation_alias="REDIS_URL")
    # Individual parts as stored in Infisical (Cache_And_Async/Redis)
    REDIS_HOST: Optional[str] = Field(default=None, validation_alias="REDIS_HOST")
    REDIS_PORT: int = Field(default=6379, validation_alias="REDIS_PORT")
    REDIS_PASSWORD: Optional[str] = Field(default=None, validation_alias="REDIS_PASSWORD")
    REDIS_DB: int = Field(default=0, validation_alias="REDIS_DB")
    REDIS_USE_SSL: bool = Field(default=False, validation_alias="REDIS_USE_SSL")

    @computed_field
    @property
    def REDIS_URL(self) -> Optional[str]:
        if self.REDIS_URL_OVERRIDE:
            return self.REDIS_URL_OVERRIDE
        if not self.REDIS_HOST:
            return None
        scheme = "rediss" if self.REDIS_USE_SSL else "redis"
        auth = f":{quote_plus(self.REDIS_PASSWORD)}@" if self.REDIS_PASSWORD else ""
        return f"{scheme}://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # IANA timezone for operational dates without an offset (e.g. R1 CSV imports), e.g. Asia/Kolkata
    OPERATIONS_TIMEZONE: Optional[str] = Field(default=None, validation_alias="OPERATIONS_TIMEZONE")

    # Observability (Sentry)
    SENTRY_DSN: Optional[str] = Field(default=None, validation_alias="SENTRY_DSN")

    @property
    def IS_DEV_OR_TEST(self) -> bool:
        return self.ENVIRONMENT in ("development", "test")


settings = Settings()
