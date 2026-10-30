import uuid
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.core.audit.models import AuditLog


def record_audit(
    db: AsyncSession,
    organisation_id: uuid.UUID,
    actor_user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID],
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Adds an audit_logs row to the current transaction (committed with the change it describes)."""
    db.add(AuditLog(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_=metadata or {},
    ))
