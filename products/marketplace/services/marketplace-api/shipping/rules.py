from typing import List, Optional, Tuple
from shipping.schemas import CourierOption
import logging

logger = logging.getLogger("zolexora.shipping.rules")

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_DELIVERY_DAYS = 6

# Fallback preference order when cost and delivery days are equal
PROVIDER_PREFERENCE = [
    "delhivery",
    "nimbuspost",
    "shiprocket",
    "dtdc",
    "bluedart",
    "indiapost",
    "pickrr",
]


def _provider_rank(provider: str) -> int:
    try:
        return PROVIDER_PREFERENCE.index(provider.lower())
    except ValueError:
        return 999


def filter_and_rank(options: List[CourierOption]) -> Tuple[List[CourierOption], List[CourierOption]]:
    """
    Apply business rules and return (valid_ranked, rejected).

    Valid options:
      - serviceable = True
      - booking_supported = True
      - estimated_delivery_days <= MAX_DELIVERY_DAYS
      - estimated_cost is not None

    Sorted by:
      1. lowest estimated_cost
      2. lowest estimated_delivery_days
      3. PROVIDER_PREFERENCE order
    """
    valid: List[CourierOption] = []
    rejected: List[CourierOption] = []

    for opt in options:
        reason = _reject_reason(opt)
        if reason:
            opt.rejected_reason = reason
            rejected.append(opt)
        else:
            valid.append(opt)

    valid.sort(key=lambda o: (
        o.estimated_cost or 9999,
        o.estimated_delivery_days or 999,
        _provider_rank(o.provider),
    ))

    # Attach ranking position
    for i, o in enumerate(valid):
        o.raw_payload["__ranking_position"] = i + 1

    logger.info(
        "Routing: %d options evaluated — %d valid, %d rejected",
        len(options), len(valid), len(rejected),
    )
    return valid, rejected


def _reject_reason(opt: CourierOption) -> Optional[str]:
    if not opt.serviceable:
        return "non_serviceable"
    if not opt.booking_supported:
        return "booking_not_supported"
    if opt.estimated_cost is None:
        return "cost_unknown"
    if opt.estimated_delivery_days is None:
        return "delivery_days_unknown"
    if opt.estimated_delivery_days > MAX_DELIVERY_DAYS:
        return f"delivery_exceeds_{MAX_DELIVERY_DAYS}_days"
    return None


def select_best(valid_options: List[CourierOption]) -> Optional[CourierOption]:
    """Return the highest-ranked valid option, or None."""
    return valid_options[0] if valid_options else None
