import asyncio
import hashlib
import json
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field, StrictInt, field_validator, model_validator

from core.config import settings
from core.deps import db_dep, current_user, seller_only
from storefronts.dependencies import require_storefront_context, optional_storefront_context
from storefronts.models import StorefrontContext
from models.catalog import MasterProductDoc, StorefrontListingDoc, InventoryBalanceDoc, ProductListingResponse
from models.primitives import MAX_SAFE_INTEGER, Money

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


async def _fetch_product_listing(db, listing_doc: dict) -> ProductListingResponse:
    owner_filter = {"product_id": listing_doc["product_id"], "seller_id": listing_doc["seller_id"]}
    master_coro = db.master_products.find_one({"id": listing_doc["product_id"], "seller_id": listing_doc["seller_id"]})
    inv_coro = db.inventory_balances.find_one(owner_filter)
    
    all_listings = [listing_doc]
    if hasattr(db.storefront_listings, "find"):
        try:
            cursor = db.storefront_listings.find(owner_filter)
            if hasattr(cursor, "to_list"):
                all_listings = await cursor.to_list(None)
        except Exception:
            pass
            
    master, inv = await asyncio.gather(master_coro, inv_coro)
    s_ids = [item["storefront_id"] for item in (all_listings or []) if isinstance(item, dict) and "storefront_id" in item]
    if not s_ids and "storefront_id" in listing_doc:
        s_ids = [listing_doc["storefront_id"]]
    
    return ProductListingResponse(
        id=listing_doc["id"],
        storefront_id=listing_doc["storefront_id"],
        storefront_ids=s_ids,
        seller_id=listing_doc["seller_id"],
        seller_name=master.get("seller_name", "Unknown") if master else "Unknown",
        title=listing_doc.get("title_override") or (master.get("title", "Unknown") if master else "Unknown"),
        description=listing_doc.get("description_override") or (master.get("description", "Unknown") if master else "Unknown"),
        price=listing_doc["price"],
        original_price=listing_doc.get("compare_at_price"),
        discount_percent=0.0,
        category=master.get("category", "Other") if master else "Other",
        images=listing_doc.get("images_override") or (master.get("images", []) if master else []),
        stock=inv.get("available_quantity", 0) if inv else 0,
        is_active=listing_doc.get("status") == "active",
        rating=listing_doc.get("rating", 0.0),
        reviews_count=listing_doc.get("reviews_count", 0),
        created_at=listing_doc.get("created_at", "")
    )


_CATALOG_CACHE: dict[str, tuple[float, list[ProductListingResponse]]] = {}
_PRODUCT_DETAIL_CACHE: dict[str, tuple[float, ProductListingResponse]] = {}

def _invalidate_catalog_cache():
    _CATALOG_CACHE.clear()
    _PRODUCT_DETAIL_CACHE.clear()


@router.get("")
async def list_products(category: Optional[str]=None, search: Optional[str]=None,
                         min_price: Optional[float]=None, max_price: Optional[float]=None,
                         sort: Optional[str]="newest", limit: int=40, skip: int=0,
                         context: StorefrontContext=Depends(require_storefront_context),
                         db: AsyncIOMotorDatabase=Depends(db_dep)):
    cache_key = f"{context.key}:{category}:{search}:{min_price}:{max_price}:{sort}:{limit}:{skip}"
    now = time.time()
    if cache_key in _CATALOG_CACHE:
        ts, cached_res = _CATALOG_CACHE[cache_key]
        if now - ts < 30:
            return cached_res

    sort_opts = {
        "newest": {"created_at": -1},
        "price_asc": {"price.amount_minor": 1},
        "price_desc": {"price.amount_minor": -1},
        "popular": {"reviews_count": -1}
    }
    sort_stage = {"$sort": sort_opts.get(sort, {"created_at": -1})}

    # Optimization: When not filtering by master collection fields, paginate BEFORE $lookup!
    if not search and (not category or category == "All"):
        pipeline = [
            {"$match": {"status": "active", "storefront_id": context.key}}
        ]
        if min_price is not None:
            pipeline.append({"$match": {"price.amount_minor": {"$gte": int(min_price * 100)}}})
        if max_price is not None:
            pipeline.append({"$match": {"price.amount_minor": {"$lte": int(max_price * 100)}}})
            
        pipeline.append(sort_stage)
        pipeline.append({"$skip": skip})
        pipeline.append({"$limit": limit})
        pipeline.extend([
            {"$lookup": {
                "from": "master_products",
                "localField": "product_id",
                "foreignField": "id",
                "as": "master"
            }},
            {"$unwind": {"path": "$master", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "inventory_balances",
                "localField": "product_id",
                "foreignField": "product_id",
                "as": "inventory"
            }},
            {"$unwind": {"path": "$inventory", "preserveNullAndEmptyArrays": True}}
        ])
    else:
        pipeline = [
            {"$match": {"status": "active", "storefront_id": context.key}},
            {"$lookup": {
                "from": "master_products",
                "localField": "product_id",
                "foreignField": "id",
                "as": "master"
            }},
            {"$unwind": "$master"},
            {"$lookup": {
                "from": "inventory_balances",
                "localField": "product_id",
                "foreignField": "product_id",
                "as": "inventory"
            }},
            {"$unwind": {"path": "$inventory", "preserveNullAndEmptyArrays": True}}
        ]
        if category and category != "All":
            pipeline.append({"$match": {"master.category": category}})
        if search:
            pipeline.append({"$match": {
                "$or": [
                    {"master.title": {"$regex": search, "$options": "i"}},
                    {"master.description": {"$regex": search, "$options": "i"}}
                ]
            }})
        if min_price is not None:
            pipeline.append({"$match": {"price.amount_minor": {"$gte": int(min_price * 100)}}})
        if max_price is not None:
            pipeline.append({"$match": {"price.amount_minor": {"$lte": int(max_price * 100)}}})
        pipeline.append(sort_stage)
        pipeline.append({"$skip": skip})
        pipeline.append({"$limit": limit})

    docs = await db.storefront_listings.aggregate(pipeline).to_list(limit)
    
    results = []
    for doc in docs:
        master = doc.get("master") or {}
        inv = doc.get("inventory") or {}
        results.append(ProductListingResponse(
            id=doc["id"],
            storefront_id=doc["storefront_id"],
            seller_id=doc["seller_id"],
            seller_name=master.get("seller_name", "Unknown"),
            title=doc.get("title_override") or master.get("title", "Unknown"),
            description=doc.get("description_override") or master.get("description", "Unknown"),
            price=doc["price"],
            original_price=doc.get("compare_at_price"),
            discount_percent=0.0,
            category=master.get("category", "Other"),
            images=doc.get("images_override") or master.get("images", []),
            stock=inv.get("available_quantity", 0),
            is_active=doc["status"] == "active",
            rating=doc.get("rating", 0.0),
            reviews_count=doc.get("reviews_count", 0),
            created_at=doc.get("created_at", "")
        ))
    _CATALOG_CACHE[cache_key] = (now, results)
    return results


@router.get("/my")
async def my_products(user=Depends(seller_only), context: StorefrontContext | None = Depends(optional_storefront_context), db: AsyncIOMotorDatabase=Depends(db_dep)):
    from collections import defaultdict
    query = {"seller_id": user["id"]}
    if context:
        query["storefront_id"] = context.key
    listings = await db.storefront_listings.find(query).sort("created_at", -1).to_list(200)
    if not listings:
        return []

    master_ids = list({listing["product_id"] for listing in listings if "product_id" in listing})
    
    # Parallel batch queries (eliminating N+1 sequential queries)
    masters_coro = db.master_products.find({"id": {"$in": master_ids}}).to_list(None)
    invs_coro = db.inventory_balances.find({"master_product_id": {"$in": master_ids}}).to_list(None)
    all_listings_coro = db.storefront_listings.find({"product_id": {"$in": master_ids}, "seller_id": user["id"]}).to_list(None)
    
    masters_list, invs_list, sf_listings = await asyncio.gather(masters_coro, invs_coro, all_listings_coro)
    
    master_map = {m["id"]: m for m in masters_list}
    inv_map = {i["master_product_id"]: i for i in invs_list}
    sf_map = defaultdict(list)
    for l in sf_listings:
        sf_map[l["product_id"]].append(l["storefront_id"])

    seen_master_ids = set()
    res = []
    for listing in listings:
        mid = listing["product_id"]
        if mid in seen_master_ids:
            continue
        seen_master_ids.add(mid)
        master = master_map.get(mid)
        if not master:
            continue
        inv = inv_map.get(mid, {})
        res.append(ProductListingResponse(
            id=master["id"],
            storefront_id=listing["storefront_id"],
            storefront_ids=sf_map.get(mid, [listing["storefront_id"]]),
            seller_id=listing["seller_id"],
            seller_name=master.get("seller_name", "Seller"),
            title=listing.get("title_override") or master.get("title", "Product"),
            description=listing.get("description_override") or master.get("description", ""),
            price=listing["price"],
            original_price=listing.get("compare_at_price"),
            discount_percent=0.0,
            category=master.get("category", "Other"),
            images=listing.get("images_override") or master.get("images", []),
            stock=inv.get("available_quantity", 0),
            is_active=listing["status"] == "active",
            rating=listing.get("rating", 0.0),
            reviews_count=listing.get("reviews_count", 0),
            created_at=master.get("created_at", listing.get("created_at", ""))
        ))
    return res


@router.get("/featured")
async def get_featured_products(
    context: StorefrontContext=Depends(require_storefront_context),
    db: AsyncIOMotorDatabase=Depends(db_dep)
):
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


@router.get("/{product_id}")
async def get_product(product_id: str, context: StorefrontContext | None = Depends(optional_storefront_context),
                      db: AsyncIOMotorDatabase=Depends(db_dep)):
    cache_key = f"{context.key if context else 'none'}:{product_id}"
    now = time.time()
    if cache_key in _PRODUCT_DETAIL_CACHE:
        ts, cached = _PRODUCT_DETAIL_CACHE[cache_key]
        if now - ts < 60:
            return cached

    fq = {"id": product_id}
    if context:
        fq["storefront_id"] = context.key
    listing = await db.storefront_listings.find_one(fq)
    if not listing:
        raise HTTPException(404, "Product not found")
    res = await _fetch_product_listing(db, listing)
    _PRODUCT_DETAIL_CACHE[cache_key] = (now, res)
    return res


@router.post("")
async def create_product(data: ProductCreate, context: StorefrontContext | None = Depends(optional_storefront_context),
                         user=Depends(seller_only), db: AsyncIOMotorDatabase=Depends(db_dep)):
    master = MasterProductDoc(
        seller_id=user["id"],
        seller_name=user["name"],
        title=data.title,
        description=data.description,
        category=data.category,
        images=data.images
    )
    
    target_storefronts = [context.key] if context else data.storefront_ids
    
    listings = []
    for s_id in target_storefronts:
        listing = StorefrontListingDoc(
            storefront_id=s_id,
            product_id=master.id,
            seller_id=user["id"],
            price=data.price,
            compare_at_price=data.original_price,
            status="active" if data.is_active else "draft",
        )
        listings.append(listing.model_dump())
        
    inv = InventoryBalanceDoc(
        product_id=master.id,
        seller_id=user["id"],
        available_quantity=data.stock
    )
    
    # Write master product, storefront listings, and inventory balance
    await db.master_products.insert_one(master.model_dump())
    if hasattr(db.storefront_listings, "insert_many"):
        await db.storefront_listings.insert_many(listings)
    else:
        for item in listings:
            await db.storefront_listings.insert_one(item)
    await db.inventory_balances.insert_one(inv.model_dump())
    _invalidate_catalog_cache()
    
    return await _fetch_product_listing(db, listings[0])


@router.put("/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, context: StorefrontContext | None = Depends(optional_storefront_context),
                         user=Depends(current_user), db: AsyncIOMotorDatabase=Depends(db_dep)):
    fq = {"id": product_id} if user["role"] == "admin" else {"id": product_id, "seller_id": user["id"]}
    if context:
        fq["storefront_id"] = context.key
    listing = await db.storefront_listings.find_one(fq)
    if not listing:
        raise HTTPException(404, "Product not found or not yours")
    
    master_id = listing["product_id"]
    seller_id = listing["seller_id"]

    list_update = {}
    if data.price is not None: list_update["price"] = data.price.model_dump()
    if data.original_price is not None: list_update["compare_at_price"] = data.original_price.model_dump()
    if data.is_active is not None:
        list_update["status"] = "active" if data.is_active else "paused"
        
    if list_update:
        if hasattr(db.storefront_listings, "update_many"):
            await db.storefront_listings.update_many({"product_id": master_id, "seller_id": seller_id}, {"$set": list_update})
        else:
            await db.storefront_listings.update_one({"product_id": master_id, "seller_id": seller_id}, {"$set": list_update})
        
    if data.storefront_ids is not None:
        existing = await db.storefront_listings.find({"product_id": master_id, "seller_id": seller_id}).to_list(None)
        existing_sids = {item["storefront_id"] for item in existing}
        if hasattr(data, 'storefront_ids') and data.storefront_ids is not None:
            wanted_sids = set(data.storefront_ids)
        else:
            wanted_sids = set()
        
        for sid in wanted_sids - existing_sids:
            new_l = StorefrontListingDoc(
                storefront_id=sid,
                product_id=master_id,
                seller_id=seller_id,
                price=data.price if data.price else listing["price"],
                compare_at_price=data.original_price if data.original_price else listing.get("compare_at_price"),
                status="active" if data.is_active else listing.get("status", "draft")
            )
            await db.storefront_listings.insert_one(new_l.model_dump())
            
        for sid in existing_sids - wanted_sids:
            await db.storefront_listings.delete_one({"product_id": master_id, "seller_id": seller_id, "storefront_id": sid})
        
    # Update master
    master_update = {}
    if data.title is not None: master_update["title"] = data.title
    if data.description is not None: master_update["description"] = data.description
    if data.category is not None: master_update["category"] = data.category
    if master_update:
        await db.master_products.update_one(
            {"id": listing["product_id"], "seller_id": listing["seller_id"]}, {"$set": master_update}
        )
        
    # Update inventory
    if data.stock is not None:
        await db.inventory_balances.update_one(
            {"product_id": listing["product_id"], "seller_id": listing["seller_id"]},
            {"$set": {"available_quantity": data.stock}},
        )
        
    _invalidate_catalog_cache()
    return {"message": "Updated"}


@router.delete("/{product_id}")
async def delete_product(product_id: str, context: StorefrontContext | None = Depends(optional_storefront_context),
                         user=Depends(current_user), db: AsyncIOMotorDatabase=Depends(db_dep)):
    fq = {"id": product_id} if user["role"] == "admin" else {"id": product_id, "seller_id": user["id"]}
    if context:
        fq["storefront_id"] = context.key
    listing = await db.storefront_listings.find_one(fq)
    if not listing:
        raise HTTPException(404, "Product not found" if user["role"] == "admin" else "Product not found or not yours")
    
    await db.storefront_listings.delete_one(fq)
    _invalidate_catalog_cache()
    return {"message": "Deleted"}


@router.post("/{product_id}/upload-image")
async def upload_image(product_id: str, file: UploadFile=File(...), context: StorefrontContext | None = Depends(optional_storefront_context),
                       user=Depends(current_user), db: AsyncIOMotorDatabase=Depends(db_dep)):
    fq = {"id": product_id} if user["role"] == "admin" else {"id": product_id, "seller_id": user["id"]}
    if context:
        fq["storefront_id"] = context.key
    listing = await db.storefront_listings.find_one(fq)
    if not listing:
        raise HTTPException(404, "Product not found")
        
    ct = file.content_type or "image/jpeg"
    if ct not in ALLOWED_IMG: raise HTTPException(400, f"Allowed types: {ALLOWED_IMG}")
    data = await file.read()
    if len(data) > MAX_IMG: raise HTTPException(400, "Image too large (max 8 MB)")
    
    from core.cloudinary_client import upload_product_image
    url = await upload_product_image(data, ct)
    
    await db.master_products.update_one(
        {"id": listing["product_id"], "seller_id": listing["seller_id"]}, {"$push": {"images": url}}
    )
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
    user=Depends(seller_only),
    db: AsyncIOMotorDatabase = Depends(db_dep),
):
    if not products:
        raise HTTPException(400, "No products provided")
    if len(products) > 500:
        raise HTTPException(400, "Max 500 products per bulk upload")

    masters = []
    listings = []
    invs = []
    
    for p in products:
        target_storefronts = [context.key] if context else p.storefront_ids
        master = MasterProductDoc(
            seller_id=user["id"], seller_name=user["name"],
            title=p.title.strip(), description=p.description.strip(),
            category=p.category, images=p.images
        )
        
        for s_id in target_storefronts:
            listing = StorefrontListingDoc(
                storefront_id=s_id, product_id=master.id,
                seller_id=user["id"], price=p.price, compare_at_price=p.original_price,
                status="draft",
            )
            listings.append(listing.model_dump())
            
        inv = InventoryBalanceDoc(
            product_id=master.id, seller_id=user["id"], available_quantity=p.stock
        )
        masters.append(master.model_dump())
        invs.append(inv.model_dump())

    # Parallelize bulk insertions
    await asyncio.gather(
        db.master_products.insert_many(masters),
        db.storefront_listings.insert_many(listings),
        db.inventory_balances.insert_many(invs),
    )
    _invalidate_catalog_cache()
    
    return {
        "imported": len(listings),
        "message": f"{len(listings)} products created successfully",
        "products": [{"id": d["id"], "title": m["title"], "price": d["price"]} for d, m in zip(listings, masters)],
    }
