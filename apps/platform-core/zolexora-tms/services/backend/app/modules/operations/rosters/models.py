"""SQLAlchemy model for recurring ETS & fixed-route shift rosters."""
from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy import Boolean, DateTime, Double, ForeignKeyConstraint, Index, Integer, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class ShiftRoster(Base):
    __tablename__ = "shift_rosters"
    __table_args__ = (
        ForeignKeyConstraint(["organisation_id"], ["organisations.id"], ondelete="RESTRICT", name="fk_roster_org"),
        ForeignKeyConstraint(["customer_id"], ["clients.id"], ondelete="RESTRICT", name="fk_roster_client"),
        ForeignKeyConstraint(["default_driver_id"], ["drivers.id"], ondelete="SET NULL", name="fk_roster_driver"),
        ForeignKeyConstraint(["default_vehicle_id"], ["vehicles.id"], ondelete="SET NULL", name="fk_roster_vehicle"),
        PrimaryKeyConstraint("id", name="pk_shift_rosters"),
        UniqueConstraint("organisation_id", "route_code", name="uq_shift_roster_org_code"),
        Index("ix_shift_rosters_organisation_id", "organisation_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    route_code: Mapped[str] = mapped_column(String(64), nullable=False)
    route_name: Mapped[str] = mapped_column(String(128), nullable=False)
    booking_type: Mapped[str] = mapped_column(String(32), default="ETS", nullable=False)
    shift_label: Mapped[str] = mapped_column(String(64), nullable=False)
    shift_time: Mapped[str] = mapped_column(String(16), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    weekdays: Mapped[object] = mapped_column(JSONB, default=lambda: [0, 1, 2, 3, 4], nullable=False)
    pickup_address: Mapped[str] = mapped_column(Text, nullable=False)
    pickup_lat: Mapped[Optional[float]] = mapped_column(Double(53))
    pickup_lng: Mapped[Optional[float]] = mapped_column(Double(53))
    drop_address: Mapped[str] = mapped_column(Text, nullable=False)
    drop_lat: Mapped[Optional[float]] = mapped_column(Double(53))
    drop_lng: Mapped[Optional[float]] = mapped_column(Double(53))
    default_driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    default_vehicle_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    stops: Mapped[object] = mapped_column(JSONB, default=list, nullable=False)
    escort_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
