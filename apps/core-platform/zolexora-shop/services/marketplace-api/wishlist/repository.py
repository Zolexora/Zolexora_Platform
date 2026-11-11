from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from database.models import wishlist, wishlist_item

class WishlistRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create_wishlist(self, storefront_id: UUID, buyer_id: Optional[UUID] = None, anonymous_key: Optional[str] = None) -> dict:
        if not buyer_id and not anonymous_key:
            raise ValueError("Must provide either buyer_id or anonymous_key")
        if buyer_id and anonymous_key:
            raise ValueError("Cannot provide both buyer_id and anonymous_key")
            
        stmt = select(wishlist).where(wishlist.c.storefront_id == storefront_id)
        if buyer_id:
            stmt = stmt.where(wishlist.c.buyer_id == buyer_id)
        else:
            stmt = stmt.where(wishlist.c.anonymous_key == anonymous_key)
            
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        
        if row:
            return dict(row)
            
        # Create
        insert_stmt = wishlist.insert().values(
            storefront_id=storefront_id,
            buyer_id=buyer_id,
            anonymous_key=anonymous_key
        ).returning(wishlist)
        result = await self.session.execute(insert_stmt)
        return dict(result.mappings().first())

    async def get_items(self, wishlist_id: UUID) -> List[dict]:
        stmt = select(wishlist_item).where(wishlist_item.c.wishlist_id == wishlist_id).order_by(wishlist_item.c.added_at.desc())
        result = await self.session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def add_item(self, wishlist_id: UUID, storefront_listing_id: UUID) -> Optional[dict]:
        try:
            stmt = wishlist_item.insert().values(
                wishlist_id=wishlist_id,
                storefront_listing_id=storefront_listing_id
            ).returning(wishlist_item)
            result = await self.session.execute(stmt)
            return dict(result.mappings().first())
        except IntegrityError:
            # Item already in wishlist (due to unique constraint) or foreign key error
            # For testing and simple handling without transaction issues, 
            # we rely on the caller to handle or we just query the existing.
            stmt = select(wishlist_item).where(
                wishlist_item.c.wishlist_id == wishlist_id,
                wishlist_item.c.storefront_listing_id == storefront_listing_id
            )
            result = await self.session.execute(stmt)
            row = result.mappings().first()
            return dict(row) if row else None

    async def remove_item(self, wishlist_id: UUID, item_id: UUID) -> bool:
        stmt = delete(wishlist_item).where(
            wishlist_item.c.wishlist_id == wishlist_id,
            wishlist_item.c.id == item_id
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0
