import pytest
from fastapi import HTTPException

from tests.commerce_seed import BUYER_1, BUYER_2, ORDER_1, ORDER_2, ORDER_3, SEL_1, seed_order
from routers.orders import list_buyer_orders, list_seller_orders, legacy_get_order, update_order_status
from storefronts.models import StorefrontContext, StorefrontDefinition, StorefrontContextSource, StorefrontKey

def create_context(key_str: str) -> StorefrontContext:
    key = StorefrontKey(key_str)
    return StorefrontContext(
        storefront=StorefrontDefinition(
            id=f"store_{key_str}",
            key=key,
            display_name=key_str,
            canonical_host=f"{key_str}.example.com",
            hosts=frozenset([f"{key_str}.example.com"]),
            origins=frozenset([f"https://{key_str}.example.com"])
        ),
        source=StorefrontContextSource.HOST
    )

ctx_zol = create_context("zolexora-shop")
ctx_mah = create_context("mahila-madel")
seller = {"id": "seller-1", "role": "seller", "seller_org_id": SEL_1}
admin = {"id": "admin-1", "is_admin": True}
buyer_1 = {"id": BUYER_1, "role": "viewer"}
buyer_2 = {"id": BUYER_2, "role": "viewer"}

# Product (catalog) storefront isolation: tests/test_catalog_store.py

@pytest.mark.asyncio
async def test_orders_isolation(pg):
    await seed_order(pg, ORDER_1, buyer=BUYER_1, storefront="zolexora-shop", status="processing")
    await seed_order(pg, ORDER_2, buyer=BUYER_1, storefront="mahila-madel", status="processing")
    await seed_order(pg, ORDER_3, buyer=BUYER_2, storefront="zolexora-shop", status="processing")
    
    # Buyer list returns only current storefront orders
    my_zol = await list_buyer_orders(user=buyer_1, context=ctx_zol, pg=pg)
    assert [o.order_id for o in my_zol] == [ORDER_1]
    
    # Two buyers in same storefront isolated
    my_zol2 = await list_buyer_orders(user=buyer_2, context=ctx_zol, pg=pg)
    assert [o.order_id for o in my_zol2] == [ORDER_3]
    
    # Cross-storefront record-by-id fails
    with pytest.raises(HTTPException):
        await legacy_get_order(ORDER_2, user=buyer_1, context=ctx_zol, pg=pg)
    
    # Cross-owner record-by-id fails
    with pytest.raises(HTTPException):
        await legacy_get_order(ORDER_3, user=buyer_1, context=ctx_zol, pg=pg)
    
    # Seller isolated list
    sel_zol = await list_seller_orders(user=seller, context=ctx_zol, pg=pg)
    assert len(sel_zol) == 2
    
    # Update status cross-storefront fails
    with pytest.raises(HTTPException):
        await update_order_status(ORDER_2, status="shipped", user=seller, context=ctx_zol, pg=pg)
