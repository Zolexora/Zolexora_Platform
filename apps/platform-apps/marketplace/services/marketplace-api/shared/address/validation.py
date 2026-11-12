import logging
from abc import ABC, abstractmethod
from typing import Optional
from shared.address.models import AddressValidationResult

logger = logging.getLogger(__name__)


class AddressValidationProvider(ABC):
    """Abstract address validation provider."""

    @abstractmethod
    async def validate_address(
        self,
        house_no: str,
        village_town: str,
        pincode: str,
        landmark: Optional[str] = None,
        state: Optional[str] = None,
    ) -> AddressValidationResult:
        pass


class GoogleAddressValidationProvider(AddressValidationProvider):
    """
    Google Address Validation API integration provider.
    Uses GOOGLE_ADDRESS_VALIDATION_API_KEY from server-side environment.
    """

    async def validate_address(
        self,
        house_no: str,
        village_town: str,
        pincode: str,
        landmark: Optional[str] = None,
        state: Optional[str] = None,
    ) -> AddressValidationResult:
        # Basic structural validation
        if not house_no or not village_town or not pincode or len(pincode) != 6:
            return AddressValidationResult(
                status="INVALID",
                provider="GOOGLE",
                is_complete=False,
                message="Missing mandatory address components",
            )

        # No Google call is made yet: the address is complete, not verified.
        return AddressValidationResult(
            status="UNVALIDATED",
            provider="NONE",
            is_complete=True,
            message="Address is complete; it has not been verified",
        )


_validation_provider: Optional[AddressValidationProvider] = None


def get_address_validation_provider() -> AddressValidationProvider:
    global _validation_provider
    if _validation_provider is None:
        _validation_provider = GoogleAddressValidationProvider()
    return _validation_provider
