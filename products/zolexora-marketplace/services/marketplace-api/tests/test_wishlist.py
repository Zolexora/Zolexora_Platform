"""A buyer's wishlist per storefront, in PostgreSQL; it lists only products still for sale."""

import pytest
from fastapi import HTTPException

from routers.wishlist import get_wishlist, remove_wishlist_item, toggle_wishlist_item
from tests.commerce_seed import BUYER_1, BUYER_2, PROD_1, PROD_2, seed_listing
from tests.test_storefront_isolation import ctx_mah, ctx_zol

buyer_1, buyer_2 = {"id": BUYER_1}, {"id": BUYER_2}


@pytest.mark.asyncio
async def test_toggle_adds_and_removes_per_buyer_and_storefront(pg):
    await seed_listing(pg, PROD_1, title="Silk Saree")
    out = await toggle_wishlist_item(PROD_1, context=ctx_zol, user=buyer_1, pg=pg)
    assert out["added"] is True and [p.title for p in out["wishlist"]] == ["Silk Saree"]
    assert await get_wishlist(context=ctx_zol, user=buyer_2, pg=pg) == []
    assert await get_wishlist(context=ctx_mah, user=buyer_1, pg=pg) == []

    out = await toggle_wishlist_item(PROD_1, context=ctx_zol, user=buyer_1, pg=pg)
    assert out["added"] is False and out["wishlist"] == []


@pytest.mark.asyncio
async def test_only_products_for_sale_are_added_or_listed(pg):
    await seed_listing(pg, PROD_1, storefront="mahila-madel")
    with pytest.raises(HTTPException) as exc:  # another storefront's product
        await toggle_wishlist_item(PROD_1, context=ctx_zol, user=buyer_1, pg=pg)
    assert exc.value.status_code == 404

    await seed_listing(pg, PROD_2)
    await toggle_wishlist_item(PROD_2, context=ctx_zol, user=buyer_1, pg=pg)
    await pg.execute("UPDATE storefront_listing SET publication_state = 'HIDDEN' WHERE id = $1::uuid", PROD_2)
    assert await get_wishlist(context=ctx_zol, user=buyer_1, pg=pg) == []
    assert (await remove_wishlist_item(PROD_2, context=ctx_zol, user=buyer_1, pg=pg))["success"] is True
    assert (await remove_wishlist_item("not-a-uuid", context=ctx_zol, user=buyer_1, pg=pg))["success"] is False
