"""Best-effort audit hook for legacy and new admin mutations."""

import json
import re

from core.deps import is_admin
from shared.database.postgres import connection

_UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}")


async def audit_admin_mutation(request, response, user: dict) -> None:
    if getattr(request.state, "admin_audit_recorded", False):
        return
    if not is_admin(user) or request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    target = next((m.group(0) for m in _UUID_RE.finditer(request.url.path)), None)
    action = f"{request.method}_{request.url.path.strip('/').replace('/', '_')}"[:100]
    details = {
        "method": request.method,
        "path": request.url.path,
        "query": dict(request.query_params),
        "response_status": response.status_code,
    }
    async with connection() as conn:
        await conn.execute(
            """INSERT INTO public.admin_audit_logs
               (admin_id, admin_email, action_type, target_user_id, details, ip_address, request_id)
               VALUES ($1::uuid,$2,$3,$4::uuid,$5::jsonb,$6,$7)""",
            user["id"], user.get("email"), action, target, json.dumps(details), request.client.host if request.client else None,
            getattr(request.state, "request_id", None),
        )
