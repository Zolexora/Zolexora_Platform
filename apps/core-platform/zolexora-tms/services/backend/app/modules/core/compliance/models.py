"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import uuid

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKeyConstraint, Index, Integer, PrimaryKeyConstraint, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.modules.core.compliance.enums import ComplianceCategory, ComplianceEntityType, ComplianceStatus, ComplianceVerificationAction


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class ComplianceRequirement(Base):
    __tablename__ = 'compliance_requirements'
    __table_args__ = (
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='CASCADE', name='fk_compliance_requirements_organisation_id_organisations'),
        PrimaryKeyConstraint('id', name='pk_compliance_requirements'),
        UniqueConstraint('organisation_id', 'code', name='uq_comp_req_org_code'),
        Index('ix_compliance_requirements_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[ComplianceCategory] = mapped_column(Enum(ComplianceCategory, name='compliance_category', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    entity_type: Mapped[ComplianceEntityType] = mapped_column(Enum(ComplianceEntityType, name='compliance_entity_type', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    blocking: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    organisation_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    description: Mapped[Optional[str]] = mapped_column(String(512))
    document_type: Mapped[Optional[str]] = mapped_column(String(64))
    validity_period_days: Mapped[Optional[int]] = mapped_column(Integer)
    source_reference: Mapped[Optional[str]] = mapped_column(String(256))
    notes: Mapped[Optional[str]] = mapped_column(String(512))
    conditions: Mapped[Optional[object]] = mapped_column(JSONB)


class ComplianceRecord(Base):
    __tablename__ = 'compliance_records'
    __table_args__ = (
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='CASCADE', name='fk_compliance_records_organisation_id_organisations'),
        ForeignKeyConstraint(['requirement_id'], ['compliance_requirements.id'], ondelete='RESTRICT', name='fk_compliance_records_requirement_id_compliance_requirements'),
        ForeignKeyConstraint(['verified_by'], ['profiles.id'], ondelete='SET NULL', name='fk_compliance_records_verified_by_profiles'),
        PrimaryKeyConstraint('id', name='pk_compliance_records'),
        UniqueConstraint('organisation_id', 'requirement_id', 'entity_type', 'entity_id', name='uq_comp_record_entity_req'),
        Index('ix_compliance_records_entity_id', 'entity_id'),
        Index('ix_compliance_records_expiry_date', 'expiry_date'),
        Index('ix_compliance_records_organisation_id', 'organisation_id'),
        Index('ix_compliance_records_requirement_id', 'requirement_id'),
        Index('ix_compliance_records_status', 'status')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    requirement_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    entity_type: Mapped[ComplianceEntityType] = mapped_column(Enum(ComplianceEntityType, name='compliance_entity_type', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[ComplianceStatus] = mapped_column(Enum(ComplianceStatus, name='compliance_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=ComplianceStatus.PENDING, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    document_number: Mapped[Optional[str]] = mapped_column(String(64))
    document_url: Mapped[Optional[str]] = mapped_column(String(512))
    original_filename: Mapped[Optional[str]] = mapped_column(String(256))
    mime_type: Mapped[Optional[str]] = mapped_column(String(64))
    issued_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    expiry_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    verified_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    verification_method: Mapped[Optional[str]] = mapped_column(String(128))
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(512))
    metadata_: Mapped[Optional[object]] = mapped_column('metadata', JSONB)

    requirement: Mapped['ComplianceRequirement'] = relationship('ComplianceRequirement')


class ComplianceVerification(Base):
    __tablename__ = 'compliance_verifications'
    __table_args__ = (
        ForeignKeyConstraint(['actor_id'], ['profiles.id'], ondelete='SET NULL', name='fk_compliance_verifications_actor_id_profiles'),
        ForeignKeyConstraint(['compliance_record_id'], ['compliance_records.id'], ondelete='CASCADE', name='fk_compliance_verifications_compliance_record_id_compli_25c2'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='CASCADE', name='fk_compliance_verifications_organisation_id_organisations'),
        PrimaryKeyConstraint('id', name='pk_compliance_verifications'),
        Index('ix_compliance_verifications_compliance_record_id', 'compliance_record_id'),
        Index('ix_compliance_verifications_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    compliance_record_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    action: Mapped[ComplianceVerificationAction] = mapped_column(Enum(ComplianceVerificationAction, name='compliance_verification_action', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    previous_status: Mapped[ComplianceStatus] = mapped_column(Enum(ComplianceStatus, name='compliance_status', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    new_status: Mapped[ComplianceStatus] = mapped_column(Enum(ComplianceStatus, name='compliance_status', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    comments: Mapped[Optional[str]] = mapped_column(String(512))
