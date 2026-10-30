"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import decimal
import uuid
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKeyConstraint, Index, Numeric, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.modules.finance.invoices.enums import InvoiceStatus, NoteStatus, NoteType


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Invoice(Base):
    __tablename__ = 'invoices'
    __table_args__ = (
        ForeignKeyConstraint(['customer_id'], ['clients.id'], ondelete='RESTRICT', name='fk_invoices_customer_id_clients'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_invoices_organisation_id_organisations'),
        PrimaryKeyConstraint('id', name='pk_invoices'),
        Index('ix_invoices_customer_id', 'customer_id'),
        Index('ix_invoices_invoice_number', 'invoice_number', unique=True),
        Index('ix_invoices_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(64), nullable=False)
    invoice_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    due_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    subtotal: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    discount_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    taxable_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    tax_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    grand_total: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    amount_paid: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    amount_due: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default='INR', nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus, name='invoice_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=InvoiceStatus.DRAFT, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    billing_period_start: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    billing_period_end: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    terms: Mapped[Optional[str]] = mapped_column(Text)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    finalized_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    pdf_url: Mapped[Optional[str]] = mapped_column(String(512))
    cancellation_reason: Mapped[Optional[str]] = mapped_column(String(512))

    lines: Mapped[list['InvoiceLine']] = relationship('InvoiceLine', cascade='all, delete-orphan')
    tax_lines: Mapped[list['InvoiceTaxLine']] = relationship('InvoiceTaxLine', cascade='all, delete-orphan')


class InvoiceLine(Base):
    __tablename__ = 'invoice_lines'
    __table_args__ = (
        ForeignKeyConstraint(['billing_record_id'], ['billing_records.id'], ondelete='SET NULL', name='fk_invoice_lines_billing_record_id_billing_records'),
        ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE', name='fk_invoice_lines_invoice_id_invoices'),
        PrimaryKeyConstraint('id', name='pk_invoice_lines'),
        Index('ix_invoice_lines_invoice_id', 'invoice_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), default=Decimal('0'), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    unit_rate: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    billing_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class InvoiceTaxLine(Base):
    __tablename__ = 'invoice_tax_lines'
    __table_args__ = (
        ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE', name='fk_invoice_tax_lines_invoice_id_invoices'),
        PrimaryKeyConstraint('id', name='pk_invoice_tax_lines'),
        Index('ix_invoice_tax_lines_invoice_id', 'invoice_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    tax_name: Mapped[str] = mapped_column(String(64), nullable=False)
    tax_rate: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), default=Decimal('0'), nullable=False)
    taxable_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    tax_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)


class FinancialAdjustmentNote(Base):
    __tablename__ = 'financial_adjustment_notes'
    __table_args__ = (
        ForeignKeyConstraint(['customer_id'], ['clients.id'], ondelete='RESTRICT', name='fk_financial_adjustment_notes_customer_id_clients'),
        ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='RESTRICT', name='fk_financial_adjustment_notes_invoice_id_invoices'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_financial_adjustment_notes_organisation_id_organisations'),
        PrimaryKeyConstraint('id', name='pk_financial_adjustment_notes'),
        UniqueConstraint('organisation_id', 'note_type', 'note_number', name='uq_adjustment_note_num'),
        Index('ix_financial_adjustment_notes_customer_id', 'customer_id'),
        Index('ix_financial_adjustment_notes_invoice_id', 'invoice_id'),
        Index('ix_financial_adjustment_notes_note_number', 'note_number'),
        Index('ix_financial_adjustment_notes_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    invoice_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    note_type: Mapped[NoteType] = mapped_column(Enum(NoteType, name='adjustment_note_type', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    note_number: Mapped[str] = mapped_column(String(64), nullable=False)
    note_date: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    reason: Mapped[str] = mapped_column(String(512), nullable=False)
    subtotal: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    tax_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    grand_total: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default='INR', nullable=False)
    status: Mapped[NoteStatus] = mapped_column(Enum(NoteStatus, name='adjustment_note_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=NoteStatus.DRAFT, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    pdf_url: Mapped[Optional[str]] = mapped_column(String(512))
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    finalized_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

    lines: Mapped[list['FinancialAdjustmentNoteLine']] = relationship('FinancialAdjustmentNoteLine', cascade='all, delete-orphan')
    tax_lines: Mapped[list['FinancialAdjustmentNoteTaxLine']] = relationship('FinancialAdjustmentNoteTaxLine', cascade='all, delete-orphan')


class FinancialAdjustmentNoteLine(Base):
    __tablename__ = 'financial_adjustment_note_lines'
    __table_args__ = (
        ForeignKeyConstraint(['note_id'], ['financial_adjustment_notes.id'], ondelete='CASCADE', name='fk_financial_adjustment_note_lines_note_id_financial_ad_d139'),
        PrimaryKeyConstraint('id', name='pk_financial_adjustment_note_lines'),
        Index('ix_financial_adjustment_note_lines_note_id', 'note_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    note_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)


class FinancialAdjustmentNoteTaxLine(Base):
    __tablename__ = 'financial_adjustment_note_tax_lines'
    __table_args__ = (
        ForeignKeyConstraint(['note_id'], ['financial_adjustment_notes.id'], ondelete='CASCADE', name='fk_financial_adjustment_note_tax_lines_note_id_financia_a039'),
        PrimaryKeyConstraint('id', name='pk_financial_adjustment_note_tax_lines'),
        Index('ix_financial_adjustment_note_tax_lines_note_id', 'note_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    note_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    tax_name: Mapped[str] = mapped_column(String(64), nullable=False)
    tax_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0'), nullable=False)
