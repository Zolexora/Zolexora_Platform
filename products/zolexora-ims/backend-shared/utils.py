import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def now_utc_iso() -> str:
    """Returns current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def today_utc_str() -> str:
    """Returns current UTC date string (YYYY-MM-DD)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def generate_id(prefix: str = "ID") -> str:
    """Generates a prefixed unique identifier."""
    return f"{prefix}_{uuid.uuid4().hex[:10].upper()}"


def safe_float(val: Any, default: float = 0.0) -> float:
    """Safely converts value to float."""
    try:
        if val is None:
            return default
        return float(val)
    except (ValueError, TypeError):
        return default


def paginate_list(items: List[Any], page: int = 1, page_size: int = 50) -> Dict[str, Any]:
    """Paginates an in-memory list."""
    start = (page - 1) * page_size
    end = start + page_size
    total = len(items)
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 1
    }
