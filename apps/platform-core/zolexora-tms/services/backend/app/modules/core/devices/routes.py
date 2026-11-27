"""Device push token registration endpoint.

POST /api/v1/devices/register-push-token
  Body: { "token": "ExponentPushToken[...]", "platform": "ios" | "android" | "web" }
  Auth: active business session (get_current_active_organisation)

Upserts a DeviceToken row keyed by (user_id, platform). The endpoint is
idempotent — calling it on every app launch is safe.
"""
from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.dependencies import CurrentUserContext, get_current_active_organisation
from app.db.session import get_db
from app.modules.core.devices.models import DeviceToken

logger = logging.getLogger("zolexora.devices")

router = APIRouter(prefix="/api/v1/devices", tags=["Devices"])


class RegisterPushTokenRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=256)
    platform: Literal["ios", "android", "web"] = "android"


class RegisterPushTokenResponse(BaseModel):
    registered: bool


@router.post(
    "/register-push-token",
    response_model=RegisterPushTokenResponse,
    status_code=status.HTTP_200_OK,
)
async def register_push_token(
    req: RegisterPushTokenRequest,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
) -> RegisterPushTokenResponse:
    """Upsert a device push token for the authenticated user."""
    stmt = select(DeviceToken).where(
        DeviceToken.user_id == ctx.user_id,
        DeviceToken.platform == req.platform,
    )
    result = await db.execute(stmt)
    row = result.scalars().first()

    if row:
        row.token = req.token
    else:
        row = DeviceToken(user_id=ctx.user_id, platform=req.platform, token=req.token)
        db.add(row)

    await db.commit()
    logger.info("Registered push token for user %s (%s)", ctx.user_id, req.platform)
    return RegisterPushTokenResponse(registered=True)
