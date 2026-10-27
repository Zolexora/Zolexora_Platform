import datetime
from decimal import Decimal
import uuid
from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin
from app.modules.fleet.vehicles.enums import (
    FuelType,
    VehicleBodyType,
    VehicleOperationalStatus,
    VehicleOwnershipType,
)


class Vehicle(Base, TimestampMixin):
    __tablename__ = "vehicles"

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
    registration_number: Mapped[str] = mapped_column(String(32), nullable=False)
    vehicle_type: Mapped[VehicleBodyType] = mapped_column(
        Enum(VehicleBodyType, name="vehicle_body_type", create_type=False),
        nullable=False,
        default=VehicleBodyType.TRUCK,
    )
    ownership_type: Mapped[VehicleOwnershipType] = mapped_column(
        Enum(VehicleOwnershipType, name="vehicle_ownership_type", create_type=False),
        nullable=False,
        default=VehicleOwnershipType.OWNED,
    )
    make: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fuel_type: Mapped[FuelType] = mapped_column(
        Enum(FuelType, name="fuel_type", create_type=False),
        nullable=False,
        default=FuelType.DIESEL,
    )
    payload_capacity_kg: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    volume_cft: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    odometer_km: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.0")
    )
    fastag_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    gps_device_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    rc_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    rc_expiry: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    fitness_expiry: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    permit_expiry: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    insurance_expiry: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    puc_expiry: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    status: Mapped[VehicleOperationalStatus] = mapped_column(
        Enum(VehicleOperationalStatus, name="vehicle_operational_status", create_type=False),
        nullable=False,
        default=VehicleOperationalStatus.AVAILABLE,
    )
    documents: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
