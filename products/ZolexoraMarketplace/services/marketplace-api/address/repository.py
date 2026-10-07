from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from database.models import customer_address
from .schemas import CustomerAddressCreate, CustomerAddressUpdate

class CustomerAddressRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, address_id: UUID) -> Optional[dict]:
        stmt = select(customer_address).where(customer_address.c.id == address_id)
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def list_by_user(self, user_id: UUID) -> List[dict]:
        stmt = select(customer_address).where(customer_address.c.user_id == user_id)
        result = await self.session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def create(self, user_id: UUID, data: CustomerAddressCreate) -> dict:
        stmt = customer_address.insert().values(
            user_id=user_id,
            **data.model_dump()
        ).returning(customer_address)
        result = await self.session.execute(stmt)
        return dict(result.mappings().first())

    async def update(self, address_id: UUID, data: CustomerAddressUpdate) -> Optional[dict]:
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get_by_id(address_id)
            
        stmt = update(customer_address).where(
            customer_address.c.id == address_id
        ).values(**update_data).returning(customer_address)
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def delete(self, address_id: UUID) -> bool:
        stmt = delete(customer_address).where(customer_address.c.id == address_id)
        result = await self.session.execute(stmt)
        return result.rowcount > 0
