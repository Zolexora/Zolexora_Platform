from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from typing import Optional

class TaxClassification(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class ProductTaxClass(BaseModel):
    product_id: str
    classification_id: str
    
    model_config = ConfigDict(from_attributes=True)

class TaxRate(BaseModel):
    id: str
    classification_id: str
    storefront_id: str
    rate: Decimal
    region: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class TaxCalculation(BaseModel):
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    rate_applied: Decimal
    classification_id: Optional[str] = None
