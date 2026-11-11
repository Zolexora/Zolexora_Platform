from typing import Annotated

from fastapi import APIRouter, Depends

from .dependencies import require_storefront_context
from .models import PublicStorefrontResponse, StorefrontContext

router = APIRouter(prefix="/storefront", tags=["storefront"])


@router.get("/context", response_model=PublicStorefrontResponse)
async def public_storefront_context(
    context: Annotated[StorefrontContext, Depends(require_storefront_context)],
) -> PublicStorefrontResponse:
    storefront = context.storefront
    return PublicStorefrontResponse(
        key=storefront.key,
        display_name=storefront.display_name,
        canonical_host=storefront.canonical_host,
        currency=storefront.currency,
        locale=storefront.locale,
    )
