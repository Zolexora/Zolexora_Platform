import pytest
from fastapi import HTTPException

from routers.other import my_orders, seller_orders, get_order, update_order_status
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
seller = {"id": "seller-1", "role": "seller"}
admin = {"id": "admin-1", "is_admin": True}
buyer_1 = {"id": "buyer-1", "role": "viewer"}
buyer_2 = {"id": "buyer-2", "role": "viewer"}

# Product (catalog) storefront isolation: tests/test_catalog_store.py

class OrderFakeDB:
    class OrderCollection:
        def __init__(self):
            self.docs = []
        async def insert_one(self, doc):
            self.docs.append(doc)
        def find(self, query, proj=None):
            class Cursor:
                def __init__(self, docs, q):
                    self.filtered = [d for d in docs if all(d.get(k) == v for k, v in q.items())]
                def sort(self, *args, **kwargs): return self
                async def to_list(self, limit): return self.filtered[:limit]
            return Cursor(self.docs, query)
        async def find_one(self, query, proj=None):
            for doc in self.docs:
                if all(doc.get(k) == v for k, v in query.items()): return doc
            return None
        async def update_one(self, query, update):
            matched = 0
            for doc in self.docs:
                if all(doc.get(k) == v for k, v in query.items()):
                    doc.update(update.get("$set", {}))
                    matched = 1
                    break
            return type("UpdateResult", (), {"matched_count": matched})()
    
    def __init__(self):
        self.orders = self.OrderCollection()

@pytest.mark.asyncio
async def test_orders_isolation():
    db = OrderFakeDB()
    await db.orders.insert_one({"id": "ord-1", "buyer_id": "buyer-1", "seller_id": "seller-1", "storefront_id": "zolexora-shop", "status": "processing"})
    await db.orders.insert_one({"id": "ord-2", "buyer_id": "buyer-1", "seller_id": "seller-1", "storefront_id": "mahila-madel", "status": "processing"})
    await db.orders.insert_one({"id": "ord-3", "buyer_id": "buyer-2", "seller_id": "seller-1", "storefront_id": "zolexora-shop", "status": "processing"})
    
    # Buyer list returns only current storefront orders
    my_zol = await my_orders(user=buyer_1, context=ctx_zol, db=db)
    assert len(my_zol) == 1 and my_zol[0]["id"] == "ord-1"
    
    # Two buyers in same storefront isolated
    my_zol2 = await my_orders(user=buyer_2, context=ctx_zol, db=db)
    assert len(my_zol2) == 1 and my_zol2[0]["id"] == "ord-3"
    
    # Cross-storefront record-by-id fails
    with pytest.raises(HTTPException):
        await get_order("ord-2", user=buyer_1, context=ctx_zol, db=db)
    
    # Cross-owner record-by-id fails
    with pytest.raises(HTTPException):
        await get_order("ord-3", user=buyer_1, context=ctx_zol, db=db)
    
    # Seller isolated list
    sel_zol = await seller_orders(user=seller, context=ctx_zol, db=db)
    assert len(sel_zol) == 2
    
    # Update status cross-storefront fails
    with pytest.raises(HTTPException):
        await update_order_status("ord-2", status="shipped", user=seller, context=ctx_zol, db=db)
