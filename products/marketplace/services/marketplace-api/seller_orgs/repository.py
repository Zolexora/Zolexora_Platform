import json
import uuid
from typing import Any
import asyncpg


class PostgresSellerRepository:
    def __init__(self, connection: asyncpg.Connection):
        self.connection = connection

    async def create_organization(
        self,
        *,
        name: str,
        slug: str,
        owner_user_id: uuid.UUID,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        clean_slug = slug.strip().lower()
        org_id = uuid.uuid4()
        member_id = uuid.uuid4()
        audit_id = uuid.uuid4()
        metadata_json = json.dumps(metadata) if metadata is not None else None

        async with self.connection.transaction():
            # Check existing slug
            existing = await self.connection.fetchrow(
                "SELECT id FROM seller_organization WHERE slug = $1", clean_slug
            )
            if existing:
                raise ValueError(f"Organization slug '{clean_slug}' already exists")

            org_row = await self.connection.fetchrow(
                """
                INSERT INTO seller_organization (id, name, slug, status, verification_status, onboarding_state, metadata)
                VALUES ($1, $2, $3, 'PENDING_VERIFICATION', 'UNVERIFIED', 'DRAFT', $4::json)
                RETURNING id, name, slug, status, verification_status, onboarding_state, metadata, created_at, updated_at
                """,
                org_id, name, clean_slug, metadata_json
            )

            await self.connection.execute(
                """
                INSERT INTO seller_org_member (id, organization_id, user_id, role, status)
                VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')
                """,
                member_id, org_id, owner_user_id
            )

            # Ensure seller role in user_role
            seller_role = await self.connection.fetchrow(
                "SELECT id FROM role WHERE role_key = 'seller'"
            )
            if seller_role:
                await self.connection.execute(
                    """
                    INSERT INTO user_role (id, user_id, role_id)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id) DO NOTHING
                    """,
                    uuid.uuid4(), owner_user_id, seller_role["id"]
                )

            await self.connection.execute(
                """
                INSERT INTO seller_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES ($1, $2, $3, 'ORG_CREATED', 'ORGANIZATION', $2, $4::json)
                """,
                audit_id, org_id, owner_user_id, json.dumps({"name": name, "slug": clean_slug})
            )

            res = dict(org_row)
            if res["metadata"] and isinstance(res["metadata"], str):
                res["metadata"] = json.loads(res["metadata"])
            return res

    async def get_organization_by_id(self, org_id: uuid.UUID) -> dict[str, Any] | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, name, slug, status, verification_status, onboarding_state, metadata, created_at, updated_at
            FROM seller_organization
            WHERE id = $1
            """,
            org_id
        )
        if not row:
            return None
        res = dict(row)
        if res["metadata"] and isinstance(res["metadata"], str):
            res["metadata"] = json.loads(res["metadata"])
        return res

    async def get_organization_by_slug(self, slug: str) -> dict[str, Any] | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, name, slug, status, verification_status, onboarding_state, metadata, created_at, updated_at
            FROM seller_organization
            WHERE slug = $1
            """,
            slug.strip().lower()
        )
        if not row:
            return None
        res = dict(row)
        if res["metadata"] and isinstance(res["metadata"], str):
            res["metadata"] = json.loads(res["metadata"])
        return res

    async def list_user_organizations(self, user_id: uuid.UUID) -> list[dict[str, Any]]:
        rows = await self.connection.fetch(
            """
            SELECT o.id, o.name, o.slug, o.status, o.verification_status, o.onboarding_state, o.metadata, o.created_at, o.updated_at
            FROM seller_organization o
            JOIN seller_org_member m ON m.organization_id = o.id
            WHERE m.user_id = $1 AND m.status = 'ACTIVE'
            ORDER BY o.created_at DESC
            """,
            user_id
        )
        result = []
        for r in rows:
            res = dict(r)
            if res["metadata"] and isinstance(res["metadata"], str):
                res["metadata"] = json.loads(res["metadata"])
            result.append(res)
        return result

    async def list_all_organizations(
        self,
        *,
        status: str | None = None,
        verification_status: str | None = None,
    ) -> list[dict[str, Any]]:
        query = "SELECT id, name, slug, status, verification_status, onboarding_state, metadata, created_at, updated_at FROM seller_organization WHERE 1=1"
        args: list[Any] = []
        if status:
            args.append(status)
            query += f" AND status = ${len(args)}"
        if verification_status:
            args.append(verification_status)
            query += f" AND verification_status = ${len(args)}"
        query += " ORDER BY created_at DESC"

        rows = await self.connection.fetch(query, *args)
        result = []
        for r in rows:
            res = dict(r)
            if res["metadata"] and isinstance(res["metadata"], str):
                res["metadata"] = json.loads(res["metadata"])
            result.append(res)
        return result

    async def add_member(
        self,
        *,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str,
        actor_user_id: uuid.UUID,
        permissions: list[str] | None = None,
    ) -> dict[str, Any]:
        member_id = uuid.uuid4()
        audit_id = uuid.uuid4()
        perms_json = json.dumps(permissions) if permissions is not None else None

        async with self.connection.transaction():
            existing = await self.connection.fetchrow(
                "SELECT id, status FROM seller_org_member WHERE organization_id = $1 AND user_id = $2",
                org_id, user_id
            )
            if existing:
                if existing["status"] == "ACTIVE":
                    raise ValueError("User is already an active member of this organization")
                # Re-activate
                row = await self.connection.fetchrow(
                    """
                    UPDATE seller_org_member
                    SET status = 'ACTIVE', role = $3, permissions = $4::json, updated_at = NOW()
                    WHERE id = $1
                    RETURNING id, organization_id, user_id, role, permissions, status, joined_at, created_at, updated_at
                    """,
                    existing["id"], org_id, role, perms_json
                )
            else:
                row = await self.connection.fetchrow(
                    """
                    INSERT INTO seller_org_member (id, organization_id, user_id, role, permissions, status)
                    VALUES ($1, $2, $3, $4, $5::json, 'ACTIVE')
                    RETURNING id, organization_id, user_id, role, permissions, status, joined_at, created_at, updated_at
                    """,
                    member_id, org_id, user_id, role, perms_json
                )

            await self.connection.execute(
                """
                INSERT INTO seller_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES ($1, $2, $3, 'MEMBER_ADDED', 'MEMBER', $4, $5::json)
                """,
                audit_id, org_id, actor_user_id, row["id"], json.dumps({"user_id": str(user_id), "role": role})
            )

            res = dict(row)
            if res["permissions"] and isinstance(res["permissions"], str):
                res["permissions"] = json.loads(res["permissions"])
            return res

    async def get_member(self, *, org_id: uuid.UUID, user_id: uuid.UUID) -> dict[str, Any] | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, organization_id, user_id, role, permissions, status, joined_at, created_at, updated_at
            FROM seller_org_member
            WHERE organization_id = $1 AND user_id = $2 AND status = 'ACTIVE'
            """,
            org_id, user_id
        )
        if not row:
            return None
        res = dict(row)
        if res["permissions"] and isinstance(res["permissions"], str):
            res["permissions"] = json.loads(res["permissions"])
        return res

    async def get_member_by_id(self, member_id: uuid.UUID) -> dict[str, Any] | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, organization_id, user_id, role, permissions, status, joined_at, created_at, updated_at
            FROM seller_org_member
            WHERE id = $1
            """,
            member_id
        )
        if not row:
            return None
        res = dict(row)
        if res["permissions"] and isinstance(res["permissions"], str):
            res["permissions"] = json.loads(res["permissions"])
        return res

    async def list_org_members(self, org_id: uuid.UUID) -> list[dict[str, Any]]:
        rows = await self.connection.fetch(
            """
            SELECT id, organization_id, user_id, role, permissions, status, joined_at, created_at, updated_at
            FROM seller_org_member
            WHERE organization_id = $1 AND status = 'ACTIVE'
            ORDER BY joined_at ASC
            """,
            org_id
        )
        result = []
        for r in rows:
            res = dict(r)
            if res["permissions"] and isinstance(res["permissions"], str):
                res["permissions"] = json.loads(res["permissions"])
            result.append(res)
        return result

    async def update_member_role(
        self,
        *,
        org_id: uuid.UUID,
        member_id: uuid.UUID,
        new_role: str,
        actor_user_id: uuid.UUID,
        permissions: list[str] | None = None,
    ) -> dict[str, Any]:
        audit_id = uuid.uuid4()
        perms_json = json.dumps(permissions) if permissions is not None else None

        async with self.connection.transaction():
            current_member = await self.connection.fetchrow(
                "SELECT role, user_id FROM seller_org_member WHERE id = $1 AND organization_id = $2",
                member_id, org_id
            )
            if not current_member:
                raise ValueError(f"Member {member_id} not found in organization {org_id}")

            if current_member["role"] == "OWNER" and new_role != "OWNER":
                owner_count = await self.connection.fetchval(
                    "SELECT COUNT(*) FROM seller_org_member WHERE organization_id = $1 AND role = 'OWNER' AND status = 'ACTIVE'",
                    org_id
                )
                if owner_count <= 1:
                    raise ValueError("Cannot demote the sole active OWNER of the organization")

            row = await self.connection.fetchrow(
                """
                UPDATE seller_org_member
                SET role = $3, permissions = COALESCE($4::json, permissions), updated_at = NOW()
                WHERE id = $1 AND organization_id = $2
                RETURNING id, organization_id, user_id, role, permissions, status, joined_at, created_at, updated_at
                """,
                member_id, org_id, new_role, perms_json
            )

            await self.connection.execute(
                """
                INSERT INTO seller_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES ($1, $2, $3, 'MEMBER_ROLE_UPDATED', 'MEMBER', $4, $5::json)
                """,
                audit_id, org_id, actor_user_id, member_id, json.dumps({"old_role": current_member["role"], "new_role": new_role})
            )

            res = dict(row)
            if res["permissions"] and isinstance(res["permissions"], str):
                res["permissions"] = json.loads(res["permissions"])
            return res

    async def remove_member(
        self,
        *,
        org_id: uuid.UUID,
        member_id: uuid.UUID,
        actor_user_id: uuid.UUID,
    ) -> dict[str, Any]:
        audit_id = uuid.uuid4()
        async with self.connection.transaction():
            current_member = await self.connection.fetchrow(
                "SELECT role, user_id FROM seller_org_member WHERE id = $1 AND organization_id = $2",
                member_id, org_id
            )
            if not current_member:
                raise ValueError(f"Member {member_id} not found in organization {org_id}")

            if current_member["role"] == "OWNER":
                owner_count = await self.connection.fetchval(
                    "SELECT COUNT(*) FROM seller_org_member WHERE organization_id = $1 AND role = 'OWNER' AND status = 'ACTIVE'",
                    org_id
                )
                if owner_count <= 1:
                    raise ValueError("Cannot remove the sole active OWNER of the organization")

            row = await self.connection.fetchrow(
                """
                UPDATE seller_org_member
                SET status = 'REMOVED', updated_at = NOW()
                WHERE id = $1 AND organization_id = $2
                RETURNING id, organization_id, user_id, role, permissions, status, joined_at, created_at, updated_at
                """,
                member_id, org_id
            )

            await self.connection.execute(
                """
                INSERT INTO seller_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES ($1, $2, $3, 'MEMBER_REMOVED', 'MEMBER', $4, $5::json)
                """,
                audit_id, org_id, actor_user_id, member_id, json.dumps({"removed_user_id": str(current_member["user_id"])})
            )

            res = dict(row)
            if res["permissions"] and isinstance(res["permissions"], str):
                res["permissions"] = json.loads(res["permissions"])
            return res

    async def request_storefront_grant(
        self,
        *,
        org_id: uuid.UUID,
        storefront_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        grant_reason: str | None = None,
    ) -> dict[str, Any]:
        grant_id = uuid.uuid4()
        audit_id = uuid.uuid4()

        async with self.connection.transaction():
            org_row = await self.connection.fetchrow(
                "SELECT id FROM seller_organization WHERE id = $1 FOR UPDATE",
                org_id,
            )
            if not org_row:
                raise ValueError(f"Organization '{org_id}' not found")

            # Check for existing active or pending grant for org + storefront
            existing = await self.connection.fetchrow(
                """
                SELECT id, grant_status FROM seller_storefront_grant
                WHERE organization_id = $1 AND storefront_id = $2
                  AND grant_status IN ('PENDING', 'APPROVED')
                """,
                org_id, storefront_id
            )
            if existing:
                raise ValueError(f"Organization already has a grant in '{existing['grant_status']}' state for this storefront")

            try:
                grant_row = await self.connection.fetchrow(
                    """
                    INSERT INTO seller_storefront_grant (id, organization_id, storefront_id, grant_status, grant_reason)
                    VALUES ($1, $2, $3, 'PENDING', $4)
                    RETURNING id, organization_id, storefront_id, grant_status, granted_by_user_id, grant_reason, effective_at, revoked_at, created_at, updated_at
                    """,
                    grant_id, org_id, storefront_id, grant_reason
                )
            except asyncpg.exceptions.UniqueViolationError:
                raise ValueError(
                    "Organization already has a grant in 'PENDING' or 'APPROVED' state for this storefront"
                )

            await self.connection.execute(
                """
                INSERT INTO seller_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES ($1, $2, $3, 'GRANT_REQUESTED', 'GRANT', $4, $5::json)
                """,
                audit_id, org_id, actor_user_id, grant_id, json.dumps({"storefront_id": str(storefront_id), "reason": grant_reason})
            )

            return dict(grant_row)

    async def get_grant_by_id(self, grant_id: uuid.UUID) -> dict[str, Any] | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, organization_id, storefront_id, grant_status, granted_by_user_id, grant_reason, effective_at, revoked_at, created_at, updated_at
            FROM seller_storefront_grant
            WHERE id = $1
            """,
            grant_id
        )
        return dict(row) if row else None

    async def list_org_grants(self, org_id: uuid.UUID) -> list[dict[str, Any]]:
        rows = await self.connection.fetch(
            """
            SELECT id, organization_id, storefront_id, grant_status, granted_by_user_id, grant_reason, effective_at, revoked_at, created_at, updated_at
            FROM seller_storefront_grant
            WHERE organization_id = $1
            ORDER BY created_at DESC
            """,
            org_id
        )
        return [dict(r) for r in rows]

    async def list_all_grants(
        self,
        *,
        status: str | None = None,
        storefront_id: uuid.UUID | None = None,
        org_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        query = "SELECT id, organization_id, storefront_id, grant_status, granted_by_user_id, grant_reason, effective_at, revoked_at, created_at, updated_at FROM seller_storefront_grant WHERE 1=1"
        args: list[Any] = []
        if status:
            args.append(status)
            query += f" AND grant_status = ${len(args)}"
        if storefront_id:
            args.append(storefront_id)
            query += f" AND storefront_id = ${len(args)}"
        if org_id:
            args.append(org_id)
            query += f" AND organization_id = ${len(args)}"
        query += " ORDER BY created_at DESC"

        rows = await self.connection.fetch(query, *args)
        return [dict(r) for r in rows]

    async def update_grant_status(
        self,
        *,
        grant_id: uuid.UUID,
        decision: str,
        admin_user_id: uuid.UUID,
        reason: str | None = None,
    ) -> dict[str, Any]:
        audit_id = uuid.uuid4()
        decision_upper = decision.upper()

        if decision_upper in ("APPROVE", "APPROVED"):
            new_status = "APPROVED"
        elif decision_upper in ("REVOKE", "REVOKED"):
            new_status = "REVOKED"
        elif decision_upper in ("SUSPEND", "SUSPENDED"):
            new_status = "SUSPENDED"
        else:
            raise ValueError(f"Invalid grant decision '{decision}'. Must be APPROVE, REVOKE, or SUSPEND.")

        async with self.connection.transaction():
            existing = await self.connection.fetchrow(
                "SELECT id, organization_id, storefront_id, grant_status FROM seller_storefront_grant WHERE id = $1",
                grant_id
            )
            if not existing:
                raise ValueError(f"Grant {grant_id} not found")

            if new_status == "APPROVED":
                grant_row = await self.connection.fetchrow(
                    """
                    UPDATE seller_storefront_grant
                    SET grant_status = 'APPROVED', granted_by_user_id = $2, grant_reason = COALESCE($3, grant_reason), effective_at = NOW(), revoked_at = NULL, updated_at = NOW()
                    WHERE id = $1
                    RETURNING id, organization_id, storefront_id, grant_status, granted_by_user_id, grant_reason, effective_at, revoked_at, created_at, updated_at
                    """,
                    grant_id, admin_user_id, reason
                )
            else:
                grant_row = await self.connection.fetchrow(
                    """
                    UPDATE seller_storefront_grant
                    SET grant_status = $2, granted_by_user_id = $3, grant_reason = COALESCE($4, grant_reason), revoked_at = NOW(), updated_at = NOW()
                    WHERE id = $1
                    RETURNING id, organization_id, storefront_id, grant_status, granted_by_user_id, grant_reason, effective_at, revoked_at, created_at, updated_at
                    """,
                    grant_id, new_status, admin_user_id, reason
                )


            await self.connection.execute(
                """
                INSERT INTO seller_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES ($1, $2, $3, $4, 'GRANT', $5, $6::json)
                """,
                audit_id, existing["organization_id"], admin_user_id, f"GRANT_{decision_upper}", grant_id, json.dumps({"decision": decision_upper, "reason": reason})
            )

            return dict(grant_row)

    async def has_active_grant(self, org_id: uuid.UUID, storefront_id: uuid.UUID) -> bool:
        row = await self.connection.fetchrow(
            """
            SELECT g.id
            FROM seller_storefront_grant g
            JOIN seller_organization o ON o.id = g.organization_id
            WHERE g.organization_id = $1 AND g.storefront_id = $2
              AND g.grant_status = 'APPROVED' AND o.status = 'ACTIVE'
              AND (g.effective_at IS NULL OR g.effective_at <= NOW())
              AND (g.revoked_at IS NULL OR g.revoked_at > NOW())
            """,
            org_id, storefront_id
        )
        return row is not None

    async def update_organization_verification(
        self,
        *,
        org_id: uuid.UUID,
        verification_status: str,
        admin_user_id: uuid.UUID,
        notes: str | None = None,
    ) -> dict[str, Any]:
        audit_id = uuid.uuid4()
        history_id = uuid.uuid4()
        v_status = verification_status.upper()

        async with self.connection.transaction():
            new_org_status = "ACTIVE" if v_status == "VERIFIED" else None
            if new_org_status:
                org_row = await self.connection.fetchrow(
                    """
                    UPDATE seller_organization
                    SET verification_status = $2, status = $3, updated_at = NOW()
                    WHERE id = $1
                    RETURNING id, name, slug, status, verification_status, onboarding_state, metadata, created_at, updated_at
                    """,
                    org_id, v_status, new_org_status
                )
            else:
                org_row = await self.connection.fetchrow(
                    """
                    UPDATE seller_organization
                    SET verification_status = $2, updated_at = NOW()
                    WHERE id = $1
                    RETURNING id, name, slug, status, verification_status, onboarding_state, metadata, created_at, updated_at
                    """,
                    org_id, v_status
                )

            if not org_row:
                raise ValueError(f"Organization {org_id} not found")

            # Immutable verification history record
            await self.connection.execute(
                """
                INSERT INTO seller_verification_history (id, organization_id, verified_by_user_id, status, notes)
                VALUES ($1, $2, $3, $4, $5)
                """,
                history_id, org_id, admin_user_id, v_status, notes
            )

            # Audit log record
            await self.connection.execute(
                """
                INSERT INTO seller_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES ($1, $2, $3, 'ORG_VERIFICATION_UPDATED', 'ORGANIZATION', $2, $4::json)
                """,
                audit_id, org_id, admin_user_id, json.dumps({"verification_status": v_status, "notes": notes})
            )

            res = dict(org_row)
            if res["metadata"] and isinstance(res["metadata"], str):
                res["metadata"] = json.loads(res["metadata"])
            return res

    async def update_organization_status(
        self,
        *,
        org_id: uuid.UUID,
        status: str,
        actor_user_id: uuid.UUID,
        reason: str | None = None,
    ) -> dict[str, Any]:
        audit_id = uuid.uuid4()
        s_status = status.upper()

        async with self.connection.transaction():
            org_row = await self.connection.fetchrow(
                """
                UPDATE seller_organization
                SET status = $2, updated_at = NOW()
                WHERE id = $1
                RETURNING id, name, slug, status, verification_status, onboarding_state, metadata, created_at, updated_at
                """,
                org_id, s_status
            )
            if not org_row:
                raise ValueError(f"Organization {org_id} not found")

            await self.connection.execute(
                """
                INSERT INTO seller_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES ($1, $2, $3, $4, 'ORGANIZATION', $2, $5::json)
                """,
                audit_id, org_id, actor_user_id, f"ORG_STATUS_CHANGED_{s_status}", json.dumps({"new_status": s_status, "reason": reason})
            )

            res = dict(org_row)
            if res["metadata"] and isinstance(res["metadata"], str):
                res["metadata"] = json.loads(res["metadata"])
            return res

    async def list_audit_logs(self, org_id: uuid.UUID) -> list[dict[str, Any]]:
        rows = await self.connection.fetch(
            """
            SELECT id, organization_id, actor_user_id, action, resource_type, resource_id, payload, created_at
            FROM seller_audit_log
            WHERE organization_id = $1
            ORDER BY created_at DESC
            """,
            org_id
        )
        result = []
        for r in rows:
            res = dict(r)
            if res["payload"] and isinstance(res["payload"], str):
                res["payload"] = json.loads(res["payload"])
            result.append(res)
        return result

    async def list_verification_history(self, org_id: uuid.UUID) -> list[dict[str, Any]]:
        rows = await self.connection.fetch(
            """
            SELECT id, organization_id, verified_by_user_id, status, notes, created_at
            FROM seller_verification_history
            WHERE organization_id = $1
            ORDER BY created_at DESC
            """,
            org_id
        )
        return [dict(r) for r in rows]
