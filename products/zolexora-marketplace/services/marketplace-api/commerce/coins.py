"""Coins: the balance lives on user_profile, every change is a coin_transaction row written in
the same transaction, so the history always adds up to the balance."""

import uuid
from datetime import datetime

from fastapi import HTTPException


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else value


async def move(conn, user_id: str, amount: int, type_: str, description: str, ref_id: str | None = None) -> int:
    """Adds `amount` (negative to spend) and records it; 400 if the balance would go below zero.
    Run inside the caller's transaction, or on its own."""
    async with conn.transaction():
        balance = await conn.fetchval(
            """UPDATE user_profile SET coin_balance = coin_balance + $2
               WHERE user_id = $1 AND coin_balance + $2 >= 0 RETURNING coin_balance""",
            uuid.UUID(str(user_id)), amount)
        if balance is None:
            raise HTTPException(400, "Insufficient coin balance")
        await conn.execute(
            """INSERT INTO coin_transaction (id, user_id, amount, type, description, ref_id)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            uuid.uuid4(), uuid.UUID(str(user_id)), amount, type_, description[:500], ref_id)
    return balance


async def history(conn, user_id: str, limit: int = 100) -> list[dict]:
    rows = await conn.fetch(
        """SELECT id, user_id, amount, type, description, ref_id, created_at FROM coin_transaction
           WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2""", uuid.UUID(str(user_id)), limit)
    return [{**dict(r), "id": str(r["id"]), "user_id": str(r["user_id"]), "created_at": _iso(r["created_at"])} for r in rows]


async def earned_count(conn, *, user_id: str | None = None, since: datetime) -> int:
    return await conn.fetchval(
        """SELECT count(*) FROM coin_transaction
           WHERE type = 'earned' AND created_at >= $1 AND ($2::uuid IS NULL OR user_id = $2)""",
        since, uuid.UUID(str(user_id)) if user_id else None)
