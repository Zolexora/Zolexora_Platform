import uuid
from typing import Callable, Any
import asyncpg
from fastapi import Depends, HTTPException, Request, status

from core.deps import current_user
from shared.database.postgres import connection, pg_conn_dep
from storefronts.dependencies import require_storefront_context
from storefronts.models import StorefrontContext
from .repository import PostgresSellerRepository


async def get_seller_repo(conn: asyncpg.Connection = Depends(pg_conn_dep)) -> PostgresSellerRepository:
    return PostgresSellerRepository(conn)


async def require_active_seller_org(
    org_id: uuid.UUID,
    request: Request,
    repo: PostgresSellerRepository = Depends(get_seller_repo),
) -> dict[str, Any]:
    org = await repo.get_organization_by_id(org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller organization '{org_id}' not found.",
        )

    if org["status"] == "SUSPENDED":
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seller organization is suspended. Write operations are blocked.",
                headers={"X-Error-Code": "SELLER_ORG_SUSPENDED"},
            )

    return org


async def get_current_seller_org_member(
    org_id: uuid.UUID,
    user: dict[str, Any] = Depends(current_user),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
) -> dict[str, Any]:
    if user.get("role") == "admin":
        return {
            "id": uuid.uuid4(),
            "organization_id": org_id,
            "user_id": user["id"],
            "role": "ADMIN",
            "permissions": None,
            "status": "ACTIVE",
        }

    user_id = user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)

    member = await repo.get_member(org_id=org_id, user_id=user_id)
    if not member or member.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. User is not an active member of this organization.",
            headers={"X-Error-Code": "SELLER_ORG_ACCESS_DENIED"},
        )

    return member


def require_seller_org_role(allowed_roles: list[str]) -> Callable[..., dict[str, Any]]:
    async def role_checker(
        member: dict[str, Any] = Depends(get_current_seller_org_member),
        user: dict[str, Any] = Depends(current_user),
    ) -> dict[str, Any]:
        if user.get("role") == "admin":
            return member

        if member.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient organization permissions. Role '{member.get('role')}' is not allowed.",
                headers={"X-Error-Code": "SELLER_ORG_ROLE_DENIED"},
            )
        return member

    return role_checker


async def require_storefront_grant(
    org_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(pg_conn_dep),
    context: StorefrontContext = Depends(require_storefront_context),
) -> uuid.UUID:
    repo = PostgresSellerRepository(conn)
    storefront_id = context.storefront.id

    has_grant = await repo.has_active_grant(org_id, storefront_id)
    if not has_grant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Seller organization does not have an active approved publishing grant for storefront '{context.storefront.key}'. Access denied.",
            headers={"X-Error-Code": "STOREFRONT_GRANT_REQUIRED"},
        )

    return storefront_id


async def assert_storefront_grants(user: dict[str, Any], storefront_keys) -> None:
    """Sellers publish only on storefronts where an admin approved their organization
    (seller_storefront_grant). Admins are not limited."""
    if user.get("role") == "admin":
        return
    keys = sorted({str(getattr(k, "value", k)) for k in storefront_keys})
    if not keys:
        return
    async with connection() as conn:
        missing = await conn.fetch(
            """
            SELECT k.key FROM unnest($2::text[]) AS k(key)
            WHERE NOT EXISTS (
              SELECT 1
              FROM seller_storefront_grant g
              JOIN seller_organization o ON o.id = g.organization_id AND o.status = 'ACTIVE'
              JOIN seller_org_member m ON m.organization_id = o.id AND m.status = 'ACTIVE'
              JOIN storefront s ON s.id = g.storefront_id
              WHERE m.user_id = $1 AND s.storefront_key = k.key
                AND g.grant_status = 'APPROVED'
                AND (g.effective_at IS NULL OR g.effective_at <= NOW())
                AND (g.revoked_at IS NULL OR g.revoked_at > NOW()))
            """,
            uuid.UUID(str(user["id"])), keys,
        )
    if missing:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No approved publishing grant for: {', '.join(r['key'] for r in missing)}",
            headers={"X-Error-Code": "STOREFRONT_GRANT_REQUIRED"},
        )
