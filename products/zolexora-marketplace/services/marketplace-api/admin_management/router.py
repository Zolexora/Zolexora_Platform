"""Advanced user lifecycle, RBAC, and immutable admin audit endpoints."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from shared.database.postgres import connection, transaction
from .dependencies import admin_context, require_permission
from .schemas import (
    AdminPermissionPatch,
    AdminCreate,
    AdminRolePatch,
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
    data["providers"] = list(data.get("providers") or [])
    return AdminUserItem(**data)


async def _audit(conn, admin: dict, request: Request, action: str, target: str | None, details: dict) -> None:
    request.state.admin_audit_recorded = True
    await conn.execute(
        """INSERT INTO public.admin_audit_logs
           (admin_id, action_type, target_user_id, details, ip_address, request_id)
           VALUES ($1::uuid, $2, $3::uuid, $4::jsonb, $5, $6)""",
        admin["id"], action, target, json.dumps(details, default=str),
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
            f"""SELECT u.id, u.firebase_uid, u.email, u.phone_number, u.full_name, p.name, p.coin_balance,
                       u.status::text AS status, u.is_active, u.is_email_verified,
                       u.is_phone_verified,
                       u.created_at, u.last_login_at,
                       COALESCE(array_agg(DISTINCT fp.provider_uid)
                                FILTER (WHERE fp.provider_uid IS NOT NULL), '{{}}') AS providers,
                       COALESCE(r.role_key, 'buyer') AS role
                FROM public.users u
                LEFT JOIN public.user_profile p ON p.user_id=u.id
                LEFT JOIN public.user_auth_providers fp ON fp.user_id=u.id
                LEFT JOIN public.user_role ur ON ur.user_id=u.id
                LEFT JOIN public.role r ON r.id=ur.role_id
                {where}
                GROUP BY u.id, p.name, p.coin_balance, r.role_key
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
        target_role = await conn.fetchval("SELECT r.role_key FROM user_role ur JOIN role r ON r.id=ur.role_id WHERE ur.user_id=$1", target)
        if target_role == "admin" and admin["role"] != "super_admin":
            raise HTTPException(403, "Only a super administrator can change an administrator status")
        if target == uuid.UUID(str(admin["user"]["id"])) and patch.status != "active":
            raise HTTPException(400, "You cannot deactivate your own administrator session")
        active = patch.status == "active"
        await conn.execute("UPDATE public.users SET status=$2::user_status, is_active=$3, auth_version=auth_version+1, updated_at=NOW() WHERE id=$1", target, patch.status, active)
        await _audit(conn, admin, request, "USER_STATUS_CHANGED", user_id, {"from": current["status"], "to": patch.status, "reason": patch.reason})
        row = await conn.fetchrow("""SELECT u.id,u.firebase_uid,u.email,u.phone_number,u.full_name,p.name,p.coin_balance,u.status::text AS status,
            u.is_active,u.is_email_verified,u.is_phone_verified,
            u.created_at,u.last_login_at,COALESCE(array_agg(DISTINCT fp.provider_uid) FILTER (WHERE fp.provider_uid IS NOT NULL),'{}') AS providers,
            COALESCE(r.role_key,'buyer') AS role FROM users u LEFT JOIN user_profile p ON p.user_id=u.id LEFT JOIN user_auth_providers fp ON fp.user_id=u.id LEFT JOIN user_role ur ON ur.user_id=u.id LEFT JOIN role r ON r.id=ur.role_id WHERE u.id=$1 GROUP BY u.id,p.name,p.coin_balance,r.role_key""", target)
    return _user_from_row(row)


@router.get("/rbac/me", response_model=AdminSummary)
async def get_my_admin_permissions(admin: dict = Depends(admin_context)) -> AdminSummary:
    return AdminSummary(**{k: admin.get(k) for k in ("id", "email", "full_name", "role", "permissions", "is_active")})


@router.post("/rbac/admins", response_model=AdminSummary, status_code=201)
async def create_admin_account(
    payload: AdminCreate,
    request: Request,
    admin: dict = Depends(require_permission("rbac:write")),
) -> AdminSummary:
    if admin["role"] != "super_admin":
        raise HTTPException(403, "Only a super administrator can add administrators")
    email = payload.email.strip().lower()
    permissions = [p.strip() for p in payload.permissions if p.strip()]
    async with transaction() as conn:
        try:
            row = await conn.fetchrow(
                """INSERT INTO public.admins(email,full_name,role,permissions)
                   VALUES ($1,$2,$3::admin_role,$4::jsonb)
                   RETURNING id,email,full_name,role::text,permissions,is_active""",
                email, payload.full_name.strip(), payload.role, json.dumps(sorted(set(permissions))),
            )
        except Exception as exc:
            raise HTTPException(409, "An administrator with this email already exists") from exc
        await _audit(conn, admin, request, "ADMIN_CREATED", None, {"email": email, "role": payload.role, "permissions": permissions})
    result = dict(row)
    if isinstance(result.get("permissions"), str):
        result["permissions"] = json.loads(result["permissions"])
    return AdminSummary(**result)


@router.patch("/rbac/admins/{admin_id}/permissions", response_model=AdminSummary)
async def update_admin_permissions(admin_id: str, patch: AdminPermissionPatch, request: Request, admin: dict = Depends(require_permission("rbac:write"))) -> AdminSummary:
    async with transaction() as conn:
        row = await conn.fetchrow("SELECT id,email,full_name,role::text,permissions,is_active FROM admins WHERE id=$1::uuid", admin_id)
        if row is None:
            raise HTTPException(404, "Administrator not found")
        await conn.execute("UPDATE admins SET permissions=$2::jsonb,updated_at=NOW() WHERE id=$1::uuid", admin_id, json.dumps(sorted(set(patch.permissions))))
        await _audit(conn, admin, request, "ADMIN_PERMISSIONS_UPDATED", None, {"admin_id": admin_id, "permissions": sorted(set(patch.permissions))})
        row = await conn.fetchrow("SELECT id,email,full_name,role::text,permissions,is_active FROM admins WHERE id=$1::uuid", admin_id)
    result = dict(row)
    if isinstance(result.get("permissions"), str):
        result["permissions"] = json.loads(result["permissions"])
    return AdminSummary(**result)


@router.patch("/rbac/admins/{admin_id}/role", response_model=AdminSummary)
async def update_admin_role(admin_id: str, patch: AdminRolePatch, request: Request, admin: dict = Depends(require_permission("rbac:write"))) -> AdminSummary:
    if admin["role"] != "super_admin":
        raise HTTPException(403, "Only a super administrator can change administrator roles")
    async with transaction() as conn:
        row = await conn.fetchrow("SELECT id,email,full_name,role::text,permissions,is_active FROM admins WHERE id=$1::uuid", admin_id)
        if row is None:
            raise HTTPException(404, "Administrator not found")
        await conn.execute("UPDATE admins SET role=$2::admin_role,updated_at=NOW() WHERE id=$1::uuid", admin_id, patch.role)
        await _audit(conn, admin, request, "ADMIN_ROLE_UPDATED", None, {"admin_id": admin_id, "from": row["role"], "to": patch.role})
        row = await conn.fetchrow("SELECT id,email,full_name,role::text,permissions,is_active FROM admins WHERE id=$1::uuid", admin_id)
    result = dict(row)
    if isinstance(result.get("permissions"), str):
        result["permissions"] = json.loads(result["permissions"])
    return AdminSummary(**result)


@router.get("/audit", response_model=list[AuditLogItem])
async def list_admin_audit_logs(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), admin: dict = Depends(require_permission("audit:read"))) -> list[AuditLogItem]:
    async with connection() as conn:
        rows = await conn.fetch("SELECT id,action_type,admin_id,target_user_id,details,ip_address,request_id,created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2", limit, offset)
    return [AuditLogItem(**dict(row)) for row in rows]
