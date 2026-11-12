"""The products API on the PostgreSQL catalog: who may change what, and what shoppers see."""

import uuid
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

import routers.products as products
from routers.other import admin_delete_product, admin_toggle_product
from routers.products import BulkProductCreate, ProductCreate, ProductUpdate
from storefronts.models import StorefrontKey
from tests.test_portal_catalog_contracts import (
    ADMIN, OTHER_SELLER, ORG_SELLER_ID, SELLER, SF_SHOP_ID, context, pg_conn, setup_base_data,
)

__all__ = ["pg_conn"]

SHOP, MAHILA = context(StorefrontKey.ZOLEXORA_SHOP), context(StorefrontKey.MAHILA_MADEL)


@pytest.fixture
async def db(pg_conn):
    await setup_base_data(pg_conn)
    products._invalidate_catalog_cache()
    yield pg_conn
    products._invalidate_catalog_cache()


def payload(**overrides):
    return ProductCreate(**{
        "title": "Handloom Saree", "description": "Cotton, hand woven.",
        "price": {"amount_minor": 19999, "currency": "INR"}, "category": "Fashion",
        "stock": 50, "images": ["https://img.example/1.jpg"], "is_active": True, **overrides,
    })


async def create(db, user=SELLER, ctx=SHOP, **overrides):
    return await products.create_product(payload(**overrides), context=ctx, user=user, db=db)


async def shop_ids(db, ctx=SHOP):
    products._invalidate_catalog_cache()
    return [p.id for p in await products.list_products(context=ctx, db=db)]


@pytest.mark.asyncio
async def test_create_needs_a_grant_for_the_storefront(db):
    with pytest.raises(HTTPException) as exc:  # grants are on the shop only
        await create(db, ctx=MAHILA)
    assert exc.value.status_code == 403
    assert await db.fetchval("SELECT count(*) FROM master_product") == 0


@pytest.mark.asyncio
async def test_create_publishes_for_the_organisation(db):
    product = await create(db)
    assert product.seller_id == ORG_SELLER_ID and product.seller_name == SELLER["name"]
    assert product.title == "Handloom Saree" and product.stock == 50 and product.category == "Fashion"
    assert product.price.amount_minor == 19999 and product.images == ["https://img.example/1.jpg"]
    assert await shop_ids(db) == [product.id]
    assert await shop_ids(db, MAHILA) == []
    assert (await products.get_product(product.id, context=SHOP, db=db)).id == product.id
    assert [p.id for p in await products.my_products(user=SELLER, context=None, db=db)] == [product.id]
    assert await products.my_products(user=OTHER_SELLER, context=None, db=db) == []


@pytest.mark.asyncio
async def test_drafts_and_withdrawn_grants_are_not_shown(db):
    draft = await create(db, is_active=False)
    with pytest.raises(HTTPException):
        await products.get_product(draft.id, context=SHOP, db=db)
    live = await create(db)
    assert await shop_ids(db) == [live.id]
    await db.execute("UPDATE seller_storefront_grant SET revoked_at = now() WHERE storefront_id = $1", uuid.UUID(SF_SHOP_ID))
    assert await shop_ids(db) == []


@pytest.mark.asyncio
async def test_update_changes_product_price_and_stock(db):
    product = await create(db)
    await products.update_product(product.id, ProductUpdate(title="Silk Saree", price={"amount_minor": 25000, "currency": "INR"}, stock=7),
                                  context=SHOP, user=SELLER, db=db)
    products._invalidate_catalog_cache()
    updated = await products.get_product(product.id, context=SHOP, db=db)
    assert (updated.title, updated.price.amount_minor, updated.stock) == ("Silk Saree", 25000, 7)
    assert await db.fetchval("SELECT count(*) FROM inventory_audit_log") == 2  # created, then updated


@pytest.mark.asyncio
async def test_update_to_a_storefront_without_a_grant_is_refused(db):
    product = await create(db)
    with pytest.raises(HTTPException) as exc:
        await products.update_product(product.id, ProductUpdate(storefront_ids=["zolexora-shop", "mahila-madel"]),
                                      context=None, user=SELLER, db=db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_other_organisations_and_storefronts_cannot_change_it(db):
    product = await create(db)
    image = UploadFile(file=BytesIO(b"x"), filename="a.jpg")
    for call in (
        products.update_product(product.id, ProductUpdate(title="Mine"), context=SHOP, user=OTHER_SELLER, db=db),
        products.delete_product(product.id, context=SHOP, user=OTHER_SELLER, db=db),
        products.upload_image(product.id, file=image, context=SHOP, user=OTHER_SELLER, db=db),
        products.update_product(product.id, ProductUpdate(title="Mine"), context=MAHILA, user=SELLER, db=db),
        products.delete_product(product.id, context=MAHILA, user=SELLER, db=db),
    ):
        with pytest.raises(HTTPException) as exc:
            await call
        assert exc.value.status_code == 404
    assert await shop_ids(db) == [product.id]


@pytest.mark.asyncio
async def test_delete_removes_it_once(db):
    product = await create(db)
    assert await products.delete_product(product.id, context=SHOP, user=SELLER, db=db) == {"message": "Deleted"}
    assert await shop_ids(db) == []
    with pytest.raises(HTTPException) as exc:
        await products.delete_product(product.id, context=SHOP, user=SELLER, db=db)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_can_delete_and_hide_any_listing(db):
    first, second = await create(db), await create(db)
    assert await products.delete_product(first.id, context=SHOP, user=ADMIN, db=db) == {"message": "Deleted"}
    assert await admin_toggle_product(second.id, u=ADMIN, context=SHOP, pg=db) == {"is_active": False}
    assert await shop_ids(db) == []
    assert await admin_delete_product(second.id, u=ADMIN, context=SHOP, pg=db) == {"message": "Deleted"}
    with pytest.raises(HTTPException) as exc:
        await admin_delete_product(second.id, u=ADMIN, context=SHOP, pg=db)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_bulk_creates_drafts_in_one_transaction(db):
    rows = [BulkProductCreate(title=f"Item {i}", description="Plain item.", price={"amount_minor": 1000, "currency": "INR"},
                              storefront_ids=["zolexora-shop"]) for i in range(3)]
    result = await products.bulk_create_products(rows, context=None, user=SELLER, db=db)
    assert result["imported"] == 3
    assert await shop_ids(db) == []  # drafts until published
    assert len(await products.my_products(user=SELLER, context=None, db=db)) == 3
    with pytest.raises(HTTPException):
        await products.bulk_create_products(rows + [BulkProductCreate(**{**rows[0].model_dump(), "storefront_ids": ["mahila-madel"]})],
                                            context=None, user=SELLER, db=db)
    assert len(await products.my_products(user=SELLER, context=None, db=db)) == 3
