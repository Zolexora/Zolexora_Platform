"""Canonical PostgreSQL identity/profile repository (access comes from the auth service)."""

import uuid
from datetime import datetime

from fastapi import HTTPException

from shared.database.postgres import connection, is_pool_ready, transaction

_PUBLIC_SELECT = """
SELECT u.id, u.auth_user_id, u.email, p.name, p.coin_balance,
       u.phone_number, COALESCE(NULLIF(u.full_name, ''), p.name) AS full_name,
       u.status::text AS status, u.is_phone_verified,
       u.last_login_at, u.metadata, u.is_active, u.is_email_verified,
       p.picture, u.created_at
FROM users u
JOIN user_profile p ON p.user_id = u.id
"""


def _as_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(404, "User not found") from exc


def _row(record) -> dict | None:
    if record is None:
        return None
    result = dict(record)
    result["id"] = str(result["id"])
    if result.get("auth_user_id") is not None:
        result["auth_user_id"] = str(result["auth_user_id"])
    for key, value in tuple(result.items()):
        if isinstance(value, datetime):
            result[key] = value.isoformat()
    return result


def _default_name(identity: dict) -> str:
    name = (identity.get("display_name") or "").strip()
    return name or identity["email"].split("@")[0] or "Customer"


class UserRepository:
    async def get_by_id(self, user_id: str, **_: object) -> dict | None:
        _require_pool()
        async with connection() as conn:
            return _row(await conn.fetchrow(f"{_PUBLIC_SELECT} WHERE u.id = $1", _as_uuid(user_id)))

    async def get_by_email(self, email: str, **_: object) -> dict | None:
        _require_pool()
        async with connection() as conn:
            return _row(await conn.fetchrow(f"{_PUBLIC_SELECT} WHERE u.email = $1", email.strip().lower()))

    async def sync_identity(self, identity: dict) -> dict:
        """The marketplace profile for an auth-service public user, created on first sight.

        An existing profile with the same (auth-service verified) email is adopted once, so
        accounts from before the auth service keep their orders and coins. Email and phone
        follow the auth service, which owns and verifies them.
        """
        _require_pool()
        auth_id = _as_uuid(identity["uid"])
        email = identity["email"].strip().lower()
        phone = identity.get("phone_number") or None
        phone_verified = bool(phone and identity.get("phone_verified") is True)

        async with connection() as conn:
            user = _row(await conn.fetchrow(f"{_PUBLIC_SELECT} WHERE u.auth_user_id = $1", auth_id))
        if user and user["email"] == email and user["phone_number"] == phone and user["is_phone_verified"] == phone_verified:
            return user

        async with transaction() as conn:
            user_id = await conn.fetchval("SELECT id FROM users WHERE auth_user_id = $1", auth_id)
            if user_id is None:
                existing = await conn.fetchrow("SELECT id, auth_user_id FROM users WHERE email = $1 FOR UPDATE", email)
                if existing and existing["auth_user_id"] is not None:
                    raise HTTPException(409, "This email belongs to another marketplace account")
                if existing:
                    user_id = existing["id"]
                    await conn.execute("UPDATE users SET auth_user_id = $2 WHERE id = $1", user_id, auth_id)
                else:
                    user_id = auth_id
                    name = _default_name(identity)
                    await conn.execute(
                        "INSERT INTO users (id, auth_user_id, email, is_email_verified, full_name) VALUES ($1, $1, $2, TRUE, $3)",
                        user_id, email, name,
                    )
                    await conn.execute(
                        "INSERT INTO user_profile (id, user_id, name, coin_balance) VALUES ($1, $1, $2, 20)", user_id, name,
                    )
            if phone:
                # A phone belongs to one auth-service account; drop it from any stale profile.
                await conn.execute(
                    "UPDATE users SET phone_number = NULL, is_phone_verified = FALSE WHERE phone_number = $1 AND id <> $2",
                    phone, user_id,
                )
            await conn.execute(
                """UPDATE users SET email = $2, is_email_verified = TRUE, phone_number = $3,
                          is_phone_verified = $4, last_login_at = NOW(), updated_at = NOW()
                   WHERE id = $1""",
                user_id, email, phone, phone_verified,
            )
        result = await self.get_by_id(str(user_id))
        assert result is not None
        return result

    async def sync_employee(self, identity: dict, organization_id, member_role: str) -> dict:
        """The marketplace user for an auth-service employee (Track 2) of a linked seller
        organisation, with an active membership in it. Employees never adopt an existing
        profile by email: their email is set by the organisation, not verified by them."""
        _require_pool()
        auth_id = _as_uuid(identity["uid"])
        email = (identity.get("email") or "").strip().lower()
        async with transaction() as conn:
            user_id = await conn.fetchval("SELECT id FROM users WHERE auth_user_id = $1", auth_id)
            if user_id is None:
                if await conn.fetchval("SELECT 1 FROM users WHERE email = $1", email):
                    raise HTTPException(409, "This email already has a marketplace account; use a different staff email")
                user_id = auth_id
                name = _default_name(identity)
                await conn.execute(
                    "INSERT INTO users (id, auth_user_id, email, is_email_verified, full_name) VALUES ($1, $1, $2, TRUE, $3)",
                    user_id, email, name,
                )
                await conn.execute("INSERT INTO user_profile (id, user_id, name, coin_balance) VALUES ($1, $1, $2, 0)", user_id, name)
            # Joins on first sign-in; a membership the organisation removed or suspended stays so.
            await conn.execute(
                """INSERT INTO seller_org_member (id, organization_id, user_id, role, status)
                   VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE')
                   ON CONFLICT (organization_id, user_id) DO NOTHING""",
                organization_id, user_id, member_role,
            )
            await conn.execute("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1", user_id)
        result = await self.get_by_id(str(user_id))
        assert result is not None
        return result

    async def list_users(self, limit: int = 50, offset: int = 0) -> list[dict]:
        _require_pool()
        async with connection() as conn:
            rows = await conn.fetch(f"{_PUBLIC_SELECT} ORDER BY u.created_at DESC, u.id LIMIT $1 OFFSET $2", limit, offset)
        return [_row(value) for value in rows]

    async def count_users(self, created_since: datetime | None = None) -> int:
        _require_pool()
        async with connection() as conn:
            return await conn.fetchval(
                "SELECT count(*) FROM users u WHERE $1::timestamptz IS NULL OR u.created_at >= $1", created_since,
            )

    async def update_fields(self, user_id: str, fields: dict) -> bool:
        allowed = {"name", "picture"}
        fields = {key: value for key, value in fields.items() if key in allowed}
        if not fields:
            return False
        assignments = ", ".join(f"{key} = ${index + 2}" for index, key in enumerate(fields))
        async with connection() as conn:
            result = await conn.execute(
                f"UPDATE user_profile SET {assignments} WHERE user_id = $1", _as_uuid(user_id), *fields.values(),
            )
        return result != "UPDATE 0"

    async def update_picture(self, user_id: str, picture_url: str) -> bool:
        return await self.update_fields(user_id, {"picture": picture_url})

    async def set_active(self, user_id: str, active: bool) -> bool:
        async with connection() as conn:
            result = await conn.execute(
                "UPDATE users SET is_active=$2, status=CASE WHEN $2 THEN 'active'::user_status ELSE 'suspended'::user_status END, updated_at=NOW() WHERE id=$1", _as_uuid(user_id), active,
            )
        return result != "UPDATE 0"

    async def adjust_coin_balance(self, user_id: str, delta: int) -> int:
        async with connection() as conn:
            value = await conn.fetchval(
                """UPDATE user_profile SET coin_balance=coin_balance+$2
                   WHERE user_id=$1 AND coin_balance+$2>=0 RETURNING coin_balance""",
                _as_uuid(user_id), delta,
            )
        if value is None:
            raise HTTPException(400, "Insufficient coin balance")
        return value


async def get_user_repository() -> UserRepository:
    return UserRepository()


def _require_pool() -> None:
    if not is_pool_ready():
        raise HTTPException(503, "Database is temporarily unavailable. Please try again shortly.")
