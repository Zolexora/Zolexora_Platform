import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from commerce import coins
from content import reels as reel_store
from core.deps import current_user, is_admin, optional_user
from core.config import settings
from shared.database.postgres import pg_conn_dep
from storefronts.dependencies import require_storefront_context, optional_storefront_context
from storefronts.models import StorefrontContext

router = APIRouter(prefix="/reels", tags=["reels"])
ALLOWED_MEDIA = {"image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"}
MAX_MEDIA     = 100 * 1024 * 1024   # 100 MB


class ReelCreate(BaseModel):
    title: str; description: str = ""
    linked_product_id: Optional[str] = None
    content_type: str = "organic"; sponsor_data: Optional[dict] = None


def _sf(context: StorefrontContext | None):
    return context.key if context else None


def _owner(user: dict) -> Optional[str]:
    """Reels a caller may change: an admin any, everyone else their own."""
    return None if is_admin(user) else user["id"]


@router.get("")
async def list_reels(limit:int=30, skip:int=0, context: StorefrontContext=Depends(require_storefront_context), pg=Depends(pg_conn_dep)):
    return await reel_store.find(pg, storefront=context.key, is_active=True, limit=min(max(limit, 1), 100), skip=max(skip, 0))


@router.get("/my")
async def my_reels(context: StorefrontContext | None = Depends(optional_storefront_context), user=Depends(current_user), pg=Depends(pg_conn_dep)):
    return await reel_store.find(pg, creator_id=user["id"], storefront=_sf(context), limit=200)


@router.post("")
async def create_reel(data:ReelCreate, context: StorefrontContext | None = Depends(optional_storefront_context), user=Depends(current_user), pg=Depends(pg_conn_dep)):
    name = user.get("name") or user.get("full_name") or ""
    return await reel_store.create(pg, _sf(context) or "zolexora-shop", user["id"], name, data.model_dump())


@router.post("/{reel_id}/upload")
async def upload_reel_media(reel_id:str, file:UploadFile=File(...),
                            context: StorefrontContext | None = Depends(optional_storefront_context),
                            user=Depends(current_user), pg=Depends(pg_conn_dep)):
    """Upload reel image/video → Cloudinary."""
    scope = {"id": reel_id, "creator_id": user["id"], "storefront": _sf(context)}
    if not await reel_store.get(pg, **scope):
        raise HTTPException(404,"Reel not found")
    ct = file.content_type or "image/jpeg"
    if ct not in ALLOWED_MEDIA: raise HTTPException(400,f"Allowed types: {ALLOWED_MEDIA}")
    data = await file.read()
    if len(data) > MAX_MEDIA: raise HTTPException(400,"File too large (max 100 MB)")
    from core.cloudinary_client import upload_reel_media
    url = await upload_reel_media(data, ct)
    mt  = "video" if ct.startswith("video/") else "image"
    await reel_store.update(pg, {"video_url":url,"thumbnail_url":url,"media_type":mt}, **scope)
    return {"video_url":url,"media_type":mt,"storage":"cloudinary"}


@router.post("/{reel_id}/view")
async def view_reel(
    reel_id:str,
    context: StorefrontContext=Depends(require_storefront_context),
    user=Depends(optional_user),
    pg=Depends(pg_conn_dep),
):
    reel = await reel_store.get(pg, id=reel_id, is_active=True, storefront=context.key)
    if not reel: raise HTTPException(404,"Reel not found")
    if not user:
        await reel_store.add_view(pg, reel, None)
        return {"coins_earned":0,"message":"Login to earn coins"}

    today = datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0)
    async with pg.transaction():
        earned_today = await pg.fetchval("SELECT count(*) FROM reel_view WHERE user_id = $1 AND view_date = $2::date",
                                         uuid.UUID(user["id"]), today)
        if not await reel_store.add_view(pg, reel, user["id"]):
            return {"coins_earned":0,"message":"Already earned today"}
        if earned_today * settings.COINS_PER_REEL_VIEW >= settings.MAX_DAILY_COINS:
            return {"coins_earned":0,"message":"Daily coin limit reached"}
        await coins.move(pg, user["id"], settings.COINS_PER_REEL_VIEW, "earned", f"Watched: {reel['title']}", reel_id)
        creator_has_wallet = await pg.fetchval("SELECT 1 FROM user_profile WHERE user_id = $1", uuid.UUID(reel["creator_id"]))
        if reel["creator_id"] != user["id"] and creator_has_wallet:
            await coins.move(pg, reel["creator_id"], settings.COINS_CREATOR_PER_VIEW, "earned",
                             f"View on your reel: {reel['title']}", reel_id)

    return {"coins_earned":settings.COINS_PER_REEL_VIEW,"message":f"+{settings.COINS_PER_REEL_VIEW} coins!"}


@router.put("/{reel_id}")
async def update_reel(reel_id:str, data:dict, context: StorefrontContext | None = Depends(optional_storefront_context), user=Depends(current_user), pg=Depends(pg_conn_dep)):
    allowed = {"title","description","linked_product_id","sponsor_data","is_active"}
    await reel_store.update(pg, {k:v for k,v in data.items() if k in allowed},
                            id=reel_id, creator_id=_owner(user), storefront=_sf(context))
    return {"message":"Updated"}


@router.delete("/{reel_id}")
async def delete_reel(reel_id:str, context: StorefrontContext | None = Depends(optional_storefront_context), user=Depends(current_user), pg=Depends(pg_conn_dep)):
    await reel_store.delete(pg, id=reel_id, creator_id=_owner(user), storefront=_sf(context))
    return {"message":"Deleted"}
