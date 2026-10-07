from dataclasses import dataclass
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class StorefrontKey(StrEnum):
    ZOLEXORA_SHOP = "zolexora-shop"
    MAHILA_MADEL = "mahila-madel"


class ApplicationSurface(StrEnum):
    CUSTOMER_STOREFRONT = "customer-storefront"
    SHARED_API = "shared-api"
    SELLER_PORTAL = "seller-portal"
    MARKETPLACE_ADMIN = "marketplace-admin"


class StorefrontContextSource(StrEnum):
    HOST = "host"
    ORIGIN = "origin"
    CLIENT_HINT = "client-hint"


class StorefrontResolutionCode(StrEnum):
    REQUIRED = "storefront_context_required"
    UNKNOWN = "storefront_unknown"
    DISABLED = "storefront_disabled"
    MISMATCH = "storefront_context_mismatch"
    ORIGIN_INVALID = "storefront_origin_invalid"
    HOST_INVALID = "storefront_host_invalid"
    UNAVAILABLE = "storefront_unavailable"


@dataclass(frozen=True, slots=True)
class StorefrontDefinition:
    id: str
    key: StorefrontKey
    display_name: str
    canonical_host: str
    hosts: frozenset[str]
    origins: frozenset[str]
    currency: str = "INR"
    locale: str = "en-IN"
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class StorefrontContext:
    storefront: StorefrontDefinition
    source: StorefrontContextSource

    @property
    def key(self) -> StorefrontKey:
        return self.storefront.key

    @property
    def id(self) -> str:
        return self.storefront.id


class PublicStorefrontResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: StorefrontKey
    display_name: str
    canonical_host: str
    currency: str
    locale: str
