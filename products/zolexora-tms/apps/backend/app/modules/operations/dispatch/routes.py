import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_organisation, get_current_identity, CurrentUserContext
from app.auth.jwks import verify_firebase_jwt
from app.core.websocket import ws_manager
from app.db.session import AsyncSessionLocal, get_db, rls_bypass
from app.modules.operations.duties.models import Duty, DutyStatus
from app.modules.operations.duties.schemas import DutyResponse

logger = logging.getLogger("zolexora.dispatch")
router = APIRouter(tags=["Dispatch"])


@router.get("/api/v1/dispatch/board")
async def get_dispatch_board(
    search: Optional[str] = Query(None, max_length=100),
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns live duties grouped into the operational dispatch lanes:
    ALLOCATED, DISPATCHED, ARRIVED_PICKUP, IN_TRANSIT, ARRIVED_DROP, DUTY_COMPLETED
    """
    stmt = (
        select(Duty)
        .where(
            Duty.organisation_id == ctx.organisation_id,
            Duty.status != DutyStatus.CANCELLED,
        )
        .order_by(desc(Duty.scheduled_start_time))
        .limit(200)
    )
    res = await db.execute(stmt)
    all_duties = [DutyResponse.model_validate(d) for d in res.scalars().all()]

    board = {
        "ALLOCATED": [],
        "DISPATCHED": [],
        "ARRIVED_PICKUP": [],
        "IN_TRANSIT": [],
        "ARRIVED_DROP": [],
        "DUTY_COMPLETED": [],
    }

    # Assigned / accepted duties are not yet dispatched: show them in the ALLOCATED lane
    allocated = {DutyStatus.ASSIGNED, DutyStatus.ACCEPTED, DutyStatus.DRIVER_ACCEPTANCE_PENDING}
    for d in all_duties:
        lane = "ALLOCATED" if d.status in allocated else d.status.value
        if lane in board:
            board[lane].append(d)

    return {
        "organisation_id": ctx.organisation_id,
        "total_active": len(all_duties),
        "lanes": board,
    }


@router.websocket("/ws/ops/{org_id}")
async def websocket_ops_endpoint(
    websocket: WebSocket,
    org_id: uuid.UUID,
    token: Optional[str] = Query(None),
):
    """
    Authoritative real-time WebSocket channel for operational transport telemetry.
    Verifies JWT token and tenant ownership before allowing connection.
    """
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        claims = await verify_firebase_jwt(token)
        identity = await get_current_identity(claims)
    except Exception as e:
        logger.warning(f"WebSocket auth rejected: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # The caller must be an active member of the organisation whose events they subscribe to
    async with AsyncSessionLocal() as db, rls_bypass(db):
        res = await db.execute(
            text("SELECT 1 FROM public.organisation_members WHERE user_id = :u AND organisation_id = :o AND status = 'ACTIVE'"),
            {"u": identity.id, "o": org_id},
        )
        is_member = res.scalar() is not None
    if not is_member:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(websocket, org_id)
    try:
        while True:
            # Keep socket alive and respond to client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, org_id)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket, org_id)
