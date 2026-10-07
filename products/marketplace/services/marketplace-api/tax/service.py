from decimal import Decimal
from typing import List
from .schemas import TaxCalculation
from .policy import TaxPolicy

async def calculate_taxes(
    policy: TaxPolicy,
    subtotal: Decimal,
    storefront_id: str,
    variant_ids: List[str]
) -> TaxCalculation:
    return await policy.calculate_tax(subtotal, storefront_id, variant_ids)
