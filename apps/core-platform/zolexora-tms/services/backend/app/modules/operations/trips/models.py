"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import decimal
import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Double, Enum, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.operations.trips.enums import TripStatus


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Trip(Base):
    __tablename__ = 'trips'
    __table_args__ = (
        CheckConstraint('end_odometer IS NULL OR end_odometer >= start_odometer', name='ck_trips_ck_trip_odometer_valid'),
        ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='RESTRICT', name='fk_trips_driver_id_drivers'),
        ForeignKeyConstraint(['duty_id'], ['duties.id'], ondelete='RESTRICT', name='fk_trips_duty_id_duties'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_trips_organisation_id_organisations'),
        ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='RESTRICT', name='fk_trips_vehicle_id_vehicles'),
        PrimaryKeyConstraint('id', name='pk_trips'),
        UniqueConstraint('organisation_id', 'trip_number', name='uq_trip_org_num'),
        Index('ix_trips_driver_id', 'driver_id'),
        Index('ix_trips_duty_id', 'duty_id', unique=True),
        Index('ix_trips_organisation_id', 'organisation_id'),
        Index('ix_trips_status', 'status'),
        Index('ix_trips_vehicle_id', 'vehicle_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_number: Mapped[str] = mapped_column(String(64), nullable=False)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    duty_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    driver_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    start_odometer: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    start_location: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    end_location: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    toll_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), default=Decimal('0'), nullable=False)
    fuel_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), default=Decimal('0'), nullable=False)
    parking_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), default=Decimal('0'), nullable=False)
    waiting_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[TripStatus] = mapped_column(Enum(TripStatus, name='trip_lifecycle_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=TripStatus.NOT_STARTED, nullable=False)
    operational_receipts: Mapped[object] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    end_odometer: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2))
    total_distance_km: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2))
    start_timestamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    end_timestamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    pod_attachment_url: Mapped[Optional[str]] = mapped_column(String(512))
    pod_notes: Mapped[Optional[str]] = mapped_column(Text)
    pod_uploaded_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    notes: Mapped[Optional[str]] = mapped_column(Text)


class TripEvent(Base):
    __tablename__ = 'trip_events'
    __table_args__ = (
        ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE', name='fk_trip_events_trip_id_trips'),
        PrimaryKeyConstraint('id', name='pk_trip_events'),
        Index('ix_trip_events_trip_id', 'trip_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Double(53))
    longitude: Mapped[Optional[float]] = mapped_column(Double(53))
    notes: Mapped[Optional[str]] = mapped_column(Text)
