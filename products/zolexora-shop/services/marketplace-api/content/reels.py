"""Reels in PostgreSQL (reel, reel_view). Routes work with the reel document the API has always
returned; storefront_id is the storefront key."""

import json
import uuid
from datetime import datetime

_SELECT = "SELECT r.*, s.storefront_key FROM reel r JOIN storefront s ON s.id = r.storefront_id"
_EDITABLE = {"title", "description", "linked_product_id", "sponsor_data", "is_active",
             "video_url", "thumbnail_url", "media_type"}


def _uuid(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _key(storefront):
    return None if storefront is None else str(getattr(storefront, "value", storefront))


def _doc(row) -> dict:
    doc = {k: row[k] for k in row.keys() if k not in ("storefront_id", "storefront_key")}
    sponsor = doc.get("sponsor_data")
    return {**doc, "id": str(row["id"]), "creator_id": str(row["creator_id"]), "storefront_id": row["storefront_key"],
            "sponsor_data": json.loads(sponsor) if isinstance(sponsor, str) else sponsor,
            "created_at": row["created_at"].isoformat() if isinstance(row["created_at"], datetime) else row["created_at"]}


def _where(q: dict) -> tuple[str, list]:
    """Filters: id, storefront (key), creator_id, is_active, content_type."""
    sql, args = [], []
    for key, column in (("id", "r.id"), ("creator_id", "r.creator_id")):
        if q.get(key) is not None:
            value = _uuid(q[key])
            args.append(value)
            sql.append(f"{column} = ${len(args)}" if value else "FALSE")
    for key, column, value in (("storefront", "s.storefront_key", _key(q.get("storefront"))),
                               ("is_active", "r.is_active", q.get("is_active")),
                               ("content_type", "r.content_type", q.get("content_type"))):
        if value is not None:
            args.append(value)
            sql.append(f"{column} = ${len(args)}")
    return (" WHERE " + " AND ".join(sql)) if sql else "", args


async def get(conn, **q) -> dict | None:
    where, args = _where(q)
    row = await conn.fetchrow(f"{_SELECT}{where} LIMIT 1", *args)
    return _doc(row) if row else None


async def find(conn, *, limit: int = 500, skip: int = 0, **q) -> list[dict]:
    where, args = _where(q)
    rows = await conn.fetch(f"{_SELECT}{where} ORDER BY r.created_at DESC LIMIT {int(limit)} OFFSET {int(skip)}", *args)
    return [_doc(r) for r in rows]


async def count(conn, **q) -> int:
    where, args = _where(q)
    return await conn.fetchval(f"SELECT count(*) FROM reel r JOIN storefront s ON s.id = r.storefront_id{where}", *args)


async def create(conn, storefront, creator_id: str, creator_name: str, data: dict) -> dict:
    row = await conn.fetchrow(
        """INSERT INTO reel (id, storefront_id, creator_id, creator_name, title, description,
                             linked_product_id, content_type, sponsor_data)
           SELECT $1, s.id, $3, $4, $5, $6, $7, $8, $9::jsonb FROM storefront s WHERE s.storefront_key = $2
           RETURNING id""",
        uuid.uuid4(), _key(storefront), uuid.UUID(str(creator_id)), creator_name or "", data["title"],
        data.get("description") or "", data.get("linked_product_id"), data.get("content_type") or "organic",
        json.dumps(data.get("sponsor_data")) if data.get("sponsor_data") is not None else None)
    return await get(conn, id=row["id"])


async def update(conn, fields: dict, **q) -> bool:
    """Changes the editable fields of the reels matching q; False when none matched."""
    fields = {k: v for k, v in fields.items() if k in _EDITABLE}
    where, args = _where(q)
    if not fields:
        return bool(await conn.fetchval(f"SELECT 1 FROM reel r JOIN storefront s ON s.id = r.storefront_id{where} LIMIT 1", *args))
    sets = []
    for k, v in fields.items():
        args.append(json.dumps(v) if k == "sponsor_data" and v is not None else v)
        sets.append(f"{k} = ${len(args)}" + ("::jsonb" if k == "sponsor_data" else ""))
    return bool(await conn.fetch(
        f"UPDATE reel r SET {', '.join(sets)} FROM storefront s WHERE s.id = r.storefront_id"
        f"{where.replace(' WHERE ', ' AND ', 1)} RETURNING r.id", *args))


async def toggle(conn, **q) -> bool | None:
    where, args = _where(q)
    return await conn.fetchval(
        f"UPDATE reel r SET is_active = NOT r.is_active FROM storefront s WHERE s.id = r.storefront_id"
        f"{where.replace(' WHERE ', ' AND ', 1)} RETURNING r.is_active", *args)


async def delete(conn, **q) -> None:
    where, args = _where(q)
    await conn.execute(f"DELETE FROM reel r USING storefront s WHERE s.id = r.storefront_id{where.replace(' WHERE ', ' AND ', 1)}", *args)


async def add_view(conn, reel: dict, user_id: str | None) -> bool:
    """Counts a view; for a signed-in viewer also records it, once a day per reel. True when
    this is the viewer's first view of the reel today (the one that earns coins)."""
    await conn.execute("UPDATE reel SET views_count = views_count + 1 WHERE id = $1", uuid.UUID(reel["id"]))
    if not user_id:
        return False
    return bool(await conn.fetchval(
        """INSERT INTO reel_view (id, reel_id, storefront_id, user_id)
           SELECT $1, r.id, r.storefront_id, $3 FROM reel r WHERE r.id = $2
           ON CONFLICT (user_id, reel_id, view_date) DO NOTHING RETURNING true""",
        uuid.uuid4(), uuid.UUID(reel["id"]), uuid.UUID(str(user_id))))


async def view_count(conn, *, storefront=None, since: datetime | None = None) -> int:
    return await conn.fetchval(
        """SELECT count(*) FROM reel_view v JOIN storefront s ON s.id = v.storefront_id
           WHERE ($1::text IS NULL OR s.storefront_key = $1) AND ($2::timestamptz IS NULL OR v.created_at >= $2)""",
        _key(storefront), since)
