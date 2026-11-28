import datetime
import uuid
from sqlalchemy import Date, Enum, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin
from app.modules.fleet.drivers.enums import DriverStatus, DriverType


class Driver(Base, TimestampMixin):
    __tablename__ = "drivers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    driver_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    alternate_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    license_number: Mapped[str] = mapped_column(String(64), nullable=False)
    license_type: Mapped[str] = mapped_column(String(64), nullable=False)
    license_expiry: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    badge_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    aadhaar_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    driver_type: Mapped[DriverType] = mapped_column(
        Enum(DriverType, name="driver_employment_type", create_type=False),
        nullable=False,
        default=DriverType.PERMANENT,
    )
    status: Mapped[DriverStatus] = mapped_column(
        Enum(DriverStatus, name="driver_operational_status", create_type=False),
        nullable=False,
        default=DriverStatus.AVAILABLE,
    )
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    documents: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (
        Index("uq_drivers_org_driver_code", "organisation_id", "driver_code", unique=True, postgresql_where=text("driver_code IS NOT NULL")),
        Index("uq_drivers_org_phone", "organisation_id", "phone", unique=True, postgresql_where=text("phone IS NOT NULL AND phone <> ''")),
        Index("uq_drivers_org_license", "organisation_id", "license_number", unique=True, postgresql_where=text("license_number IS NOT NULL AND license_number <> ''")),
        Index("uq_drivers_org_pan", "organisation_id", "pan", unique=True, postgresql_where=text("pan IS NOT NULL AND pan <> ''")),
    )
