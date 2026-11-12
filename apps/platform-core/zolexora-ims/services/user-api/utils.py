import uuid
from datetime import datetime, timezone


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_utc_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def generate_id(prefix: str = "ID") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10].upper()}"
