import abc
from decimal import Decimal
from typing import List
from .schemas import TaxCalculation

class TaxPolicy(abc.ABC):
    @abc.abstractmethod
    async def calculate_tax(
        self, 
        subtotal: Decimal, 
        storefront_id: str, 
        variant_ids: List[str]
    ) -> TaxCalculation:
        pass

class LegalEntityResolver(abc.ABC):
    @abc.abstractmethod
    def resolve_legal_entity(self, storefront_id: str, org_id: str) -> str:
        """
        Determine which GST/tax rules apply.
        Do not guess GST registration ownership.
        Implement provider-neutral mapping hooks where production policy remains unresolved.
        """
        pass

class DefaultLegalEntityResolver(LegalEntityResolver):
    def resolve_legal_entity(self, storefront_id: str, org_id: str) -> str:
        # Stub implementation to avoid hardcoding GST policy
        raise NotImplementedError("Production GST policy is unresolved.")

class MarketplaceTaxAdapter(TaxPolicy):
    def __init__(self, repository):
        self.repository = repository
        
    async def calculate_tax(
        self, 
        subtotal: Decimal, 
        storefront_id: str, 
        variant_ids: List[str]
    ) -> TaxCalculation:
        if not variant_ids:
            return TaxCalculation(
                subtotal=subtotal,
                tax_amount=Decimal("0.00"),
                total=subtotal,
                rate_applied=Decimal("0.00"),
                classification_id=None
            )
            
        # For simplicity, using the first variant's tax class
        product_id = variant_ids[0]
        
        tax_class = await self.repository.get_product_tax_class(product_id)
        
        if not tax_class:
            return TaxCalculation(
                subtotal=subtotal,
                tax_amount=Decimal("0.00"),
                total=subtotal,
                rate_applied=Decimal("0.00"),
                classification_id=None
            )
            
        rate_record = await self.repository.get_tax_rate(tax_class.classification_id, storefront_id)
        rate = rate_record.rate if rate_record else Decimal("0.00")
        
        tax_amount = (subtotal * rate).quantize(Decimal("0.01"))
        
        return TaxCalculation(
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=subtotal + tax_amount,
            rate_applied=rate,
            classification_id=tax_class.classification_id
        )
