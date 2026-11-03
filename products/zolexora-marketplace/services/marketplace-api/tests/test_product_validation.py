import pytest
from pydantic import ValidationError

from routers.products import ProductCreate, ProductUpdate


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


# Route behaviour (grants, create, update, delete): tests/test_catalog_store.py


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


def test_update_product_invalid_price_fails():
    with pytest.raises(ValidationError):
        ProductUpdate(price=-10.0)


def test_update_product_negative_stock_fails():
    with pytest.raises(ValidationError):
        ProductUpdate(stock=-5)


def test_update_product_cannot_spoof_seller_id():
    with pytest.raises(ValidationError):
        ProductUpdate(seller_id="other-seller-id")
