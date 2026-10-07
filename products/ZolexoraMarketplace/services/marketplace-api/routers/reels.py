import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from core.deps import db_dep, current_user, optional_user
from core.config import settings
from models.documents import ReelDoc, CoinTxDoc
from users.repositories import UserRepository, get_user_repository
from storefronts.dependencies import require_storefront_context, optional_storefront_context
from storefronts.models import StorefrontContext

router = APIRouter(prefix="/reels", tags=["reels"])
ALLOWED_MEDIA = {"image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"}
MAX_MEDIA     = 100 * 1024 * 1024   # 100 MB


class ReelCreate(BaseModel):
    title: str; description: str = ""
    linked_product_id: Optional[str] = None
    content_type: str = "organic"; sponsor_data: Optional[dict] = None


@router.get("")
async def list_reels(limit:int=30, skip:int=0, context: StorefrontContext=Depends(require_storefront_context), db:AsyncIOMotorDatabase=Depends(db_dep)):
    return await db.reels.find({"is_active":True, "storefront_id": context.key},{"_id":0}).sort("created_at",-1).skip(skip).limit(limit).to_list(limit)


@router.get("/my")
async def my_reels(context: StorefrontContext | None = Depends(optional_storefront_context), user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    query = {"creator_id": user["id"]}
    if context:
        query["storefront_id"] = context.key
    return await db.reels.find(query, {"_id":0}).sort("created_at",-1).to_list(200)


@router.post("")
async def create_reel(data:ReelCreate, context: StorefrontContext | None = Depends(optional_storefront_context), user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    storefront_id = context.key if context else "zolexora-shop"
    reel = ReelDoc(storefront_id=storefront_id, creator_id=user["id"], creator_name=user["name"], **data.model_dump())
    await db.reels.insert_one(reel.model_dump())
    return reel.model_dump()


@router.post("/{reel_id}/upload")
async def upload_reel_media(reel_id:str, file:UploadFile=File(...),
                            context: StorefrontContext | None = Depends(optional_storefront_context),
                            user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    """Upload reel image/video → Cloudinary."""
    fq = {"id": reel_id, "creator_id": user["id"]}
    if context:
        fq["storefront_id"] = context.key
        
    if not await db.reels.find_one(fq):
        raise HTTPException(404,"Reel not found")
    ct = file.content_type or "image/jpeg"
    if ct not in ALLOWED_MEDIA: raise HTTPException(400,f"Allowed types: {ALLOWED_MEDIA}")
    data = await file.read()
    if len(data) > MAX_MEDIA: raise HTTPException(400,"File too large (max 100 MB)")
    from core.cloudinary_client import upload_reel_media
    url = await upload_reel_media(data, ct)
    mt  = "video" if ct.startswith("video/") else "image"
    await db.reels.update_one(fq,{"$set":{"video_url":url,"thumbnail_url":url,"media_type":mt}})
    return {"video_url":url,"media_type":mt,"storage":"cloudinary"}


@router.post("/{reel_id}/view")
async def view_reel(
    reel_id:str,
    context: StorefrontContext=Depends(require_storefront_context),
    user=Depends(optional_user),
    db:AsyncIOMotorDatabase=Depends(db_dep),
    user_repo:UserRepository=Depends(get_user_repository),
):
    reel = await db.reels.find_one({"id":reel_id,"is_active":True, "storefront_id": context.key})
    if not reel: raise HTTPException(404,"Reel not found")
    await db.reels.update_one({"id":reel_id, "storefront_id": context.key},{"$inc":{"views_count":1}})
    if not user: return {"coins_earned":0,"message":"Login to earn coins"}

    today = datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0).isoformat()
    if await db.reel_views.find_one({"user_id":user["id"],"reel_id":reel_id,"created_at":{"$gte":today}}):
        return {"coins_earned":0,"message":"Already earned today"}

    daily = await db.coin_transactions.count_documents(
        {"user_id":user["id"],"type":"earned","created_at":{"$gte":today}})
    if daily * settings.COINS_PER_REEL_VIEW >= settings.MAX_DAILY_COINS:
        return {"coins_earned":0,"message":"Daily coin limit reached"}

    await db.reel_views.insert_one({
        "id":str(uuid.uuid4()),"user_id":user["id"],"reel_id":reel_id,
        "created_at":datetime.now(timezone.utc).isoformat()})
    await user_repo.adjust_coin_balance(user["id"], settings.COINS_PER_REEL_VIEW)
    await db.coin_transactions.insert_one(CoinTxDoc(
        user_id=user["id"],amount=settings.COINS_PER_REEL_VIEW,type="earned",
        description=f"Watched: {reel['title']}",ref_id=reel_id).model_dump())

    if reel["creator_id"] != user["id"]:
        if await user_repo.get_by_id(reel["creator_id"]):
            await user_repo.adjust_coin_balance(reel["creator_id"], settings.COINS_CREATOR_PER_VIEW)
            await db.coin_transactions.insert_one(CoinTxDoc(
                user_id=reel["creator_id"],amount=settings.COINS_CREATOR_PER_VIEW,type="earned",
                description=f"View on your reel: {reel['title']}",ref_id=reel_id).model_dump())

    return {"coins_earned":settings.COINS_PER_REEL_VIEW,"message":f"+{settings.COINS_PER_REEL_VIEW} coins!"}


@router.put("/{reel_id}")
async def update_reel(reel_id:str, data:dict, context: StorefrontContext | None = Depends(optional_storefront_context), user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    allowed = {"title","description","linked_product_id","sponsor_data","is_active"}
    fq = {"id": reel_id} if user["role"] == "admin" else {"id": reel_id, "creator_id": user["id"]}
    if context:
        fq["storefront_id"] = context.key
    await db.reels.update_one(fq,{"$set":{k:v for k,v in data.items() if k in allowed}})
    return {"message":"Updated"}


@router.delete("/{reel_id}")
async def delete_reel(reel_id:str, context: StorefrontContext | None = Depends(optional_storefront_context), user=Depends(current_user), db:AsyncIOMotorDatabase=Depends(db_dep)):
    fq = {"id": reel_id} if user["role"] == "admin" else {"id": reel_id, "creator_id": user["id"]}
    if context:
        fq["storefront_id"] = context.key
    await db.reels.delete_one(fq)
    return {"message":"Deleted"}
