"""Advanced user lifecycle, RBAC, and immutable admin audit endpoints."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from shared.database.postgres import connection, transaction
from .dependencies import admin_context, require_permission
from .schemas import (
    AdminSummary,
    AdminUserItem,
    AdminUserPage,
    AuditLogItem,
    UserStatusPatch,
)

router = APIRouter(prefix="/admin", tags=["administration"])


def _user_from_row(row) -> AdminUserItem:
    data = dict(row)
    data["id"] = str(data["id"])
    return AdminUserItem(**data)


async def _audit(conn, admin: dict, request: Request, action: str, target: str | None, details: dict) -> None:
    request.state.admin_audit_recorded = True
    await conn.execute(
        """INSERT INTO public.admin_audit_logs
           (admin_id, admin_email, action_type, target_user_id, details, ip_address, request_id)
           VALUES ($1::uuid, $2, $3, $4::uuid, $5::jsonb, $6, $7)""",
        admin["id"], admin["email"], action, target, json.dumps(details, default=str),
        request.client.host if request.client else None,
        getattr(request.state, "request_id", None),
    )


@router.get("/users", response_model=AdminUserPage)
async def list_managed_users(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _admin: dict = Depends(require_permission("users:read")),
) -> AdminUserPage:
    if status and status not in {"active", "suspended", "banned", "pending_verification"}:
        raise HTTPException(400, "Invalid user status")
    clauses: list[str] = []
    args: list = []
    if status:
        args.append(status)
        clauses.append(f"u.status = ${len(args)}::user_status")
    if search:
        args.append(f"%{search.strip()}%")
        clauses.append(f"(u.email ILIKE ${len(args)} OR u.phone_number ILIKE ${len(args)} OR u.full_name ILIKE ${len(args)})")
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    async with connection() as conn:
        total = await conn.fetchval(f"SELECT count(*) FROM public.users u {where}", *args)
        args.extend([limit, offset])
        rows = await conn.fetch(
            f"""SELECT u.id, u.email, u.phone_number, u.full_name, p.name, p.coin_balance,
                       u.status::text AS status, u.is_active, u.is_email_verified,
                       u.is_phone_verified,
                       u.created_at, u.last_login_at
                FROM public.users u
                LEFT JOIN public.user_profile p ON p.user_id=u.id
                {where}
                ORDER BY u.created_at DESC, u.id
                LIMIT ${len(args)-1} OFFSET ${len(args)}""",
            *args,
        )
    return AdminUserPage(items=[_user_from_row(row) for row in rows], total=total, limit=limit, offset=offset)


@router.patch("/users/{user_id}/status", response_model=AdminUserItem)
async def update_user_status(
    user_id: str,
    patch: UserStatusPatch,
    request: Request,
    admin: dict = Depends(require_permission("users:write")),
) -> AdminUserItem:
    try:
        target = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(404, "User not found") from exc
    async with transaction() as conn:
        current = await conn.fetchrow("SELECT id, status::text, is_active FROM public.users WHERE id=$1", target)
        if current is None:
            raise HTTPException(404, "User not found")
        active = patch.status == "active"
        await conn.execute("UPDATE public.users SET status=$2::user_status, is_active=$3, updated_at=NOW() WHERE id=$1", target, patch.status, active)
        await _audit(conn, admin, request, "USER_STATUS_CHANGED", user_id, {"from": current["status"], "to": patch.status, "reason": patch.reason})
        row = await conn.fetchrow("""SELECT u.id,u.email,u.phone_number,u.full_name,p.name,p.coin_balance,u.status::text AS status,
            u.is_active,u.is_email_verified,u.is_phone_verified,
            u.created_at,u.last_login_at
            FROM users u LEFT JOIN user_profile p ON p.user_id=u.id WHERE u.id=$1""", target)
    return _user_from_row(row)


@router.get("/rbac/me", response_model=AdminSummary)
async def get_my_admin_permissions(admin: dict = Depends(admin_context)) -> AdminSummary:
    return AdminSummary(
        id=admin["id"], email=admin["email"], full_name=admin["full_name"],
        role=admin["admin_role"], permissions=admin["permissions"], is_active=True,
    )


@router.get("/audit", response_model=list[AuditLogItem])
async def list_admin_audit_logs(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), admin: dict = Depends(require_permission("audit:read"))) -> list[AuditLogItem]:
    async with connection() as conn:
        rows = await conn.fetch("SELECT id::text,action_type,admin_id::text,admin_email,target_user_id::text,details,ip_address,request_id,created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2", limit, offset)
    return [
        AuditLogItem(**{**dict(row), "details": json.loads(row["details"]) if isinstance(row["details"], str) else row["details"]})
        for row in rows
    ]
