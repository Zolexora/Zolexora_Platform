"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import uuid

from sqlalchemy import DateTime, Enum, ForeignKeyConstraint, Index, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.finance.pl.enums import PeriodStatus


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class FinancialPeriod(Base):
    __tablename__ = 'financial_periods'
    __table_args__ = (
        ForeignKeyConstraint(['closed_by_user_id'], ['profiles.id'], ondelete='SET NULL', name='fk_financial_periods_closed_by_user_id_profiles'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_financial_periods_organisation_id_organisations'),
        PrimaryKeyConstraint('id', name='pk_financial_periods'),
        UniqueConstraint('organisation_id', 'period_name', name='uq_financial_period_org_name'),
        Index('ix_financial_periods_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    period_name: Mapped[str] = mapped_column(String(64), nullable=False)
    start_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    end_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    status: Mapped[PeriodStatus] = mapped_column(Enum(PeriodStatus, name='financial_period_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=PeriodStatus.OPEN, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    opened_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    closed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    closed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class FinancialAuditLog(Base):
    __tablename__ = 'financial_audit_logs'
    __table_args__ = (
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_financial_audit_logs_organisation_id_organisations'),
        PrimaryKeyConstraint('id', name='pk_financial_audit_logs'),
        Index('ix_financial_audit_logs_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    old_values: Mapped[Optional[object]] = mapped_column(JSONB)
    new_values: Mapped[Optional[object]] = mapped_column(JSONB)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
