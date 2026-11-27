"""SQLAlchemy model for synced NHAI/NETC FASTag toll transactions."""
from __future__ import annotations

import datetime
import decimal
import uuid
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKeyConstraint, Index, Numeric, PrimaryKeyConstraint, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class FastagTransaction(Base):
    __tablename__ = "fastag_transactions"
    __table_args__ = (
        ForeignKeyConstraint(["organisation_id"], ["organisations.id"], ondelete="RESTRICT", name="fk_fastag_org"),
        ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="SET NULL", name="fk_fastag_vehicle"),
        ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="SET NULL", name="fk_fastag_trip"),
        PrimaryKeyConstraint("id", name="pk_fastag_transactions"),
        UniqueConstraint("organisation_id", "transaction_ref", name="uq_fastag_org_ref"),
        Index("ix_fastag_transactions_organisation_id", "organisation_id"),
        Index("ix_fastag_transactions_vehicle_id", "vehicle_id"),
        Index("ix_fastag_transactions_trip_id", "trip_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    vehicle_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    trip_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    transaction_ref: Mapped[str] = mapped_column(String(128), nullable=False)
    plaza_name: Mapped[str] = mapped_column(String(256), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    transacted_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    duplicate_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reconciled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    raw_payload: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
