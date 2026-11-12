import uuid
from typing import Optional
from pricing.schemas import PriceSnapshot
from pricing.repository import PostgresPricingRepository

class PricingServiceError(Exception):
    pass

class CurrencyMismatchError(PricingServiceError):
    pass

class PriceNotFoundError(PricingServiceError):
    pass

class PricingService:
    def __init__(self, repository: PostgresPricingRepository):
        self.repository = repository

    async def get_snapshot_for_variant(
        self,
        *,
        storefront_id: uuid.UUID,
        variant_id: uuid.UUID,
        expected_currency: Optional[str] = None
    ) -> PriceSnapshot:
        price_data = await self.repository.get_active_price(
            storefront_id=storefront_id,
            variant_id=variant_id
        )
        
        if not price_data:
            raise PriceNotFoundError(f"No active price found for variant {variant_id} on storefront {storefront_id}")

        currency = price_data["currency"]
        
        if expected_currency and expected_currency.upper() != currency.upper():
            raise CurrencyMismatchError(f"Expected currency {expected_currency}, but price is in {currency}")

        return PriceSnapshot(
            amount=price_data["amount"],
            currency=currency,
            price_book_id=price_data["price_book_id"]
        )
