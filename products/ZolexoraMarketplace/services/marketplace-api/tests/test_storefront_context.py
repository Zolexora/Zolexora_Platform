import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from main import app
from storefronts.models import ApplicationSurface, StorefrontDefinition, StorefrontKey
from storefronts.registry import StorefrontRegistry, build_registry, normalize_host, normalize_origin
from storefronts.resolver import StorefrontResolutionError, resolve_storefront


def definition(key=StorefrontKey.ZOLEXORA_SHOP, *, enabled=True, hosts=None, canonical=None, origins=None):
    canonical = canonical or "shop.zolexora.com"
    return StorefrontDefinition(
        "test-storefront-id",
        key,
        "Store" if key else "",
        canonical,
        frozenset(hosts or {canonical}),
        frozenset(origins or {f"https://{canonical}"}),
        enabled=enabled,
    )


def request(headers):
    raw = [(key.lower().encode(), value.encode()) for key, value in headers]
    return Request({"type": "http", "method": "GET", "path": "/", "headers": raw})


def test_registry_contains_exact_canonical_storefronts():
    registry = build_registry(development=False)
    assert registry.by_key(StorefrontKey.ZOLEXORA_SHOP).canonical_host == "shop.zolexora.com"
    assert registry.by_key(StorefrontKey.MAHILA_MADEL).canonical_host == "mahilamadel.store"


@pytest.mark.parametrize(
    "storefronts,surfaces",
    [
        ((definition(), definition()), {}),
        ((definition(), definition(StorefrontKey.MAHILA_MADEL, hosts={"shop.zolexora.com"}, canonical="shop.zolexora.com")), {}),
        ((definition(hosts={"alias.example"}),), {}),
        ((definition(),), {"shop.zolexora.com": ApplicationSurface.SHARED_API}),
        ((definition(canonical="bad/path"),), {}),
    ],
)
def test_invalid_registry_definitions_fail(storefronts, surfaces):
    with pytest.raises(ValueError):
        StorefrontRegistry(storefronts, surfaces)


@pytest.mark.parametrize("value", ["", "bad/path", "user@example.com", "host:bad", "host..example"])
def test_malformed_hosts_fail(value):
    with pytest.raises(ValueError):
        normalize_host(value)


@pytest.mark.parametrize(
    "host,key",
    [
        ("shop.zolexora.com", StorefrontKey.ZOLEXORA_SHOP),
        ("SHOP.ZOLEXORA.COM", StorefrontKey.ZOLEXORA_SHOP),
        ("shop.zolexora.com.", StorefrontKey.ZOLEXORA_SHOP),
        ("mahilamadel.store", StorefrontKey.MAHILA_MADEL),
        ("www.mahilamadel.store", StorefrontKey.MAHILA_MADEL),
    ],
)
@pytest.mark.asyncio
async def test_exact_customer_hosts_resolve(host, key):
    context = await resolve_storefront(request([("host", host)]), build_registry(development=False))
    assert context.key == key


@pytest.mark.asyncio
async def test_development_hosts_and_ports_are_environment_scoped():
    dev = build_registry(development=True)
    assert (await resolve_storefront(request([("host", "shop.zolexora.local")]), dev)).key == StorefrontKey.ZOLEXORA_SHOP
    assert dev.surface_for_host("localhost:4100") == ApplicationSurface.SHARED_API
    with pytest.raises(StorefrontResolutionError):
        await resolve_storefront(request([("host", "shop.zolexora.local")]), build_registry(development=False))


@pytest.mark.parametrize(
    "origin,key",
    [
        ("https://shop.zolexora.com", StorefrontKey.ZOLEXORA_SHOP),
        ("https://mahilamadel.store", StorefrontKey.MAHILA_MADEL),
        ("https://www.mahilamadel.store", StorefrontKey.MAHILA_MADEL),
    ],
)
@pytest.mark.asyncio
async def test_shared_api_resolves_exact_origin(origin, key):
    context = await resolve_storefront(
        request([("host", "api.zolexora.com"), ("origin", origin)]),
        build_registry(development=False),
    )
    assert context.key == key


@pytest.mark.parametrize(
    "origin",
    [
        "null",
        "http://shop.zolexora.com",
        "https://user@shop.zolexora.com",
        "https://shop.zolexora.com/path",
        "https://shop.zolexora.com?next=mahilamadel.store",
        "https://shop.zolexora.com.evil.example",
        "https://evil-shop.zolexora.com",
        "https://mahilamadel.store.evil.example",
        "https://evil.example/?mahilamadel.store",
    ],
)
@pytest.mark.asyncio
async def test_invalid_or_lookalike_origins_fail(origin):
    with pytest.raises(StorefrontResolutionError):
        await resolve_storefront(
            request([("host", "api.zolexora.com"), ("origin", origin)]),
            build_registry(development=False),
        )


@pytest.mark.parametrize("key", ["zolexora-shop", "mahila-madel"])
@pytest.mark.asyncio
async def test_mobile_hint_resolves_on_shared_api(key):
    context = await resolve_storefront(
        request([("host", "api.zolexora.com"), ("x-storefront-key", key)]),
        build_registry(development=False),
    )
    assert context.key.value == key
    assert not hasattr(context, "authenticated")


@pytest.mark.parametrize("key", ["", "unknown", "zolexora-shop,mahila-madel"])
@pytest.mark.asyncio
async def test_invalid_mobile_hint_fails(key):
    with pytest.raises(StorefrontResolutionError):
        await resolve_storefront(
            request([("host", "api.zolexora.com"), ("x-storefront-key", key)]),
            build_registry(development=False),
        )


@pytest.mark.asyncio
async def test_repeated_mobile_hint_fails():
    with pytest.raises(StorefrontResolutionError):
        await resolve_storefront(
            request([("host", "api.zolexora.com"), ("x-storefront-key", "zolexora-shop"), ("x-storefront-key", "zolexora-shop")]),
            build_registry(development=False),
        )


@pytest.mark.parametrize(
    "headers",
    [
        [("host", "shop.zolexora.com"), ("x-storefront-key", "mahila-madel")],
        [("host", "mahilamadel.store"), ("x-storefront-key", "zolexora-shop")],
        [("host", "api.zolexora.com"), ("origin", "https://shop.zolexora.com"), ("x-storefront-key", "mahila-madel")],
        [("host", "api.zolexora.com"), ("origin", "https://mahilamadel.store"), ("x-storefront-key", "zolexora-shop")],
        [("host", "seller.zolexora.com"), ("x-storefront-key", "zolexora-shop")],
        [("host", "admin.marketplace.zolexora.com"), ("x-storefront-key", "mahila-madel")],
        [("host", "seller.zolexora.com"), ("origin", "https://shop.zolexora.com")],
        [("host", "admin.marketplace.zolexora.com"), ("origin", "https://mahilamadel.store")],
    ],
)
@pytest.mark.asyncio
async def test_conflicting_context_fails_closed(headers):
    with pytest.raises(StorefrontResolutionError) as error:
        await resolve_storefront(request(headers), build_registry(development=False))
    assert error.value.code.value == "storefront_context_mismatch"


@pytest.mark.asyncio
async def test_retired_admin_hostname_fails_closed():
    registry = build_registry(development=False)
    assert registry.surface_for_host("marketplaceadmin.zolexora.com") is None
    assert registry.by_host("marketplaceadmin.zolexora.com") is None
    with pytest.raises(StorefrontResolutionError):
        await resolve_storefront(request([("host", "marketplaceadmin.zolexora.com")]), registry)



@pytest.mark.parametrize("header", ["x-forwarded-host", "forwarded", "x-original-host"])
@pytest.mark.asyncio
async def test_forged_forwarding_headers_do_not_change_direct_host(header):
    context = await resolve_storefront(
        request([("host", "shop.zolexora.com"), (header, "mahilamadel.store")]),
        build_registry(development=False),
    )
    assert context.key == StorefrontKey.ZOLEXORA_SHOP


@pytest.mark.parametrize("host", ["shop.zolexora.com.evil.example", "evil-shop.zolexora.com", "zolexora.com", "mahilamadel.store.evil.example"])
@pytest.mark.asyncio
async def test_unknown_and_suffix_attack_hosts_fail(host):
    with pytest.raises(StorefrontResolutionError):
        await resolve_storefront(request([("host", host)]), build_registry(development=False))


@pytest.mark.asyncio
async def test_optional_resolution_has_no_default_and_disabled_fails_closed():
    registry = build_registry(development=False)
    assert await resolve_storefront(request([("host", "api.zolexora.com")]), registry) is None
    disabled = StorefrontRegistry((definition(enabled=False),), {})
    with pytest.raises(StorefrontResolutionError) as error:
        await resolve_storefront(request([("host", "shop.zolexora.com")]), disabled)
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_context_endpoint_and_request_isolation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://api.zolexora.com") as client:
        missing = await client.get("/api/storefront/context")
        zolexora, mahila = await asyncio.gather(
            client.get("/api/storefront/context", headers={"X-Storefront-Key": "zolexora-shop"}),
            client.get("/api/storefront/context", headers={"X-Storefront-Key": "mahila-madel"}),
        )
        again = await client.get("/api/storefront/context", headers={"X-Storefront-Key": "zolexora-shop"})
    assert missing.status_code == 400
    assert missing.json()["code"] == "storefront_context_required"
    assert [zolexora.json()["key"], mahila.json()["key"], again.json()["key"]] == [
        "zolexora-shop", "mahila-madel", "zolexora-shop"
    ]
    assert set(zolexora.json()) == {"key", "display_name", "canonical_host", "currency", "locale"}
    assert "payment" not in str(zolexora.json()).lower()


@pytest.mark.asyncio
async def test_health_and_exact_cors_preflight_regression():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://api.zolexora.com") as client:
        health = await client.get("/api/health")
        approved = await client.options(
            "/api/storefront/context",
            headers={
                "Origin": "https://shop.zolexora.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "X-Storefront-Key",
            },
        )
        rejected = await client.options(
            "/api/storefront/context",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
        )
    assert health.status_code == 200
    assert approved.status_code == 200
    assert approved.headers["access-control-allow-origin"] == "https://shop.zolexora.com"
    assert "X-Storefront-Key" in approved.headers["access-control-allow-headers"]
    assert rejected.headers.get("access-control-allow-origin") is None


def test_origin_parser_allows_only_explicit_local_http_mode():
    assert normalize_origin("http://localhost:3000", allow_local_http=True) == "http://localhost:3000"
    with pytest.raises(ValueError):
        normalize_origin("http://localhost:3000", allow_local_http=False)
