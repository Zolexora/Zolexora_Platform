from typing import Annotated

from fastapi import Depends, Request

from core.config import settings
from database.repositories.storefronts import PostgresStorefrontRepository
from database.session import connection

from .models import StorefrontContext, StorefrontResolutionCode
from .resolver import StorefrontResolutionError, resolve_storefront

class _TestRepository:
    def __init__(self):
        from .registry import build_registry
        self.development = not settings._is_production_runtime()
        self._registry = build_registry(development=self.development)

    async def get_definition_by_host(self, host: str):
        return self._registry.by_host(host)

    async def get_definition_by_origin(self, origin: str):
        return self._registry.by_origin(origin)

    async def get_definition_by_key(self, key):
        return self._registry.by_key(key)

    async def get_surface_by_host(self, host: str):
        return self._registry.surface_for_host(host)

async def storefront_repository():
    if settings._is_test_runtime():
        yield _TestRepository()
        return
    yield PostgresStorefrontRepository(None, development=not settings._is_production_runtime())

async def optional_storefront_context(
    request: Request,
    repository: Annotated[object, Depends(storefront_repository)],
) -> StorefrontContext | None:
    try:
        context = await resolve_storefront(request, repository)
    except StorefrontResolutionError:
        raise
    except Exception as exc:
        raise StorefrontResolutionError(
            StorefrontResolutionCode.UNAVAILABLE, "Storefront configuration is unavailable.", status_code=503
        ) from exc
    if context is not None:
        request.state.storefront_key = context.key.value
        request.state.storefront_source = context.source.value
    return context

async def require_storefront_context(
    context: Annotated[StorefrontContext | None, Depends(optional_storefront_context)],
) -> StorefrontContext:
    if context is None:
        raise StorefrontResolutionError(
            StorefrontResolutionCode.REQUIRED,
            "Storefront context is required.",
        )
    return context
