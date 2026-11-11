"""
Cloudinary — ALL binary media storage for Zolexora.

Why Cloudinary instead of local disk:
  • Automatic CDN delivery globally
  • On-the-fly image transforms (resize, compress, format)
  • Free tier: 25 GB storage + 25 GB bandwidth/month
  • Zero quota impact on MongoDB Atlas (500 MB) or Supabase (500 MB)

Folders:
  zolexora/products/   → product images
  zolexora/reels/      → reel videos & thumbnails
  zolexora/avatars/    → user profile pictures
"""
import asyncio
import logging
import uuid
from typing import Optional

logger = logging.getLogger("zolexora.cloudinary")
_configured = False


def _init():
    global _configured
    if _configured:
        return
    from core.config import settings
    if not settings.CLOUDINARY_CLOUD_NAME:
        logger.warning("Cloudinary not configured — uploads disabled")
        return
    import cloudinary
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    _configured = True
    logger.info("Cloudinary configured → cloud=%s", settings.CLOUDINARY_CLOUD_NAME)


async def upload(data: bytes, folder: str, public_id: Optional[str] = None,
                 resource_type: str = "auto") -> str:
    """Upload raw bytes → Cloudinary. Returns secure CDN URL."""
    _init()
    if not _configured:
        raise RuntimeError("Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET.")

    import cloudinary.uploader as up
    pid = public_id or str(uuid.uuid4())

    def _do():
        return up.upload(
            data,
            folder=f"zolexora/{folder}",
            public_id=pid,
            resource_type=resource_type,
            overwrite=True,
            invalidate=True,
        )

    result = await asyncio.to_thread(_do)
    url = result.get("secure_url", "")
    logger.debug("Cloudinary upload → %s", url)
    return url


async def delete(public_id: str, resource_type: str = "image") -> None:
    _init()
    if not _configured:
        return
    import cloudinary.uploader as up
    await asyncio.to_thread(up.destroy, public_id, resource_type=resource_type)


# ── Convenience wrappers ──────────────────────────────────────────────────────

async def upload_product_image(data: bytes, content_type: str = "image/jpeg") -> str:
    return await upload(data, "products", resource_type="image")

async def upload_reel_media(data: bytes, content_type: str = "video/mp4") -> str:
    rt = "video" if content_type.startswith("video/") else "image"
    return await upload(data, "reels", resource_type=rt)

async def upload_avatar(user_id: str, data: bytes, content_type: str = "image/jpeg") -> str:
    return await upload(data, "avatars", public_id=user_id, resource_type="image")
