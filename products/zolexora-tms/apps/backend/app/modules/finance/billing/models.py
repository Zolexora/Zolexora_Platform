"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import decimal
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.modules.finance.billing.enums import BillingStatus, RateRuleType


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class BillingRecord(Base):
    __tablename__ = 'billing_records'
    __table_args__ = (
        ForeignKeyConstraint(['customer_id'], ['clients.id'], ondelete='RESTRICT', name='fk_billing_records_customer_id_clients'),
        ForeignKeyConstraint(['duty_id'], ['duties.id'], ondelete='RESTRICT', name='fk_billing_records_duty_id_duties'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_billing_records_organisation_id_organisations'),
        ForeignKeyConstraint(['snapshot_id'], ['financial_snapshots.id'], ondelete='RESTRICT', name='fk_billing_records_snapshot_id_financial_snapshots'),
        PrimaryKeyConstraint('id', name='pk_billing_records'),
        UniqueConstraint('duty_id', name='uq_billing_duty'),
        Index('ix_billing_records_customer_id', 'customer_id'),
        Index('ix_billing_records_duty_id', 'duty_id'),
        Index('ix_billing_records_invoice_id', 'invoice_id'),
        Index('ix_billing_records_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    duty_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[BillingStatus] = mapped_column(Enum(BillingStatus, name='billing_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=BillingStatus.PENDING, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    snapshot_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    snapshot: Mapped[Optional['FinancialSnapshot']] = relationship('FinancialSnapshot')


class FinancialSnapshot(Base):
    __tablename__ = 'financial_snapshots'
    __table_args__ = (
        ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='SET NULL', name='fk_financial_snapshots_booking_id_bookings'),
        ForeignKeyConstraint(['duty_id'], ['duties.id'], ondelete='SET NULL', name='fk_financial_snapshots_duty_id_duties'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_financial_snapshots_organisation_id_organisations'),
        ForeignKeyConstraint(['rate_card_version_id'], ['rate_card_versions.id'], ondelete='RESTRICT', name='fk_financial_snapshots_rate_card_version_id_rate_card_versions'),
        ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='SET NULL', name='fk_financial_snapshots_trip_id_trips'),
        PrimaryKeyConstraint('id', name='pk_financial_snapshots'),
        Index('ix_financial_snapshots_duty_id', 'duty_id'),
        Index('ix_financial_snapshots_organisation_id', 'organisation_id'),
        Index('ix_financial_snapshots_trip_id', 'trip_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    operational_inputs: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    subtotal: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    discount_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    surcharge_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    taxable_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    tax_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    grand_total: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default='INR', nullable=False)
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    booking_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    duty_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    trip_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    rate_card_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    lines: Mapped[list['FinancialSnapshotLine']] = relationship('FinancialSnapshotLine', cascade='all, delete-orphan')


class FinancialSnapshotLine(Base):
    __tablename__ = 'financial_snapshot_lines'
    __table_args__ = (
        ForeignKeyConstraint(['rule_id'], ['rate_card_rules.id'], ondelete='SET NULL', name='fk_financial_snapshot_lines_rule_id_rate_card_rules'),
        ForeignKeyConstraint(['snapshot_id'], ['financial_snapshots.id'], ondelete='CASCADE', name='fk_financial_snapshot_lines_snapshot_id_financial_snapshots'),
        PrimaryKeyConstraint('id', name='pk_financial_snapshot_lines'),
        Index('ix_financial_snapshot_lines_snapshot_id', 'snapshot_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(64), nullable=False)
    quantity: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), default=Decimal('0'), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    unit_rate: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    is_tax: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class RateCard(Base):
    __tablename__ = 'rate_cards'
    __table_args__ = (
        CheckConstraint('length(TRIM(BOTH FROM name)) >= 2 AND length(TRIM(BOTH FROM name)) <= 160', name='ck_rate_cards_ck_rate_card_name_len'),
        ForeignKeyConstraint(['customer_id'], ['clients.id'], ondelete='SET NULL', name='fk_rate_cards_customer_id_clients'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_rate_cards_organisation_id_organisations'),
        PrimaryKeyConstraint('id', name='pk_rate_cards'),
        Index('ix_rate_cards_customer_id', 'customer_id'),
        Index('ix_rate_cards_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    booking_type: Mapped[str] = mapped_column(String(64), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class RateCardVersion(Base):
    __tablename__ = 'rate_card_versions'
    __table_args__ = (
        ForeignKeyConstraint(['rate_card_id'], ['rate_cards.id'], ondelete='RESTRICT', name='fk_rate_card_versions_rate_card_id_rate_cards'),
        PrimaryKeyConstraint('id', name='pk_rate_card_versions'),
        UniqueConstraint('rate_card_id', 'version_number', name='uq_rate_card_version'),
        Index('ix_rate_card_versions_rate_card_id', 'rate_card_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    rate_card_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    is_immutable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    effective_from: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    effective_to: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))


class RateCardRule(Base):
    __tablename__ = 'rate_card_rules'
    __table_args__ = (
        ForeignKeyConstraint(['rate_card_version_id'], ['rate_card_versions.id'], ondelete='CASCADE', name='fk_rate_card_rules_rate_card_version_id_rate_card_versions'),
        PrimaryKeyConstraint('id', name='pk_rate_card_rules'),
        Index('ix_rate_card_rules_rate_card_version_id', 'rate_card_version_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    rate_card_version_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    rule_type: Mapped[RateRuleType] = mapped_column(Enum(RateRuleType, name='rate_rule_type', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), default=Decimal('0'), nullable=False)
    quantity_included: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), default=Decimal('0'), nullable=False)
    rate_per_unit: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), default=Decimal('0'), nullable=False)
    is_percentage: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    percentage_value: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), default=Decimal('0'), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    conditions: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
