"""Products API over the PostgreSQL catalog (catalog.store). The product id is the listing id."""

import hashlib
import json
import time
from typing import Optional, List

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Response
from pydantic import BaseModel, Field, StrictInt, field_validator, model_validator

from catalog import store
from core.config import settings
from core.deps import is_admin, seller_member, seller_only
from models.catalog import ProductListingResponse
from models.primitives import MAX_SAFE_INTEGER, Money
from seller_orgs.dependencies import assert_storefront_grants
from shared.database.postgres import pg_conn_dep
from storefronts.dependencies import require_storefront_context, optional_storefront_context
from storefronts.models import StorefrontContext

_CATEGORIES_RAW = getattr(settings, "CATEGORIES", ["Electronics","Fashion","Home & Living","Beauty","Sports","Food","Other"])
_CATEGORIES_JSON = json.dumps(_CATEGORIES_RAW)
_CATEGORIES_ETAG = f'"{hashlib.sha256(_CATEGORIES_JSON.encode()).hexdigest()[:16]}"'

router = APIRouter(prefix="/products", tags=["products"])

ALLOWED_IMG = {"image/jpeg","image/png","image/webp","image/gif"}
MAX_IMG     = 8 * 1024 * 1024   # 8 MB


def validate_title(v: str) -> str:
    v = v.strip() if v is not None else ""
    if not v:
        raise ValueError("Title cannot be empty or whitespace-only")
    if len(v) > 200:
        raise ValueError("Title cannot exceed 200 characters")
    return v

def validate_description(v: str) -> str:
    v = v.strip() if v is not None else ""
    if not v:
        raise ValueError("Description cannot be empty or whitespace-only")
    if len(v) > 5000:
        raise ValueError("Description cannot exceed 5000 characters")
    return v

def validate_stock(v: int) -> int:
    if not isinstance(v, int) or isinstance(v, bool):
        raise ValueError("Stock must be an integer")
    if v < 0:
        raise ValueError("Stock cannot be negative")
    return v

def validate_category(v: str) -> str:
    from core.config import settings
    v = v.strip() if v is not None else ""
    if not v:
        raise ValueError("Category cannot be empty or whitespace-only")
    valid_categories = getattr(settings, "CATEGORIES", [])
    if valid_categories and v not in valid_categories:
        raise ValueError(f"Category must be one of: {', '.join(valid_categories)}")
    return v

def validate_images(v: List[str]) -> List[str]:
    if not isinstance(v, list):
        raise ValueError("Images must be a list")
    if len(v) > 10:
        raise ValueError("Cannot upload more than 10 images")
    cleaned = []
    for item in v:
        if not isinstance(item, str):
            raise ValueError("All image URLs must be strings")
        item_clean = item.strip()
        if not item_clean:
            raise ValueError("Image URLs cannot be empty or whitespace-only")
        cleaned.append(item_clean)
    return cleaned


class ProductCreate(BaseModel):
    model_config = {"extra": "forbid"}

    title: str
    description: str
    price: Money
    original_price: Optional[Money] = None
    discount_percent: Optional[float] = None
    category: str = "Other"
    images: List[str] = []
    stock: StrictInt = Field(default=999, ge=0, le=MAX_SAFE_INTEGER)
    is_active: bool = False
    storefront_ids: List[str] = ["zolexora-shop", "mahila-madel"]

    @field_validator("title")
    @classmethod
    def check_title(cls, v: str) -> str:
        return validate_title(v)

    @field_validator("description")
    @classmethod
    def check_description(cls, v: str) -> str:
        return validate_description(v)

    @field_validator("category")
    @classmethod
    def check_category(cls, v: str) -> str:
        return validate_category(v)

    @field_validator("images")
    @classmethod
    def check_images(cls, v: List[str]) -> List[str]:
        return validate_images(v)

    @field_validator("stock")
    @classmethod
    def check_stock(cls, v: int) -> int:
        return validate_stock(v)

    @model_validator(mode="after")
    def check_prices(self):
        if self.original_price and self.price:
            if self.original_price.amount_minor < self.price.amount_minor:
                raise ValueError("Original price cannot be less than current price")
        return self


class ProductUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Money] = None
    original_price: Optional[Money] = None
    discount_percent: Optional[float] = None
    category: Optional[str] = None
    stock: Optional[StrictInt] = Field(default=None, ge=0, le=MAX_SAFE_INTEGER)
    is_active: Optional[bool] = None
    storefront_ids: Optional[List[str]] = None

    @field_validator("title")
    @classmethod
    def check_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return validate_title(v)

    @field_validator("description")
    @classmethod
    def check_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return validate_description(v)

    @field_validator("category")
    @classmethod
    def check_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return validate_category(v)

    @field_validator("stock")
    @classmethod
    def check_stock(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        return validate_stock(v)

    @model_validator(mode="after")
    def check_prices(self):
        if self.price is not None and self.original_price is not None:
            if self.original_price.amount_minor < self.price.amount_minor:
                raise ValueError("Original price cannot be less than current price")
        return self


_CATALOG_CACHE: dict[str, tuple[float, list[ProductListingResponse]]] = {}
_PRODUCT_DETAIL_CACHE: dict[str, tuple[float, ProductListingResponse]] = {}


def _invalidate_catalog_cache():
    _CATALOG_CACHE.clear()
    _PRODUCT_DETAIL_CACHE.clear()


def _key(context: StorefrontContext | None) -> str | None:
    return str(getattr(context.key, "value", context.key)) if context else None


@router.get("", response_model=list[ProductListingResponse])
async def list_products(category: Optional[str]=None, search: Optional[str]=None,
                        min_price: Optional[float]=None, max_price: Optional[float]=None,
                        sort: Optional[str]="newest", limit: int=40, skip: int=0,
                        context: StorefrontContext=Depends(require_storefront_context),
                        db: Connection=Depends(pg_conn_dep)):
    cache_key = f"{_key(context)}:{category}:{search}:{min_price}:{max_price}:{sort}:{limit}:{skip}"
    now = time.time()
    cached = _CATALOG_CACHE.get(cache_key)
    if cached and now - cached[0] < 30:
        return cached[1]
    results = await store.list_public(
        db, _key(context), category=category, search=search,
        min_minor=None if min_price is None else int(min_price * 100),
        max_minor=None if max_price is None else int(max_price * 100),
        sort=sort or "newest", limit=limit, skip=skip,
    )
    _CATALOG_CACHE[cache_key] = (now, results)
    return results


@router.get("/my", response_model=list[ProductListingResponse])
async def my_products(user=Depends(seller_only), context: StorefrontContext | None = Depends(optional_storefront_context),
                      db: Connection=Depends(pg_conn_dep)):
    if is_admin(user):
        return await store.all_listings(db, _key(context))
    return await store.seller_products(db, user["seller_org_id"], _key(context))


@router.get("/featured", response_model=list[ProductListingResponse])
async def get_featured_products(context: StorefrontContext=Depends(require_storefront_context),
                                db: Connection=Depends(pg_conn_dep)):
    return await list_products(sort="popular", limit=8, context=context, db=db)


@router.get("/categories", response_model=List[str])
async def get_categories(request: Request):
    if request.headers.get("if-none-match") == _CATEGORIES_ETAG:
        return Response(status_code=304, headers={"ETag": _CATEGORIES_ETAG, "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"})
    return Response(
        content=_CATEGORIES_JSON,
        media_type="application/json",
        headers={
            "ETag": _CATEGORIES_ETAG,
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "X-Content-Type-Options": "nosniff",
        }
    )


@router.get("/{product_id}", response_model=ProductListingResponse)
async def get_product(product_id: str, context: StorefrontContext | None = Depends(optional_storefront_context),
                      db: Connection=Depends(pg_conn_dep)):
    cache_key = f"{_key(context)}:{product_id}"
    now = time.time()
    cached = _PRODUCT_DETAIL_CACHE.get(cache_key)
    if cached and now - cached[0] < 60:
        return cached[1]
    product = await store.public_listing(product_id, _key(context), db)
    if not product:
        raise HTTPException(404, "Product not found")
    _PRODUCT_DETAIL_CACHE[cache_key] = (now, product)
    return product


async def _owned_listing(db, product_id: str, user: dict, context):
    """The listing a seller (their organisation's) or an admin (any) may change."""
    listing = await store.find_listing(db, product_id, None if is_admin(user) else user["seller_org_id"], _key(context))
    if not listing:
        raise HTTPException(404, "Product not found" if is_admin(user) else "Product not found or not yours")
    return listing


async def _listing_response(db, listing_id) -> ProductListingResponse:
    row = await db.fetchrow(f"{store._SELECT} WHERE l.id = $1", listing_id)
    return store.to_response(row)


@router.post("", response_model=ProductListingResponse)
async def create_product(data: ProductCreate, context: StorefrontContext | None = Depends(optional_storefront_context),
                         user=Depends(seller_member), db: Connection=Depends(pg_conn_dep)):
    targets = [_key(context)] if context else data.storefront_ids
    await assert_storefront_grants(user, targets, db)
    async with db.transaction():
        listing_id = await store.create_product(
            db, user["seller_org_id"], title=data.title, description=data.description, category=data.category,
            images=data.images, price=data.price, compare_at=data.original_price, stock=data.stock,
            active=data.is_active, storefront_keys=targets,
        )
    _invalidate_catalog_cache()
    return await _listing_response(db, listing_id)


@router.put("/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, context: StorefrontContext | None = Depends(optional_storefront_context),
                         user=Depends(seller_only), db: Connection=Depends(pg_conn_dep)):
    listing = await _owned_listing(db, product_id, user, context)
    add, remove = set(), set()
    if data.storefront_ids is not None:
        existing = set(await db.fetchval(
            """SELECT array_agg(s.storefront_key) FROM storefront_listing l JOIN storefront s ON s.id = l.storefront_id
               WHERE l.product_id = $1 AND l.organization_id = $2""",
            listing["product_id"], listing["organization_id"],
        ) or [])
        wanted = {str(k) for k in data.storefront_ids}
        add, remove = wanted - existing, existing - wanted
        await assert_storefront_grants({**user, "seller_org_id": str(listing["organization_id"])}, add, db)
    async with db.transaction():
        await store.update_product(db, listing, data, add, remove)
    _invalidate_catalog_cache()
    return {"message": "Updated"}


@router.delete("/{product_id}")
async def delete_product(product_id: str, context: StorefrontContext | None = Depends(optional_storefront_context),
                         user=Depends(seller_only), db: Connection=Depends(pg_conn_dep)):
    listing = await _owned_listing(db, product_id, user, context)
    await store.remove_listing(db, listing["id"])
    _invalidate_catalog_cache()
    return {"message": "Deleted"}


@router.post("/{product_id}/upload-image")
async def upload_image(product_id: str, file: UploadFile=File(...), context: StorefrontContext | None = Depends(optional_storefront_context),
                       user=Depends(seller_only), db: Connection=Depends(pg_conn_dep)):
    listing = await _owned_listing(db, product_id, user, context)
    ct = file.content_type or "image/jpeg"
    if ct not in ALLOWED_IMG:
        raise HTTPException(400, f"Allowed types: {ALLOWED_IMG}")
    data = await file.read()
    if len(data) > MAX_IMG:
        raise HTTPException(400, "Image too large (max 8 MB)")
    if len(json.loads(await db.fetchval("SELECT images::text FROM master_product WHERE id = $1", listing["product_id"]))) >= 10:
        raise HTTPException(400, "Cannot upload more than 10 images")
    from core.cloudinary_client import upload_product_image
    url = await upload_product_image(data, ct)
    await store.add_image(db, listing["product_id"], url)
    _invalidate_catalog_cache()
    return {"image_url": url, "storage": "cloudinary"}


class BulkProductCreate(BaseModel):
    model_config = {"extra": "forbid"}

    title:            str
    description:      str
    price:            Money
    original_price:   Optional[Money] = None
    category:         str = "Other"
    images:           List[str] = []
    stock:            StrictInt = Field(default=999, ge=0, le=MAX_SAFE_INTEGER)
    storefront_ids:   List[str] = ["zolexora-shop", "mahila-madel"]

    @field_validator("title")
    @classmethod
    def check_title(cls, v: str) -> str:
        return validate_title(v)

    @field_validator("description")
    @classmethod
    def check_description(cls, v: str) -> str:
        return validate_description(v)

    @field_validator("category")
    @classmethod
    def check_category(cls, v: str) -> str:
        return validate_category(v)

    @field_validator("images")
    @classmethod
    def check_images(cls, v: List[str]) -> List[str]:
        return validate_images(v)

    @field_validator("stock")
    @classmethod
    def check_stock(cls, v: int) -> int:
        return validate_stock(v)

    @model_validator(mode="after")
    def check_prices(self):
        if self.original_price and self.price:
            if self.original_price.amount_minor < self.price.amount_minor:
                raise ValueError("Original price cannot be less than current price")
        return self


@router.post("/bulk")
async def bulk_create_products(
    products: List[BulkProductCreate],
    context: StorefrontContext | None = Depends(optional_storefront_context),
    user=Depends(seller_member),
    db: Connection = Depends(pg_conn_dep),
):
    if not products:
        raise HTTPException(400, "No products provided")
    if len(products) > 500:
        raise HTTPException(400, "Max 500 products per bulk upload")
    targets = {k for p in products for k in ([_key(context)] if context else p.storefront_ids)}
    await assert_storefront_grants(user, targets, db)
    created = []
    async with db.transaction():
        for p in products:
            listing_id = await store.create_product(
                db, user["seller_org_id"], title=p.title.strip(), description=p.description.strip(), category=p.category,
                images=p.images, price=p.price, compare_at=p.original_price, stock=p.stock, active=False,
                storefront_keys=[_key(context)] if context else p.storefront_ids,
            )
            created.append({"id": str(listing_id), "title": p.title.strip(), "price": p.price.model_dump(mode="json")})
    _invalidate_catalog_cache()
    return {"imported": len(created), "message": f"{len(created)} products created successfully", "products": created}
