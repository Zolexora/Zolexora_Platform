"""Canonical PostgreSQL identity/profile/RBAC repository."""

import uuid
import time
from datetime import datetime

from fastapi import HTTPException

from shared.database.postgres import connection, is_pool_ready, transaction

_PUBLIC_SELECT = """
SELECT u.id, u.email, p.name, r.role_key AS role, p.coin_balance,
       u.firebase_uid, u.phone_number, COALESCE(NULLIF(u.full_name, ''), p.name) AS full_name,
       u.status::text AS status, u.is_phone_verified,
       u.last_login_at, u.metadata, u.is_active, u.is_email_verified,
       'firebase' AS auth_provider,
       p.picture, u.created_at, u.auth_version
FROM users u
JOIN user_profile p ON p.user_id = u.id
JOIN user_role ur ON ur.user_id = u.id
JOIN role r ON r.id = ur.role_id
"""


def _as_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(404, "User not found") from exc


def _row(record, *, internal: bool = False) -> dict | None:
    if record is None:
        return None
    result = dict(record)
    result["id"] = str(result["id"])
    for key, value in tuple(result.items()):
        if isinstance(value, datetime):
            result[key] = value.isoformat()
    if not internal:
        result.pop("auth_version", None)
    return result


_USER_CACHE: dict[str, tuple[float, dict | None]] = {}

def _invalidate_user_cache(user_id: str | None = None, email: str | None = None) -> None:
    if user_id:
        _USER_CACHE.pop(f"{user_id}:True", None)
        _USER_CACHE.pop(f"{user_id}:False", None)
    if email:
        _USER_CACHE.pop(f"email:{email.strip().lower()}:True", None)
        _USER_CACHE.pop(f"email:{email.strip().lower()}:False", None)
    if not user_id and not email:
        _USER_CACHE.clear()


class UserRepository:
    async def get_by_id(self, user_id: str, *, internal: bool = False) -> dict | None:
        cache_key = f"{user_id}:{internal}"
        now = time.time()
        if cache_key in _USER_CACHE:
            ts, val = _USER_CACHE[cache_key]
            if now - ts < 60:
                return dict(val) if val is not None else None

        _require_pool()
        query = _PUBLIC_SELECT
        async with connection() as conn:
            res = _row(await conn.fetchrow(f"{query} WHERE u.id = $1", _as_uuid(user_id)), internal=internal)
            if res is not None:
                _USER_CACHE[cache_key] = (now, dict(res))
                if "email" in res:
                    _USER_CACHE[f"email:{res['email'].strip().lower()}:{internal}"] = (now, dict(res))
                return dict(res)
            return None

    async def get_by_email(self, email: str, *, internal: bool = False) -> dict | None:
        normalized_email = email.strip().lower()
        cache_key = f"email:{normalized_email}:{internal}"
        now = time.time()
        if cache_key in _USER_CACHE:
            ts, val = _USER_CACHE[cache_key]
            if now - ts < 60:
                return dict(val) if val is not None else None

        _require_pool()
        query = _PUBLIC_SELECT
        async with connection() as conn:
            res = _row(await conn.fetchrow(f"{query} WHERE u.email = $1", normalized_email), internal=internal)
            if res is not None:
                _USER_CACHE[cache_key] = (now, dict(res))
                if "id" in res:
                    _USER_CACHE[f"{res['id']}:{internal}"] = (now, dict(res))
                return dict(res)
            return None

    async def get_by_phone(self, phone: str, *, internal: bool = False) -> dict | None:
        clean_phone = phone.strip().replace(" ", "").replace("-", "")
        _require_pool()
        base_select = _PUBLIC_SELECT
        query = f"""
        {base_select}
        JOIN public.buyer_address ba ON ba.buyer_id = u.id
        WHERE ba.phone = $1
        ORDER BY ba.is_default DESC, ba.created_at DESC
        LIMIT 1
        """
        async with connection() as conn:
            res = _row(await conn.fetchrow(query, clean_phone), internal=internal)
            return dict(res) if res is not None else None

    async def get_by_external_identity(self, provider: str, subject: str, *, internal: bool = False) -> dict | None:
        _require_pool()
        query = _PUBLIC_SELECT
        async with connection() as conn:
            result = await conn.fetchrow(
                f"{query} JOIN external_identity ei ON ei.user_id = u.id "
                "WHERE ei.provider = $1 AND ei.subject = $2",
                provider,
                subject,
            )
        return _row(result, internal=internal)

    async def get_external_identity_subject(self, user_id: str, provider: str = "firebase") -> str | None:
        """Return the single Firebase subject bound to a Marketplace identity."""
        _require_pool()
        async with connection() as conn:
            return await conn.fetchval(
                "SELECT subject FROM external_identity WHERE user_id=$1 AND provider=$2 LIMIT 1",
                _as_uuid(user_id), provider,
            )

    async def link_external_identity(self, *, user_id: str, provider: str, subject: str) -> None:
        _require_pool()
        async with connection() as conn:
            try:
                await conn.execute(
                    "INSERT INTO external_identity (id, user_id, provider, subject) VALUES ($1, $2, $3, $4)",
                    uuid.uuid4(),
                    _as_uuid(user_id),
                    provider,
                    subject,
                )
                if provider == "firebase":
                    await conn.execute(
                        "UPDATE users SET firebase_uid = COALESCE(firebase_uid, $2) WHERE id = $1",
                        _as_uuid(user_id), subject,
                    )
                    await conn.execute(
                        """INSERT INTO user_auth_providers
                           (user_id, provider_uid, provider_email)
                           SELECT $1, $2, email
                           FROM users WHERE id=$1
                           ON CONFLICT (provider_uid) DO NOTHING""",
                        _as_uuid(user_id), subject,
                    )
            except Exception as exc:
                raise HTTPException(409, "This Firebase identity is already linked") from exc

    async def record_auth_provider(
        self,
        *,
        user_id: str,
        provider_uid: str,
        provider_email: str | None = None,
    ) -> None:
        """Record a Firebase sign-in provider without storing credentials."""
        _require_pool()
        async with connection() as conn:
            await conn.execute(
                """INSERT INTO user_auth_providers
                   (user_id, provider_uid, provider_email, last_used_at)
                   VALUES ($1, $2, $3, NOW())
                   ON CONFLICT (provider_uid) DO UPDATE SET
                     user_id=EXCLUDED.user_id,
                     provider_email=COALESCE(EXCLUDED.provider_email, user_auth_providers.provider_email),
                     last_used_at=NOW()""",
                _as_uuid(user_id), provider_uid, provider_email,
            )
            await conn.execute(
                "UPDATE users SET last_login_at=NOW(), updated_at=NOW() WHERE id=$1::uuid",
                _as_uuid(user_id),
            )

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

    async def create_identity(
        self,
        *,
        email: str,
        name: str,
        password_hash: str | None,
        role: str = "buyer",
        user_id: str | None = None,
        coin_balance: int = 20,
        is_email_verified: bool = True,
        identity_source: str | None = None,
        picture: str | None = None,
        internal: bool = False,
    ) -> dict:
        _require_pool()
        _invalidate_user_cache(str(user_id) if user_id else None, email)
        identity_id = uuid.UUID(user_id) if user_id else uuid.uuid4()
        async with transaction() as conn:
            role_id = await conn.fetchval("SELECT id FROM role WHERE role_key = $1", role)
            if role_id is None:
                raise HTTPException(400, "Invalid role")
            await conn.execute(
                """INSERT INTO users (id,email,is_email_verified,full_name)
                   VALUES ($1,$2,$3,$4)""",
                identity_id, email.strip().lower(), is_email_verified, name.strip(),
            )
            await conn.execute(
                """INSERT INTO user_profile (id,user_id,name,coin_balance,picture)
                   VALUES ($1,$1,$2,$3,$4)""",
                identity_id, name.strip(), coin_balance, picture,
            )
            await conn.execute(
                "INSERT INTO user_role (id,user_id,role_id) VALUES ($1,$1,$2)", identity_id, role_id,
            )
        result = await self.get_by_id(str(identity_id), internal=internal)
        assert result is not None
        return result

    async def create_user(self, **kwargs) -> dict:
        return await self.create_identity(
            user_id=kwargs.get("auth_user_id"), email=kwargs["email"], name=kwargs["name"],
            password_hash=kwargs.get("password_hash"), role="buyer" if kwargs.get("role", "buyer") == "viewer" else kwargs.get("role", "buyer"),
            coin_balance=kwargs.get("coin_balance", 0), is_email_verified=kwargs.get("is_email_verified", False),
            picture=kwargs.get("picture"),
        )

    async def update_fields(self, user_id: str, fields: dict) -> bool:
        _invalidate_user_cache(str(user_id))
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

    async def update_password_hash(self, user_id: str, password_hash: str, *, revoke_sessions: bool = False) -> int:
        raise HTTPException(410, "Password credentials are managed by Firebase Authentication")

    async def increment_auth_version(self, user_id: str) -> int:
        _invalidate_user_cache(str(user_id))
        async with connection() as conn:
            value = await conn.fetchval(
                "UPDATE users SET auth_version=auth_version+1 WHERE id=$1 RETURNING auth_version", _as_uuid(user_id),
            )
        if value is None:
            raise HTTPException(404, "User not found")
        return value

    async def set_active(self, user_id: str, active: bool) -> bool:
        _invalidate_user_cache(str(user_id))
        async with connection() as conn:
            result = await conn.execute(
                "UPDATE users SET is_active=$2, auth_version=auth_version+1 WHERE id=$1", _as_uuid(user_id), active,
            )
        return result != "UPDATE 0"

    async def set_role(self, user_id: str, role: str) -> bool:
        _invalidate_user_cache(str(user_id))
        role = "buyer" if role == "viewer" else role
        async with transaction() as conn:
            role_id = await conn.fetchval("SELECT id FROM role WHERE role_key=$1", role)
            if role_id is None:
                raise HTTPException(400, "Invalid role")
            result = await conn.execute(
                "UPDATE user_role SET role_id=$2 WHERE user_id=$1", _as_uuid(user_id), role_id,
            )
            if result != "UPDATE 0":
                await conn.execute("UPDATE users SET auth_version=auth_version+1 WHERE id=$1", _as_uuid(user_id))
        return result != "UPDATE 0"

    async def adjust_coin_balance(self, user_id: str, delta: int) -> int:
        _invalidate_user_cache(str(user_id))
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
