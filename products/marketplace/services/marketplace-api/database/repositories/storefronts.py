import uuid

import asyncpg

from storefronts.models import ApplicationSurface, StorefrontDefinition, StorefrontKey
from storefronts.registry import StorefrontRegistry

SURFACES = {
    "api.zolexora.com": ApplicationSurface.SHARED_API,
    "seller.zolexora.com": ApplicationSurface.SELLER_PORTAL,
    "admin.marketplace.zolexora.com": ApplicationSurface.MARKETPLACE_ADMIN,
}


class StorefrontRepositoryError(RuntimeError):
    pass


_STOREFRONT_CACHE: dict[str, StorefrontDefinition | None] = {}


class PostgresStorefrontRepository:
    def __init__(self, connection: asyncpg.Connection | None = None, *, development: bool = False):
        self.connection = connection
        self.development = development

    async def _execute_fetch(self, query: str, *args):
        if self.connection is not None:
            return await self.connection.fetch(query, *args)
        from shared.database.postgres import connection as pg_conn
        async with pg_conn() as conn:
            return await conn.fetch(query, *args)

    async def _execute_fetchrow(self, query: str, *args):
        if self.connection is not None:
            return await self.connection.fetchrow(query, *args)
        from shared.database.postgres import connection as pg_conn
        async with pg_conn() as conn:
            return await conn.fetchrow(query, *args)

    async def _build_definition(self, store_id: str) -> StorefrontDefinition | None:
        rows = await self._execute_fetch(
            """
            SELECT s.id, s.storefront_key, s.display_name, s.currency, s.locale, s.is_active as s_active,
                   d.hostname, d.environment, d.domain_role, d.is_active as d_active
            FROM storefront AS s
            JOIN storefront_domain AS d ON d.storefront_id = s.id
            WHERE s.id = $1 AND s.is_active = true AND d.is_active = true
            """,
            store_id
        )
        if not rows:
            return None
            
        first = rows[0]
        primary = [row["hostname"] for row in rows if row["environment"] == "production" and row["domain_role"] == "primary"]
        if len(primary) != 1:
            raise StorefrontRepositoryError("Storefront primary domain is invalid")
            
        hosts = {row["hostname"] for row in rows if row["environment"] == "production" or self.development}
        origins = {f"https://{row['hostname']}" for row in rows if row["environment"] == "production"}
        
        if self.development and first["storefront_key"] == "zolexora-shop":
            hosts |= {"localhost:3000", "127.0.0.1:3000", "shop.zolexora.local"}
            origins |= {"http://localhost:3000", "http://127.0.0.1:3000", "http://shop.zolexora.local"}
        elif self.development and first["storefront_key"] == "mahila-madel":
            hosts |= {"localhost:3003", "127.0.0.1:3003", "mahilamadel.local"}
            origins |= {"http://localhost:3003", "http://127.0.0.1:3003", "http://mahilamadel.local"}
            
        return StorefrontDefinition(
            str(first["id"]), StorefrontKey(first["storefront_key"]), first["display_name"], primary[0],
            frozenset(hosts), frozenset(origins), first["currency"], first["locale"], True,
        )

    async def get_definition_by_host(self, host: str) -> StorefrontDefinition | None:
        cache_key = f"host:{host}:{self.development}"
        if cache_key in _STOREFRONT_CACHE:
            return _STOREFRONT_CACHE[cache_key]

        if self.development and host in {"localhost:3000", "127.0.0.1:3000", "shop.zolexora.local"}:
            res = await self.get_definition_by_key(StorefrontKey.ZOLEXORA_SHOP)
            _STOREFRONT_CACHE[cache_key] = res
            return res
        if self.development and host in {"localhost:3003", "127.0.0.1:3003", "mahilamadel.local"}:
            res = await self.get_definition_by_key(StorefrontKey.MAHILA_MADEL)
            _STOREFRONT_CACHE[cache_key] = res
            return res
        row = await self._execute_fetchrow(
            """
            SELECT s.id
            FROM storefront AS s
            JOIN storefront_domain AS d ON d.storefront_id = s.id
            WHERE s.is_active = true AND d.is_active = true AND d.hostname = $1
            """,
            host
        )
        res = None
        if row:
            res = await self._build_definition(row["id"])
        _STOREFRONT_CACHE[cache_key] = res
        return res

    async def get_definition_by_origin(self, origin: str) -> StorefrontDefinition | None:
        if self.development and origin in {"http://localhost:3000", "http://127.0.0.1:3000", "http://shop.zolexora.local"}:
            return await self.get_definition_by_key(StorefrontKey.ZOLEXORA_SHOP)
        if self.development and origin in {"http://localhost:3003", "http://127.0.0.1:3003", "http://mahilamadel.local"}:
            return await self.get_definition_by_key(StorefrontKey.MAHILA_MADEL)
        from urllib.parse import urlsplit
        try:
            parsed = urlsplit(origin)
            host = parsed.hostname
            if parsed.port:
                host = f"{host}:{parsed.port}"
        except Exception:
            return None
        return await self.get_definition_by_host(host)

    async def get_definition_by_key(self, key: StorefrontKey) -> StorefrontDefinition | None:
        cache_key = f"key:{key.value}:{self.development}"
        if cache_key in _STOREFRONT_CACHE:
            return _STOREFRONT_CACHE[cache_key]

        row = await self._execute_fetchrow(
            "SELECT id FROM storefront WHERE is_active = true AND storefront_key = $1",
            key.value
        )
        res = None
        if row:
            res = await self._build_definition(row["id"])
        _STOREFRONT_CACHE[cache_key] = res
        return res

    async def get_surface_by_host(self, host: str) -> ApplicationSurface | None:
        surfaces = dict(SURFACES)
        if self.development:
            surfaces |= {
                "localhost:8000": ApplicationSurface.SHARED_API,
                "127.0.0.1:8000": ApplicationSurface.SHARED_API,
                "localhost:3001": ApplicationSurface.SELLER_PORTAL,
                "127.0.0.1:3001": ApplicationSurface.SELLER_PORTAL,
                "localhost:3002": ApplicationSurface.MARKETPLACE_ADMIN,
                "127.0.0.1:3002": ApplicationSurface.MARKETPLACE_ADMIN,
            }
        return surfaces.get(host)

    async def load_registry(self) -> StorefrontRegistry:
        from storefronts.registry import build_registry
        return build_registry(development=self.development)


BOOTSTRAP = {
    "zolexora-shop": (
        uuid.UUID("60000000-0000-4000-8000-000000000001"),
        "Zolexora Shop",
        "INR",
        "en-IN",
        (
            (uuid.UUID("70000000-0000-4000-8000-000000000001"), "shop.zolexora.com", "production", "primary"),
            (uuid.UUID("70000000-0000-4000-8000-000000000002"), "shop.zolexora.local", "development", "development"),
        ),
    ),
    "mahila-madel": (
        uuid.UUID("60000000-0000-4000-8000-000000000002"),
        "Mahila Madel",
        "INR",
        "en-IN",
        (
            (uuid.UUID("70000000-0000-4000-8000-000000000003"), "mahilamadel.store", "production", "primary"),
            (uuid.UUID("70000000-0000-4000-8000-000000000004"), "www.mahilamadel.store", "production", "alias"),
            (uuid.UUID("70000000-0000-4000-8000-000000000005"), "mahilamadel.local", "development", "development"),
        ),
    ),
}


async def bootstrap_storefronts(connection: asyncpg.Connection, *, dry_run: bool = True) -> list[str]:
    existing_domains = dict(await connection.fetch("SELECT hostname, storefront_id FROM storefront_domain"))
    existing_stores = dict(await connection.fetch("SELECT storefront_key, id FROM storefront"))
    actions: list[str] = []
    try:
        async with connection.transaction():
            for key, (store_id, name, currency, locale, domains) in BOOTSTRAP.items():
                if key not in existing_stores:
                    actions.append(f"create storefront {key}")
                    if not dry_run:
                        await connection.execute(
                            "INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale) VALUES ($1,$2,$3,true,$4,$5) ON CONFLICT (storefront_key) DO NOTHING",
                            store_id, key, name, currency, locale,
                        )
                for domain_id, hostname, environment, role in domains:
                    owner = existing_domains.get(hostname)
                    if owner and owner != store_id:
                        raise StorefrontRepositoryError(f"Domain ownership conflict: {hostname}")
                    if not owner:
                        actions.append(f"create domain {hostname}")
                        if not dry_run:
                            await connection.execute(
                                "INSERT INTO storefront_domain (id, storefront_id, hostname, environment, domain_role, is_active) VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (hostname) DO NOTHING",
                                domain_id, store_id, hostname, environment, role,
                            )
            if dry_run:
                raise _DryRunRollback
    except _DryRunRollback:
        pass
    return actions


class _DryRunRollback(Exception):
    """Internal transaction rollback marker for dry-run bootstrap."""
