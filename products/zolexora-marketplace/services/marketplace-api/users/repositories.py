"""Canonical PostgreSQL identity/profile/RBAC repository."""

import uuid
from datetime import datetime

from fastapi import HTTPException

from shared.database.postgres import connection, is_pool_ready, transaction

_PUBLIC_SELECT = """
SELECT u.id, u.auth_user_id, u.email, p.name, r.role_key AS role, p.coin_balance,
       u.phone_number, COALESCE(NULLIF(u.full_name, ''), p.name) AS full_name,
       u.status::text AS status, u.is_phone_verified,
       u.last_login_at, u.metadata, u.is_active, u.is_email_verified,
       p.picture, u.created_at
FROM users u
JOIN user_profile p ON p.user_id = u.id
JOIN user_role ur ON ur.user_id = u.id
JOIN role r ON r.id = ur.role_id
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
                    role_id = await conn.fetchval("SELECT id FROM role WHERE role_key = 'buyer'")
                    name = _default_name(identity)
                    await conn.execute(
                        "INSERT INTO users (id, auth_user_id, email, is_email_verified, full_name) VALUES ($1, $1, $2, TRUE, $3)",
                        user_id, email, name,
                    )
                    await conn.execute(
                        "INSERT INTO user_profile (id, user_id, name, coin_balance) VALUES ($1, $1, $2, 20)", user_id, name,
                    )
                    await conn.execute("INSERT INTO user_role (id, user_id, role_id) VALUES ($1, $1, $2)", user_id, role_id)
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

    async def list_users(self, limit: int = 50, offset: int = 0, role: str | None = None) -> list[dict]:
        _require_pool()
        args: list = []
        where = ""
        if role:
            args.append("buyer" if role == "viewer" else role)
            where = "WHERE r.role_key = $1"
        args.extend((limit, offset))
        async with connection() as conn:
            rows = await conn.fetch(
                f"{_PUBLIC_SELECT} {where} ORDER BY u.created_at DESC, u.id LIMIT ${len(args)-1} OFFSET ${len(args)}",
                *args,
            )
        return [_row(value) for value in rows]

    async def count_users(self, role: str | None = None, created_since: datetime | None = None) -> int:
        _require_pool()
        clauses: list[str] = []
        values: list = []
        if role:
            values.append("buyer" if role == "viewer" else role)
            clauses.append(f"r.role_key = ${len(values)}")
        if created_since:
            values.append(created_since)
            clauses.append(f"u.created_at >= ${len(values)}")
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        async with connection() as conn:
            return await conn.fetchval(
                f"SELECT count(*) FROM users u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id {where}",
                *values,
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

    async def set_role(self, user_id: str, role: str) -> bool:
        role = "buyer" if role == "viewer" else role
        async with transaction() as conn:
            role_id = await conn.fetchval("SELECT id FROM role WHERE role_key=$1", role)
            if role_id is None:
                raise HTTPException(400, "Invalid role")
            result = await conn.execute(
                "UPDATE user_role SET role_id=$2 WHERE user_id=$1", _as_uuid(user_id), role_id,
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
