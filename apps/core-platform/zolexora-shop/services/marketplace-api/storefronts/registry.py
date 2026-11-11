from dataclasses import replace
from urllib.parse import urlsplit

from .models import ApplicationSurface, StorefrontDefinition, StorefrontKey


def normalize_host(value: str, *, allow_port: bool = False) -> str:
    raw = value.strip()
    if not raw or any(char in raw for char in "/?#@"):
        raise ValueError("Malformed host")
    try:
        parsed = urlsplit(f"//{raw}")
        host = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Malformed host") from exc
    if not host or parsed.username is not None or parsed.password is not None:
        raise ValueError("Malformed host")
    host = host.lower()
    if host.endswith("."):
        host = host[:-1]
    if not host or host.endswith(".") or ".." in host:
        raise ValueError("Malformed host")
    if port is not None and not allow_port:
        raise ValueError("Port is not allowed")
    return f"{host}:{port}" if port is not None else host


def normalize_origin(value: str, *, allow_local_http: bool = False) -> str:
    raw = value.strip()
    if not raw or raw == "null":
        raise ValueError("Malformed origin")
    try:
        parsed = urlsplit(raw)
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Malformed origin") from exc
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Malformed origin")
    host = parsed.hostname.lower()
    if host.endswith("."):
        host = host[:-1]
    is_local = host in {
        "localhost",
        "127.0.0.1",
        "::1",
        "shop.zolexora.local",
        "mahilamadel.local",
    }
    if parsed.scheme != "https" and not (allow_local_http and is_local):
        raise ValueError("Insecure origin")
    authority = f"[{host}]" if ":" in host else host
    if port is not None:
        authority = f"{authority}:{port}"
    return f"{parsed.scheme}://{authority}"


class StorefrontRegistry:
    def __init__(
        self,
        storefronts: tuple[StorefrontDefinition, ...],
        surface_hosts: dict[str, ApplicationSurface],
        *,
        development: bool = False,
    ) -> None:
        if not storefronts:
            raise ValueError("At least one storefront is required")
        self.development = development
        self._by_key: dict[StorefrontKey, StorefrontDefinition] = {}
        self._by_host: dict[str, StorefrontDefinition] = {}
        self._by_origin: dict[str, StorefrontDefinition] = {}
        self._surface_hosts: dict[str, ApplicationSurface] = {}

        for definition in storefronts:
            self._add_storefront(definition)
        for raw_host, surface in surface_hosts.items():
            host = normalize_host(raw_host, allow_port=development)
            if host in self._by_host or host in self._surface_hosts:
                raise ValueError("Surface host collision")
            self._surface_hosts[host] = surface

    def _add_storefront(self, definition: StorefrontDefinition) -> None:
        if not str(definition.key).strip() or not definition.display_name.strip():
            raise ValueError("Storefront key and display name are required")
        if definition.key in self._by_key:
            raise ValueError("Duplicate storefront key")
        canonical = normalize_host(definition.canonical_host)
        hosts = frozenset(normalize_host(host, allow_port=self.development) for host in definition.hosts)
        if canonical not in hosts:
            raise ValueError("Canonical host must be registered")
        origins = frozenset(
            normalize_origin(origin, allow_local_http=self.development)
            for origin in definition.origins
        )
        normalized = replace(definition, canonical_host=canonical, hosts=hosts, origins=origins)
        for host in hosts:
            if host in self._by_host:
                raise ValueError("Duplicate storefront host")
        for origin in origins:
            if origin in self._by_origin and self._by_origin[origin].key != definition.key:
                raise ValueError("Duplicate storefront origin")
        self._by_key[definition.key] = normalized
        self._by_host.update({host: normalized for host in hosts})
        self._by_origin.update({origin: normalized for origin in origins})

    def by_key(self, key: StorefrontKey) -> StorefrontDefinition | None:
        return self._by_key.get(key)

    def by_host(self, host: str) -> StorefrontDefinition | None:
        return self._by_host.get(host)

    def by_origin(self, origin: str) -> StorefrontDefinition | None:
        return self._by_origin.get(origin)

    def surface_for_host(self, host: str) -> ApplicationSurface | None:
        return self._surface_hosts.get(host)

    async def get_definition_by_host(self, host: str) -> StorefrontDefinition | None:
        return self.by_host(host)

    async def get_definition_by_origin(self, origin: str) -> StorefrontDefinition | None:
        return self.by_origin(origin)

    async def get_definition_by_key(self, key: StorefrontKey) -> StorefrontDefinition | None:
        return self.by_key(key)

    async def get_surface_by_host(self, host: str) -> ApplicationSurface | None:
        return self.surface_for_host(host)


def build_registry(*, development: bool) -> StorefrontRegistry:
    zolexora_hosts = {"shop.zolexora.com"}
    zolexora_origins = {"https://shop.zolexora.com"}
    mahila_hosts = {"mahilamadel.store", "www.mahilamadel.store"}
    mahila_origins = {"https://mahilamadel.store", "https://www.mahilamadel.store"}
    surface_hosts: dict[str, ApplicationSurface] = {
        "api.zolexora.com": ApplicationSurface.SHARED_API,
        "seller.zolexora.com": ApplicationSurface.SELLER_PORTAL,
        "admin.marketplace.zolexora.com": ApplicationSurface.MARKETPLACE_ADMIN,
    }
    if development:
        zolexora_hosts.add("shop.zolexora.local")
        zolexora_origins.update({"http://localhost:3000", "http://127.0.0.1:3000"})
        mahila_hosts.add("mahilamadel.local")
        mahila_origins.update({"http://localhost:3003", "http://127.0.0.1:3003"})
        surface_hosts.update(
            {
                "localhost:4100": ApplicationSurface.SHARED_API,
                "127.0.0.1:4100": ApplicationSurface.SHARED_API,
                "localhost:3001": ApplicationSurface.SELLER_PORTAL,
                "127.0.0.1:3001": ApplicationSurface.SELLER_PORTAL,
                "localhost:3002": ApplicationSurface.MARKETPLACE_ADMIN,
                "127.0.0.1:3002": ApplicationSurface.MARKETPLACE_ADMIN,
            }
        )
    return StorefrontRegistry(
        (
            StorefrontDefinition(
                "bootstrap-zolexora-shop",
                StorefrontKey.ZOLEXORA_SHOP,
                "Zolexora Shop",
                "shop.zolexora.com",
                frozenset(zolexora_hosts),
                frozenset(zolexora_origins),
            ),
            StorefrontDefinition(
                "bootstrap-mahila-madel",
                StorefrontKey.MAHILA_MADEL,
                "Mahila Madel",
                "mahilamadel.store",
                frozenset(mahila_hosts),
                frozenset(mahila_origins),
            ),
        ),
        surface_hosts,
        development=development,
    )
