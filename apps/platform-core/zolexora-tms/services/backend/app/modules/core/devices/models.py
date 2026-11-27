"""Device push token model.

One row per (user_id, platform) pair. Upserted on every app launch so stale
tokens are automatically replaced.
"""
from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class DeviceToken(Base):
    """Stores Expo push tokens keyed by (user_id, platform)."""

    __tablename__ = "device_tokens"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", name="uq_device_tokens_user_platform"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # "ios" | "android" | "web"
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    # Expo push token: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]
    token: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
