from typing import Optional
from asyncpg import Connection
from .schemas import TaxRate, ProductTaxClass

class TaxRepository:
    def __init__(self, conn: Connection):
        self.conn = conn
        
    async def get_tax_rate(self, classification_id: str, storefront_id: str) -> Optional[TaxRate]:
        query = """
            SELECT id, classification_id, storefront_id, rate, region
            FROM tax_rates
            WHERE classification_id = $1 AND storefront_id = $2
            LIMIT 1
        """
        row = await self.conn.fetchrow(query, classification_id, storefront_id)
        if row:
            return TaxRate(**dict(row))
        return None
        
    async def get_product_tax_class(self, product_id: str) -> Optional[ProductTaxClass]:
        query = """
            SELECT product_id, classification_id
            FROM product_tax_classes
            WHERE product_id = $1
        """
        row = await self.conn.fetchrow(query, product_id)
        if row:
            return ProductTaxClass(**dict(row))
        return None
