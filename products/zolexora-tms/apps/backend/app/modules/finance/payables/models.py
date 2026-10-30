"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import decimal
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKeyConstraint, Index, Numeric, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.modules.finance.payables.enums import PayableStatus


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Payable(Base):
    __tablename__ = 'payables'
    __table_args__ = (
        ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='RESTRICT', name='fk_payables_driver_id_drivers'),
        ForeignKeyConstraint(['duty_id'], ['duties.id'], ondelete='SET NULL', name='fk_payables_duty_id_duties'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_payables_organisation_id_organisations'),
        ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='RESTRICT', name='fk_payables_vendor_id_vendors'),
        PrimaryKeyConstraint('id', name='pk_payables'),
        Index('ix_payables_driver_id', 'driver_id'),
        Index('ix_payables_organisation_id', 'organisation_id'),
        Index('ix_payables_reference_number', 'reference_number'),
        Index('ix_payables_vendor_id', 'vendor_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    reference_number: Mapped[str] = mapped_column(String(64), nullable=False)
    subtotal: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    deductions: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    advances: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    grand_total: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default='INR', nullable=False)
    status: Mapped[PayableStatus] = mapped_column(Enum(PayableStatus, name='payable_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=PayableStatus.DRAFT, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    duty_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    lines: Mapped[list['PayableLine']] = relationship('PayableLine', cascade='all, delete-orphan')


class PayableLine(Base):
    __tablename__ = 'payable_lines'
    __table_args__ = (
        ForeignKeyConstraint(['payable_id'], ['payables.id'], ondelete='CASCADE', name='fk_payable_lines_payable_id_payables'),
        PrimaryKeyConstraint('id', name='pk_payable_lines'),
        Index('ix_payable_lines_payable_id', 'payable_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    payable_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    is_deduction: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Settlement(Base):
    __tablename__ = 'settlements'
    __table_args__ = (
        ForeignKeyConstraint(['payable_id'], ['payables.id'], ondelete='RESTRICT', name='fk_settlements_payable_id_payables'),
        PrimaryKeyConstraint('id', name='pk_settlements'),
        Index('ix_settlements_payable_id', 'payable_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    payable_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    settlement_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(128))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class VendorSettlementStatement(Base):
    __tablename__ = 'vendor_settlement_statements'
    __table_args__ = (
        ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='RESTRICT', name='fk_vendor_settlement_statements_driver_id_drivers'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_vendor_settlement_statements_organisation_id_organisations'),
        ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='RESTRICT', name='fk_vendor_settlement_statements_vendor_id_vendors'),
        PrimaryKeyConstraint('id', name='pk_vendor_settlement_statements'),
        UniqueConstraint('organisation_id', 'statement_number', name='uq_vendor_settlement_num'),
        Index('ix_vendor_settlement_statements_driver_id', 'driver_id'),
        Index('ix_vendor_settlement_statements_organisation_id', 'organisation_id'),
        Index('ix_vendor_settlement_statements_statement_number', 'statement_number'),
        Index('ix_vendor_settlement_statements_vendor_id', 'vendor_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    statement_number: Mapped[str] = mapped_column(String(64), nullable=False)
    statement_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    gross_payable: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    total_deductions: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    total_advances: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    net_payable: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default='INR', nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    period_start: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    period_end: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    pdf_url: Mapped[Optional[str]] = mapped_column(String(512))
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
