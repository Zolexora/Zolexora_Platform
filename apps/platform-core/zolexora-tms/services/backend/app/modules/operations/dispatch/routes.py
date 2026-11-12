import asyncio
import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUserContext, get_current_active_organisation, identity_from_token, resolve_membership
from app.core.websocket import ws_manager
from app.db.session import AsyncSessionLocal, get_db
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
async def websocket_ops_endpoint(websocket: WebSocket, org_id: uuid.UUID):
    """
    Real-time operations channel. The client's first message must be
    {"type": "auth", "token": "<session token>"} within 5 seconds (tokens never go in URLs,
    which end up in proxy logs). The caller must be an active member of org_id.
    """
    await websocket.accept()
    try:
        msg = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        token = msg.get("token") if isinstance(msg, dict) and msg.get("type") == "auth" else None
        if not token:
            raise ValueError("first message must be an auth message")
        identity = await identity_from_token(token)
        async with AsyncSessionLocal() as db, db.begin():
            row = await resolve_membership(db, identity, org_id)
        if not row or row["organisation_id"] != org_id:
            raise ValueError("not a member of this organisation")
    except Exception as e:
        logger.warning(f"WebSocket auth rejected: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await websocket.send_json({"type": "auth_ok"})

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
