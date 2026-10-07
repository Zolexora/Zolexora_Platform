import pytest
from uuid import uuid4
from unittest.mock import AsyncMock
from fastapi import HTTPException
from address.schemas import CustomerAddressCreate
from address.service import CustomerAddressService
from address.repository import CustomerAddressRepository
from datetime import datetime, timezone

@pytest.fixture
def repo():
    return AsyncMock(spec=CustomerAddressRepository)

@pytest.fixture
def service(repo):
    return CustomerAddressService(repository=repo)

@pytest.mark.asyncio
async def test_create_address(service, repo):
    user_id = uuid4()
    data = CustomerAddressCreate(
        address_type="SHIPPING",
        country_code="US",
        city="New York",
        postal_code="10001",
        line1="123 Street",
        recipient_name="John Doe"
    )
    repo.create.return_value = {
        "id": uuid4(),
        "user_id": user_id,
        "address_type": "SHIPPING",
        "is_default": False,
        "country_code": "US",
        "region": None,
        "city": "New York",
        "postal_code": "10001",
        "line1": "123 Street",
        "line2": None,
        "recipient_name": "John Doe",
        "phone_number": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    result = await service.create_address(user_id, data)
    assert result.address_type == "SHIPPING"
    assert result.city == "New York"
    repo.create.assert_called_once_with(user_id, data)

@pytest.mark.asyncio
async def test_get_address_not_owner(service, repo):
    user_id = uuid4()
    other_user = uuid4()
    address_id = uuid4()
    
    repo.get_by_id.return_value = {
        "id": address_id,
        "user_id": other_user,
    }
    
    with pytest.raises(HTTPException) as exc:
        await service.get_user_address(address_id, user_id)
    assert exc.value.status_code == 403
