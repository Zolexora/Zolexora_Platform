"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import decimal
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKeyConstraint, Index, Numeric, PrimaryKeyConstraint, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.modules.finance.payments.enums import PaymentStatus


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Payment(Base):
    __tablename__ = 'payments'
    __table_args__ = (
        ForeignKeyConstraint(['customer_id'], ['clients.id'], ondelete='RESTRICT', name='fk_payments_customer_id_clients'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_payments_organisation_id_organisations'),
        PrimaryKeyConstraint('id', name='pk_payments'),
        Index('ix_payments_customer_id', 'customer_id'),
        Index('ix_payments_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    unallocated_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default='INR', nullable=False)
    payment_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus, name='payment_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=PaymentStatus.PENDING, nullable=False)
    metadata_: Mapped[object] = mapped_column('metadata', JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    provider_transaction_id: Mapped[Optional[str]] = mapped_column(String(128))
    payment_method: Mapped[Optional[str]] = mapped_column(String(64))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    reconciled_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    allocations: Mapped[list['PaymentAllocation']] = relationship('PaymentAllocation', cascade='all, delete-orphan')


class PaymentAllocation(Base):
    __tablename__ = 'payment_allocations'
    __table_args__ = (
        ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='RESTRICT', name='fk_payment_allocations_invoice_id_invoices'),
        ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='RESTRICT', name='fk_payment_allocations_payment_id_payments'),
        PrimaryKeyConstraint('id', name='pk_payment_allocations'),
        Index('ix_payment_allocations_invoice_id', 'invoice_id'),
        Index('ix_payment_allocations_payment_id', 'payment_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    payment_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    invoice_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    amount_allocated: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)


class PaymentEvent(Base):
    __tablename__ = 'payment_events'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='pk_payment_events'),
        Index('ix_payment_events_provider_event_id', 'provider_event_id', unique=True)
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    provider_event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
