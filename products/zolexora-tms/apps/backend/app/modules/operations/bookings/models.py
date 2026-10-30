"""SQLAlchemy models generated from the Alembic schema (source of truth: alembic/versions)."""
from typing import Optional
import datetime
import decimal
import uuid

from sqlalchemy import DateTime, Double, Enum, ForeignKeyConstraint, Index, Numeric, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.operations.bookings.enums import BookingRequestStatus, BookingServiceType, BookingStatus, BookingType


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Booking(Base):
    __tablename__ = 'bookings'
    __table_args__ = (
        ForeignKeyConstraint(['booking_request_id'], ['booking_requests.id'], ondelete='SET NULL', name='fk_bookings_booking_request_id_booking_requests'),
        ForeignKeyConstraint(['customer_id'], ['clients.id'], ondelete='RESTRICT', name='fk_bookings_customer_id_clients'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_bookings_organisation_id_organisations'),
        ForeignKeyConstraint(['rate_card_version_id'], ['rate_card_versions.id'], ondelete='SET NULL', name='fk_bookings_rate_card_version_id_rate_card_versions'),
        PrimaryKeyConstraint('id', name='pk_bookings'),
        UniqueConstraint('organisation_id', 'booking_number', name='uq_booking_org_num'),
        Index('ix_bookings_customer_id', 'customer_id'),
        Index('ix_bookings_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    booking_number: Mapped[str] = mapped_column(String(64), nullable=False)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    booking_type: Mapped[BookingType] = mapped_column(Enum(BookingType, name='booking_type', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    service_type: Mapped[BookingServiceType] = mapped_column(Enum(BookingServiceType, name='booking_service_type', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    pickup_address: Mapped[str] = mapped_column(Text, nullable=False)
    drop_address: Mapped[str] = mapped_column(Text, nullable=False)
    pickup_datetime: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    passenger_info: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    cargo_info: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    vehicle_requirements: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    driver_requirements: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    commercial_terms: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus, name='booking_operational_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=BookingStatus.CONFIRMED, nullable=False)
    source: Mapped[str] = mapped_column(String(64), default='MANUAL', nullable=False)
    metadata_: Mapped[object] = mapped_column('metadata', JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    booking_request_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    pickup_lat: Mapped[Optional[float]] = mapped_column(Double(53))
    pickup_lng: Mapped[Optional[float]] = mapped_column(Double(53))
    drop_lat: Mapped[Optional[float]] = mapped_column(Double(53))
    drop_lng: Mapped[Optional[float]] = mapped_column(Double(53))
    expected_completion_datetime: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    rate_card_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    operational_instructions: Mapped[Optional[str]] = mapped_column(Text)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class BookingRequest(Base):
    __tablename__ = 'booking_requests'
    __table_args__ = (
        ForeignKeyConstraint(['customer_id'], ['clients.id'], ondelete='RESTRICT', name='fk_booking_requests_customer_id_clients'),
        ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='RESTRICT', name='fk_booking_requests_organisation_id_organisations'),
        ForeignKeyConstraint(['rate_card_version_id'], ['rate_card_versions.id'], ondelete='SET NULL', name='fk_booking_requests_rate_card_version_id_rate_card_versions'),
        PrimaryKeyConstraint('id', name='pk_booking_requests'),
        UniqueConstraint('organisation_id', 'request_number', name='uq_booking_req_org_num'),
        Index('ix_booking_requests_customer_id', 'customer_id'),
        Index('ix_booking_requests_organisation_id', 'organisation_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    request_number: Mapped[str] = mapped_column(String(64), nullable=False)
    organisation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    booking_type: Mapped[BookingType] = mapped_column(Enum(BookingType, name='booking_type', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    service_type: Mapped[BookingServiceType] = mapped_column(Enum(BookingServiceType, name='booking_service_type', create_type=False, values_callable=lambda e: [m.value for m in e]), nullable=False)
    pickup_address: Mapped[str] = mapped_column(Text, nullable=False)
    drop_address: Mapped[str] = mapped_column(Text, nullable=False)
    pickup_datetime: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    passenger_info: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    cargo_info: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    vehicle_requirements: Mapped[object] = mapped_column(JSONB, default=dict, nullable=False)
    source: Mapped[str] = mapped_column(String(64), default='MANUAL', nullable=False)
    status: Mapped[BookingRequestStatus] = mapped_column(Enum(BookingRequestStatus, name='booking_request_status', create_type=False, values_callable=lambda e: [m.value for m in e]), default=BookingRequestStatus.DRAFT, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)
    pickup_lat: Mapped[Optional[float]] = mapped_column(Double(53))
    pickup_lng: Mapped[Optional[float]] = mapped_column(Double(53))
    drop_lat: Mapped[Optional[float]] = mapped_column(Double(53))
    drop_lng: Mapped[Optional[float]] = mapped_column(Double(53))
    expected_completion_datetime: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    special_instructions: Mapped[Optional[str]] = mapped_column(Text)
    rate_card_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    estimated_pricing: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2))
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
