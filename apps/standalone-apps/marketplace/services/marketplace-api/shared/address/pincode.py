import json
import logging
from abc import ABC, abstractmethod
from typing import Optional, List
import httpx

from shared.database.redis import get_redis
from shared.address.models import PincodeResult, PostOfficeInfo

logger = logging.getLogger(__name__)

PINCODE_CACHE_TTL_SECONDS = 86400  # 24 hours


class PincodeProvider(ABC):
    """Abstract postal geography provider."""

    @abstractmethod
    async def lookup(self, pincode: str) -> Optional[PincodeResult]:
        """Lookup and resolve geographic metadata for an Indian pincode."""
        pass


class FreePincodeProvider(PincodeProvider):
    """
    Production-grade free Indian Pincode resolver.
    Uses https://api.postalpincode.in/pincode/{pincode} with Redis caching
    and robust fallback resilience.
    """

    API_URL = "https://api.postalpincode.in/pincode/{pincode}"

    # Built-in offline fallback database for known development / test pincodes
    OFFLINE_SAMPLE_DB = {
        "203207": {
            "pincode": "203207",
            "country": "INDIA",
            "state": "UTTAR PRADESH",
            "region": "LUCKNOW",
            "division": "BULANDSHAHR",
            "district": "BULANDSHAHR",
            "postal_delivery_status": "DELIVERY AVAILABLE",
            "post_offices": [
                {"name": "DADRI", "delivery_status": "Delivery"},
                {"name": "SHIV SHAKTI", "delivery_status": "Delivery"},
                {"name": "BILASPUR", "delivery_status": "Delivery"},
            ],
        },
        "110001": {
            "pincode": "110001",
            "country": "INDIA",
            "state": "DELHI",
            "region": "DELHI",
            "division": "NEW DELHI",
            "district": "CENTRAL DELHI",
            "postal_delivery_status": "DELIVERY AVAILABLE",
            "post_offices": [
                {"name": "CONNAUGHT PLACE", "delivery_status": "Delivery"},
                {"name": "JANPATH", "delivery_status": "Delivery"},
                {"name": "PARLIAMENT STREET", "delivery_status": "Delivery"},
            ],
        },
        "400001": {
            "pincode": "400001",
            "country": "INDIA",
            "state": "MAHARASHTRA",
            "region": "MUMBAI",
            "division": "MUMBAI G.P.O.",
            "district": "MUMBAI",
            "postal_delivery_status": "DELIVERY AVAILABLE",
            "post_offices": [
                {"name": "MUMBAI G.P.O.", "delivery_status": "Delivery"},
                {"name": "FORT", "delivery_status": "Delivery"},
                {"name": "STOCK EXCHANGE", "delivery_status": "Delivery"},
            ],
        },
        "560001": {
            "pincode": "560001",
            "country": "INDIA",
            "state": "KARNATAKA",
            "region": "BANGALORE HQ",
            "division": "BANGALORE EAST",
            "district": "BANGALORE",
            "postal_delivery_status": "DELIVERY AVAILABLE",
            "post_offices": [
                {"name": "BANGALORE G.P.O.", "delivery_status": "Delivery"},
                {"name": "RAJBHAVAN", "delivery_status": "Delivery"},
            ],
        },
    }

    async def lookup(self, pincode: str) -> Optional[PincodeResult]:
        clean_pin = pincode.strip()
        if not clean_pin.isdigit() or len(clean_pin) != 6:
            return None

        redis = get_redis()
        cache_key = f"pincode:IN:{clean_pin}"

        # 1. Check Redis Cache
        try:
            cached_val = await redis.get(cache_key)
            if cached_val:
                data = json.loads(cached_val)
                return PincodeResult(**data)
        except Exception as e:
            logger.warning("Redis cache read failed for pincode %s: %s", clean_pin, e)

        # 2. Query External API
        result: Optional[PincodeResult] = None
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(self.API_URL.format(pincode=clean_pin))
                if resp.status_code == 200:
                    payload = resp.json()
                    if isinstance(payload, list) and len(payload) > 0:
                        item = payload[0]
                        if item.get("Status") == "Success" and item.get("PostOffice"):
                            po_list = item["PostOffice"]
                            if po_list:
                                first_po = po_list[0]
                                state = (first_po.get("State") or "INDIA").upper()
                                region = (first_po.get("Region") or "").upper()
                                division = (first_po.get("Division") or "").upper()
                                district = (first_po.get("District") or "").upper()
                                country = (first_po.get("Country") or "INDIA").upper()

                                parsed_pos: List[PostOfficeInfo] = []
                                has_delivery = False
                                for po in po_list:
                                    po_name = (po.get("Name") or "").upper()
                                    del_stat = po.get("DeliveryStatus") or "Delivery"
                                    if del_stat.lower() == "delivery":
                                        has_delivery = True
                                    parsed_pos.append(
                                        PostOfficeInfo(
                                            name=po_name,
                                            delivery_status=del_stat,
                                            circle=(po.get("Circle") or "").upper(),
                                            district=district,
                                            division=division,
                                            region=region,
                                            state=state,
                                            country=country,
                                        )
                                    )

                                result = PincodeResult(
                                    pincode=clean_pin,
                                    country=country,
                                    state=state,
                                    region=region or district,
                                    division=division or district,
                                    district=district,
                                    post_offices=parsed_pos,
                                    postal_delivery_status="DELIVERY AVAILABLE" if has_delivery else "DELIVERY NOT AVAILABLE",
                                )
        except Exception as err:
            logger.warning("External postal API lookup failed for pincode %s: %s", clean_pin, err)

        # 3. Fallback to offline sample database if external API is unreachable
        if not result and clean_pin in self.OFFLINE_SAMPLE_DB:
            raw = self.OFFLINE_SAMPLE_DB[clean_pin]
            result = PincodeResult(
                pincode=raw["pincode"],
                country=raw["country"],
                state=raw["state"],
                region=raw["region"],
                division=raw["division"],
                district=raw["district"],
                postal_delivery_status=raw["postal_delivery_status"],
                post_offices=[PostOfficeInfo(**po) for po in raw["post_offices"]],
            )

        # 4. If we resolved a valid result, cache it in Redis
        if result:
            try:
                await redis.set(cache_key, result.model_dump_json(), ex=PINCODE_CACHE_TTL_SECONDS)
            except Exception as e:
                logger.warning("Failed to cache pincode %s in Redis: %s", clean_pin, e)

        return result


_pincode_provider: Optional[PincodeProvider] = None


def get_pincode_provider() -> PincodeProvider:
    global _pincode_provider
    if _pincode_provider is None:
        _pincode_provider = FreePincodeProvider()
    return _pincode_provider
