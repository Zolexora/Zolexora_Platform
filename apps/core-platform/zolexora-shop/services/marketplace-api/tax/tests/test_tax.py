import pytest
from decimal import Decimal
from tax.schemas import TaxRate, ProductTaxClass
from tax.policy import MarketplaceTaxAdapter, DefaultLegalEntityResolver
from tax.service import calculate_taxes

class MockTaxRepository:
    def __init__(self):
        self.rates = {
            ("class_1", "store_1"): TaxRate(id="1", classification_id="class_1", storefront_id="store_1", rate=Decimal("0.15"))
        }
        self.product_classes = {
            "variant_1": ProductTaxClass(product_id="variant_1", classification_id="class_1")
        }
        
    async def get_tax_rate(self, classification_id: str, storefront_id: str):
        return self.rates.get((classification_id, storefront_id))
        
    async def get_product_tax_class(self, product_id: str):
        return self.product_classes.get(product_id)

@pytest.mark.asyncio
async def test_calculate_taxes():
    repo = MockTaxRepository()
    adapter = MarketplaceTaxAdapter(repo)
    
    result = await calculate_taxes(
        policy=adapter,
        subtotal=Decimal("100.00"),
        storefront_id="store_1",
        variant_ids=["variant_1"]
    )
    
    assert result.subtotal == Decimal("100.00")
    assert result.rate_applied == Decimal("0.15")
    assert result.tax_amount == Decimal("15.00")
    assert result.total == Decimal("115.00")
    assert result.classification_id == "class_1"

@pytest.mark.asyncio
async def test_calculate_taxes_no_variants():
    repo = MockTaxRepository()
    adapter = MarketplaceTaxAdapter(repo)
    
    result = await calculate_taxes(
        policy=adapter,
        subtotal=Decimal("100.00"),
        storefront_id="store_1",
        variant_ids=[]
    )
    
    assert result.tax_amount == Decimal("0.00")
    assert result.total == Decimal("100.00")

def test_legal_entity_resolver():
    resolver = DefaultLegalEntityResolver()
    with pytest.raises(NotImplementedError, match="Production GST policy is unresolved"):
        resolver.resolve_legal_entity("store_1", "org_1")
