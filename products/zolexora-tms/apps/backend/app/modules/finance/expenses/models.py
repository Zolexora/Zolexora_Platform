"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import decimal
import uuid
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKeyConstraint, Index, Numeric, PrimaryKeyConstraint, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.finance.expenses.enums import ExpenseCategory


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Expense(Base):
    __tablename__ = 'expenses'
    __table_args__ = (
        ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='SET NULL', name='fk_expenses_driver_id_drivers'),
        ForeignKeyConstraint(['duty_id'], ['duties.id'], ondelete='SET NULL', name='fk_expenses_duty_id_duties'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_expenses_organisation_id_organisations'),
        ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='SET NULL', name='fk_expenses_trip_id_trips'),
        ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='SET NULL', name='fk_expenses_vehicle_id_vehicles'),
        PrimaryKeyConstraint('id', name='pk_expenses'),
        Index('ix_expenses_driver_id', 'driver_id'),
        Index('ix_expenses_duty_id', 'duty_id'),
        Index('ix_expenses_organisation_id', 'organisation_id'),
        Index('ix_expenses_trip_id', 'trip_id'),
        Index('ix_expenses_vehicle_id', 'vehicle_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    category: Mapped[ExpenseCategory] = mapped_column(Enum(ExpenseCategory, name='expense_category', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default='INR', nullable=False)
    expense_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    duty_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    trip_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    vehicle_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    attachment_url: Mapped[Optional[str]] = mapped_column(String(512))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
