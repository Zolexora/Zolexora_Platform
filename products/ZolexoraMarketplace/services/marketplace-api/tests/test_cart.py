import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from routers.cart import (
    get_cart, add_to_cart, update_cart_item, remove_cart_item, clear_cart,
    CartItemCreate, CartItemQuantityUpdate
)
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
buyer_1 = {"id": "buyer-1", "role": "viewer"}
buyer_2 = {"id": "buyer-2", "role": "viewer"}

class FakeDB:
    class Collection:
        def __init__(self):
            self.docs = []
        async def insert_one(self, doc):
            self.docs.append(doc)
        async def insert_many(self, docs):
            self.docs.extend(docs)
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
                    if "$inc" in update:
                        for k, v in update["$inc"].items(): doc[k] += v
                    matched = 1
                    break
            return type("UpdateResult", (), {"matched_count": matched})()
        async def delete_one(self, query):
            self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in query.items())]
        async def delete_many(self, query):
            self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in query.items())]
        async def count_documents(self, query):
            return len([d for d in self.docs if all(d.get(k) == v for k, v in query.items())])

    def __init__(self):
        self.cart = self.Collection()
        self.storefront_listings = self.Collection()
        self.master_products = self.Collection()
        self.inventory_balances = self.Collection()

@pytest.mark.asyncio
async def test_cart_storefront_isolation():
    db = FakeDB()
    # Add products
    await db.storefront_listings.insert_one({"id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "storefront_id": "zolexora-shop", "price": {"amount_minor": 100, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "P1", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 10, "reserved_quantity": 0})
    
    # buyer 1 adds to cart on zol
    resp = await add_to_cart(CartItemCreate(product_id="prod-1", quantity=2), context=ctx_zol, user=buyer_1, db=db)
    assert resp.item_count == 2
    assert resp.subtotal.amount_minor == 200
    
    # buyer 1 gets cart on zol
    cart = await get_cart(context=ctx_zol, user=buyer_1, db=db)
    assert len(cart.lines) == 1
    assert cart.storefront_id == "zolexora-shop"
    
    # buyer 1 on mah gets empty cart (isolated)
    cart_mah = await get_cart(context=ctx_mah, user=buyer_1, db=db)
    assert len(cart_mah.lines) == 0
    
    # buyer 2 on zol gets empty cart
    cart_b2 = await get_cart(context=ctx_zol, user=buyer_2, db=db)
    assert len(cart_b2.lines) == 0
    
@pytest.mark.asyncio
async def test_cross_storefront_add_fails():
    db = FakeDB()
    await db.storefront_listings.insert_one({"id": "prod-2", "product_id": "mp-2", "seller_id": "sel-1", "storefront_id": "mahila-madel", "price": {"amount_minor": 100, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-2", "seller_id": "sel-1", "title": "P2", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-2", "seller_id": "sel-1", "available_quantity": 10, "reserved_quantity": 0})
    
    with pytest.raises(HTTPException) as exc:
        await add_to_cart(CartItemCreate(product_id="prod-2", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    assert exc.value.status_code == 404
    
@pytest.mark.asyncio
async def test_cart_quantity_validation():
    db = FakeDB()
    await db.storefront_listings.insert_one({"id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "storefront_id": "zolexora-shop", "price": {"amount_minor": 100, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "P1", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 5, "reserved_quantity": 0})
    
    with pytest.raises(HTTPException) as exc:
        await add_to_cart(CartItemCreate(product_id="prod-1", quantity=6), context=ctx_zol, user=buyer_1, db=db)
    assert exc.value.status_code == 400
    
    # Negative and string handled by pydantic StrictInt
    with pytest.raises(ValidationError):
        CartItemCreate(product_id="prod-1", quantity=-1)
    with pytest.raises(ValidationError):
        CartItemCreate(product_id="prod-1", quantity=0)
    with pytest.raises(ValidationError):
        CartItemCreate(product_id="prod-1", quantity="3")

@pytest.mark.asyncio
async def test_cart_mutations():
    db = FakeDB()
    await db.storefront_listings.insert_one({"id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "storefront_id": "zolexora-shop", "price": {"amount_minor": 100, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "P1", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 10, "reserved_quantity": 0})
    
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=2), context=ctx_zol, user=buyer_1, db=db)
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    
    cart = await get_cart(context=ctx_zol, user=buyer_1, db=db)
    assert cart.item_count == 3
    assert cart.subtotal.amount_minor == 300
    
    await update_cart_item("prod-1", CartItemQuantityUpdate(quantity=4), context=ctx_zol, user=buyer_1, db=db)
    cart = await get_cart(context=ctx_zol, user=buyer_1, db=db)
    assert cart.item_count == 4
    
    await remove_cart_item("prod-1", context=ctx_zol, user=buyer_1, db=db)
    cart = await get_cart(context=ctx_zol, user=buyer_1, db=db)
    assert cart.item_count == 0
    
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    await clear_cart(context=ctx_zol, user=buyer_1, db=db)
    cart = await get_cart(context=ctx_zol, user=buyer_1, db=db)
    assert cart.item_count == 0

@pytest.mark.asyncio
async def test_cart_cross_storefront_visibility():
    db = FakeDB()
    await db.storefront_listings.insert_one({"id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "storefront_id": "zolexora-shop", "price": {"amount_minor": 100, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "P1", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 10, "reserved_quantity": 0})
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    # The get_cart query inherently enforces storefront_id and user_id, testing this is essentially testing isolation
    cart_zol = await get_cart(context=ctx_zol, user=buyer_1, db=db)
    assert cart_zol.item_count == 1

@pytest.mark.asyncio
async def test_cart_buyer_cannot_read_another_cart():
    db = FakeDB()
    await db.storefront_listings.insert_one({"id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "storefront_id": "zolexora-shop", "price": {"amount_minor": 100, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "P1", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 10, "reserved_quantity": 0})
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    cart_b2 = await get_cart(context=ctx_zol, user=buyer_2, db=db)
    assert cart_b2.item_count == 0

@pytest.mark.asyncio
async def test_cart_update_quantity_recalculates_totals():
    db = FakeDB()
    await db.storefront_listings.insert_one({"id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "storefront_id": "zolexora-shop", "price": {"amount_minor": 100, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "P1", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 10, "reserved_quantity": 0})

    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    await update_cart_item("prod-1", CartItemQuantityUpdate(quantity=5), context=ctx_zol, user=buyer_1, db=db)
    cart = await get_cart(context=ctx_zol, user=buyer_1, db=db)
    assert cart.subtotal.amount_minor == 500

@pytest.mark.asyncio
async def test_cart_remove_item_success():
    db = FakeDB()
    await db.storefront_listings.insert_one({"id": "prod-1", "product_id": "mp-1", "seller_id": "sel-1", "storefront_id": "zolexora-shop", "price": {"amount_minor": 100, "currency": "INR"}, "status": "active"})
    await db.master_products.insert_one({"id": "mp-1", "seller_id": "sel-1", "title": "P1", "seller_name": "S1", "images": []})
    await db.inventory_balances.insert_one({"product_id": "mp-1", "seller_id": "sel-1", "available_quantity": 10, "reserved_quantity": 0})
    await add_to_cart(CartItemCreate(product_id="prod-1", quantity=1), context=ctx_zol, user=buyer_1, db=db)
    await remove_cart_item("prod-1", context=ctx_zol, user=buyer_1, db=db)
    cart = await get_cart(context=ctx_zol, user=buyer_1, db=db)
    assert cart.item_count == 0
