"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import uuid

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKeyConstraint, Index, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.operations.duties.schemas import DutyAssignmentStatus, DutyStatus


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Duty(Base):
    __tablename__ = 'duties'
    __table_args__ = (
        CheckConstraint('scheduled_end_time >= scheduled_start_time', name='ck_duties_ck_duty_time_range'),
        ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='RESTRICT', name='fk_duties_booking_id_bookings'),
        ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='SET NULL', name='fk_duties_driver_id_drivers'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_duties_organisation_id_organisations'),
        ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='SET NULL', name='fk_duties_vehicle_id_vehicles'),
        PrimaryKeyConstraint('id', name='pk_duties'),
        UniqueConstraint('organisation_id', 'duty_number', name='uq_duty_org_num'),
        Index('ix_duties_booking_id', 'booking_id'),
        Index('ix_duties_driver_id', 'driver_id'),
        Index('ix_duties_organisation_id', 'organisation_id'),
        Index('ix_duties_status', 'status'),
        Index('ix_duties_vehicle_id', 'vehicle_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    duty_number: Mapped[str] = mapped_column(String(64), nullable=False)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    booking_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    scheduled_start_time: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    scheduled_end_time: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    status: Mapped[DutyStatus] = mapped_column(Enum(DutyStatus, name='duty_lifecycle_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=DutyStatus.UNASSIGNED, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    vehicle_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    actual_start_time: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    actual_end_time: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    dispatched_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    dispatched_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class DutyAssignment(Base):
    __tablename__ = 'duty_assignments'
    __table_args__ = (
        ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='RESTRICT', name='fk_duty_assignments_driver_id_drivers'),
        ForeignKeyConstraint(['duty_id'], ['duties.id'], ondelete='CASCADE', name='fk_duty_assignments_duty_id_duties'),
        ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='RESTRICT', name='fk_duty_assignments_vehicle_id_vehicles'),
        PrimaryKeyConstraint('id', name='pk_duty_assignments'),
        Index('ix_duty_assignments_driver_id', 'driver_id'),
        Index('ix_duty_assignments_duty_id', 'duty_id'),
        Index('ix_duty_assignments_vehicle_id', 'vehicle_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    duty_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    driver_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    assigned_by_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[DutyAssignmentStatus] = mapped_column(Enum(DutyAssignmentStatus, name='duty_assignment_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=DutyAssignmentStatus.PENDING, nullable=False)
    assigned_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    accepted_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    rejected_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
