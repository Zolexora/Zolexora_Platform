import uuid

from fastapi import HTTPException

from .repository import PostgresCartRepository
from .schemas import CartItemCreate, CartItemUpdate


class CartService:
    def __init__(self, repo: PostgresCartRepository):
        self.repo = repo

    async def get_cart(
        self,
        storefront_id: uuid.UUID,
        buyer_id: uuid.UUID | None = None,
        anonymous_key: str | None = None,
    ) -> dict | None:
        cart = await self.repo.get_active_cart(
            storefront_id=storefront_id,
            buyer_id=buyer_id,
            anonymous_key=anonymous_key
        )
        if cart:
            items = await self.repo.get_cart_items(cart["id"])
            cart["items"] = items
        return cart

    async def get_or_create_cart(
        self,
        storefront_id: uuid.UUID,
        currency: str,
        buyer_id: uuid.UUID | None = None,
        anonymous_key: str | None = None,
    ) -> dict:
        if not buyer_id and not anonymous_key:
            raise ValueError("Either buyer_id or anonymous_key must be provided")

        cart = await self.get_cart(storefront_id, buyer_id, anonymous_key)
        if cart:
            return cart

        cart = await self.repo.create_cart(
            storefront_id=storefront_id,
            currency=currency,
            buyer_id=buyer_id,
            anonymous_key=anonymous_key
        )
        cart["items"] = []
        return cart

    async def add_item_to_cart(
        self,
        storefront_id: uuid.UUID,
        currency: str,
        item: CartItemCreate,
        buyer_id: uuid.UUID | None = None,
        anonymous_key: str | None = None,
    ) -> dict:
        listing = await self.repo.get_listing(item.storefront_listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        if listing["storefront_id"] != storefront_id:
            raise HTTPException(status_code=400, detail="Listing does not belong to this storefront")
        if listing["publication_state"] != "PUBLISHED":
            raise HTTPException(status_code=400, detail="Listing is not published")

        cart = await self.get_or_create_cart(storefront_id, currency, buyer_id, anonymous_key)
        
        await self.repo.add_or_update_cart_item(
            cart_id=cart["id"],
            storefront_listing_id=item.storefront_listing_id,
            quantity_delta=item.quantity,
            is_absolute=False
        )
        return await self.get_cart(storefront_id, buyer_id, anonymous_key) # type: ignore

    async def update_item_quantity(
        self,
        storefront_id: uuid.UUID,
        storefront_listing_id: uuid.UUID,
        update: CartItemUpdate,
        buyer_id: uuid.UUID | None = None,
        anonymous_key: str | None = None,
    ) -> dict:
        cart = await self.get_cart(storefront_id, buyer_id, anonymous_key)
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")

        await self.repo.add_or_update_cart_item(
            cart_id=cart["id"],
            storefront_listing_id=storefront_listing_id,
            quantity_delta=update.quantity,
            is_absolute=True
        )
        return await self.get_cart(storefront_id, buyer_id, anonymous_key) # type: ignore

    async def remove_item_from_cart(
        self,
        storefront_id: uuid.UUID,
        storefront_listing_id: uuid.UUID,
        buyer_id: uuid.UUID | None = None,
        anonymous_key: str | None = None,
    ) -> dict:
        cart = await self.get_cart(storefront_id, buyer_id, anonymous_key)
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")

        await self.repo.remove_cart_item(cart["id"], storefront_listing_id)
        return await self.get_cart(storefront_id, buyer_id, anonymous_key) # type: ignore

    async def merge_guest_cart(
        self,
        storefront_id: uuid.UUID,
        currency: str,
        buyer_id: uuid.UUID,
        anonymous_key: str,
    ) -> dict:
        guest_cart = await self.repo.get_active_cart(
            storefront_id=storefront_id,
            anonymous_key=anonymous_key
        )
        if not guest_cart:
            return await self.get_or_create_cart(storefront_id, currency, buyer_id=buyer_id)
            
        if guest_cart["storefront_id"] != storefront_id:
            raise HTTPException(status_code=400, detail="Cannot merge guest cart from a different storefront")

        auth_cart = await self.get_or_create_cart(storefront_id, currency, buyer_id=buyer_id)

        guest_items = await self.repo.get_cart_items(guest_cart["id"])
        
        for item in guest_items:
            await self.repo.add_or_update_cart_item(
                cart_id=auth_cart["id"],
                storefront_listing_id=item["storefront_listing_id"],
                quantity_delta=item["quantity"],
                is_absolute=False
            )

        await self.repo.deactivate_cart(guest_cart["id"], "converted")

        return await self.get_cart(storefront_id, buyer_id=buyer_id) # type: ignore
