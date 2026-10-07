from uuid import UUID
from typing import List
from fastapi import HTTPException
from .schemas import CustomerAddressCreate, CustomerAddressUpdate, CustomerAddressResponse
from .repository import CustomerAddressRepository

class CustomerAddressService:
    def __init__(self, repository: CustomerAddressRepository):
        self.repository = repository

    async def get_user_address(self, address_id: UUID, user_id: UUID) -> CustomerAddressResponse:
        row = await self.repository.get_by_id(address_id)
        if not row:
            raise HTTPException(status_code=404, detail="Address not found")
        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this address")
        return CustomerAddressResponse(**row)

    async def list_user_addresses(self, user_id: UUID) -> List[CustomerAddressResponse]:
        rows = await self.repository.list_by_user(user_id)
        return [CustomerAddressResponse(**row) for row in rows]

    async def create_address(self, user_id: UUID, data: CustomerAddressCreate) -> CustomerAddressResponse:
        row = await self.repository.create(user_id, data)
        return CustomerAddressResponse(**row)

    async def update_address(self, address_id: UUID, user_id: UUID, data: CustomerAddressUpdate) -> CustomerAddressResponse:
        # Check ownership
        await self.get_user_address(address_id, user_id)
        row = await self.repository.update(address_id, data)
        if not row:
            raise HTTPException(status_code=404, detail="Address not found")
        return CustomerAddressResponse(**row)

    async def delete_address(self, address_id: UUID, user_id: UUID) -> None:
        # Check ownership
        await self.get_user_address(address_id, user_id)
        success = await self.repository.delete(address_id)
        if not success:
            raise HTTPException(status_code=404, detail="Address not found")
