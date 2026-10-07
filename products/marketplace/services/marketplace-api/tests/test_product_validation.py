import pytest
from pydantic import ValidationError

from routers.products import ProductCreate, ProductUpdate, create_product, update_product


class ProductCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        self.docs.append(doc.copy())

    async def find_one(self, query):
        for doc in self.docs:
            if all(doc.get(key) == value for key, value in query.items()):
                return doc.copy()
        return None

    async def update_one(self, query, update):
        matched = 0
        for doc in self.docs:
            if all(doc.get(key) == value for key, value in query.items()):
                doc.update(update.get("$set", {}))
                matched = 1
                break
        return type("UpdateResult", (), {"matched_count": matched})()


class FakeDB:
    def __init__(self):
        self.storefront_listings = ProductCollection()
        self.master_products = ProductCollection()
        self.inventory_balances = ProductCollection()


SELLER = {"id": "seller-1", "name": "Test Seller", "role": "seller", "is_active": True}


def valid_product_payload(**overrides):
    payload = {
        "title": "A Valid Product",
        "description": "This is a valid product description.",
        "price": {"amount_minor": 19999, "currency": "INR"},
        "category": "Electronics",
        "stock": 50,
        "images": ["http://example.com/img1.jpg"],
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_create_product_valid_succeeds():
    db = FakeDB()

    data = ProductCreate(**valid_product_payload())
    from storefronts.models import StorefrontContext, StorefrontDefinition, StorefrontContextSource, StorefrontKey
    def _mock_context(): return StorefrontContext(storefront=StorefrontDefinition(id="sf_123", key=StorefrontKey.ZOLEXORA_SHOP, display_name="Shop", canonical_host="shop.zolexora.com", hosts=frozenset(), origins=frozenset(), currency="INR", locale="en-IN", enabled=True), source=StorefrontContextSource.HOST)
    dummy_context = _mock_context()
    response = await create_product(data, context=dummy_context, user=SELLER, db=db)

    assert response.title == "A Valid Product"
    assert response.seller_id == "seller-1"
    assert response.seller_name == "Test Seller"
    assert db.storefront_listings.docs[0]["seller_id"] == "seller-1"


def test_create_product_empty_title_fails():
    with pytest.raises(ValidationError):
        ProductCreate(**valid_product_payload(title="   "))


def test_create_product_price_lte_zero_fails():
    for invalid_price in [0, -5.5]:
        with pytest.raises(ValidationError):
            ProductCreate(**valid_product_payload(price=invalid_price))


def test_create_product_negative_stock_fails():
    with pytest.raises(ValidationError):
        ProductCreate(**valid_product_payload(stock=-1))


def test_create_product_non_integer_stock_fails():
    with pytest.raises(ValidationError):
        ProductCreate(**valid_product_payload(stock=1.5))


def test_create_product_invalid_images_fails():
    with pytest.raises(ValidationError):
        ProductCreate(**valid_product_payload(images=[123, ""]))


def test_create_product_cannot_spoof_seller_id():
    with pytest.raises(ValidationError):
        ProductCreate(**valid_product_payload(seller_id="malicious-seller-id"))


@pytest.mark.asyncio
async def test_update_product_valid_partial_succeeds():
    db = FakeDB()
    await db.storefront_listings.insert_one({
        "id": "prod-abc",
        "product_id": "master-abc",
        "price": {"amount_minor": 5000, "currency": "INR"},
        "seller_id": "seller-1",
        "storefront_id": "zolexora-shop",
        "status": "active",
    })
    await db.master_products.insert_one({
        "id": "master-abc",
        "seller_id": "seller-1",
        "title": "Original Title",
        "description": "Original description",
        "category": "Electronics"
    })

    from storefronts.models import StorefrontContext, StorefrontDefinition, StorefrontContextSource, StorefrontKey
    dummy_context = StorefrontContext(storefront=StorefrontDefinition(id="sf_123", key=StorefrontKey.ZOLEXORA_SHOP, display_name="Shop", canonical_host="shop.zolexora.com", hosts=frozenset(), origins=frozenset(), currency="INR", locale="en-IN", enabled=True), source=StorefrontContextSource.HOST)

    response = await update_product(
        "prod-abc",
        ProductUpdate(title="Updated Title", price={"amount_minor": 7550, "currency": "INR"}),
        context=dummy_context,
        user=SELLER,
        db=db,
    )

    assert response == {"message": "Updated"}
    listing = await db.storefront_listings.find_one({"id": "prod-abc"})
    master = await db.master_products.find_one({"id": "master-abc"})
    assert master["title"] == "Updated Title"
    assert listing["price"]["amount_minor"] == 7550
    assert master["description"] == "Original description"


def test_update_product_invalid_price_fails():
    with pytest.raises(ValidationError):
        ProductUpdate(price=-10.0)


def test_update_product_negative_stock_fails():
    with pytest.raises(ValidationError):
        ProductUpdate(stock=-5)


def test_update_product_cannot_spoof_seller_id():
    with pytest.raises(ValidationError):
        ProductUpdate(seller_id="other-seller-id")
