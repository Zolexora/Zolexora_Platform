from datetime import datetime


def mapping_overlaps(
    start: datetime,
    end: datetime | None,
    existing: list[tuple[datetime, datetime | None]],
) -> bool:
    ceiling = datetime.max.replace(tzinfo=start.tzinfo)
    return any(start < (old_end or ceiling) and old_start < (end or ceiling) for old_start, old_end in existing)


def classify_inbox_duplicate(existing_hash: str, incoming_hash: str) -> str:
    return "duplicate" if existing_hash == incoming_hash else "conflict"
