from datetime import datetime, date, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, Float, Boolean, Date, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

class BranchModel(Base, TimestampMixin):
    __tablename__ = "branches"

    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(100))
    max_capacity: Mapped[int] = mapped_column(Integer, default=150)
    current_occupancy: Mapped[int] = mapped_column(Integer, default=0)
    amenities: Mapped[List[str]] = mapped_column(JSON, default=list)

    members = relationship("MemberModel", back_populates="branch")
    gate_devices = relationship("GateDeviceModel", back_populates="branch")

class MemberModel(Base, TimestampMixin):
    __tablename__ = "members"

    membership_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    gender: Mapped[str] = mapped_column(String(20))
    dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(255), default="")
    home_branch_id: Mapped[str] = mapped_column(String(36), ForeignKey("branches.id"))
    tier: Mapped[str] = mapped_column(String(30), default="GOLD") # BRONZE, SILVER, GOLD, BLACK_IRON_VIP
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE") # ACTIVE, EXPIRING_SOON, EXPIRED, FROZEN
    join_date: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(timezone.utc).date())
    expiry_date: Mapped[date] = mapped_column(Date)
    rfid_tag_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True, index=True)
    dynamic_qr_secret: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    emergency_name: Mapped[str] = mapped_column(String(100), default="")
    emergency_phone: Mapped[str] = mapped_column(String(20), default="")
    emergency_relation: Mapped[str] = mapped_column(String(50), default="")
    assigned_trainer_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    locker_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    total_workouts: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)

    branch = relationship("BranchModel", back_populates="members")
    access_logs = relationship("AccessLogModel", back_populates="member")

class GateDeviceModel(Base, TimestampMixin):
    __tablename__ = "gate_devices"

    branch_id: Mapped[str] = mapped_column(String(36), ForeignKey("branches.id"))
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(50)) # TURNSTILE_TRIPOD, FLAP_BARRIER, SPEED_GATE
    zone: Mapped[str] = mapped_column(String(50)) # MAIN_ENTRY, MAIN_EXIT, VIP_LOUNGE, etc.
    ip_address: Mapped[str] = mapped_column(String(50))
    mac_address: Mapped[str] = mapped_column(String(50))
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)
    last_heartbeat: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    latency_ms: Mapped[int] = mapped_column(Integer, default=15)
    today_cycles_count: Mapped[int] = mapped_column(Integer, default=0)
    firmware_version: Mapped[str] = mapped_column(String(20), default="v2.4.1")
    is_locked_down: Mapped[bool] = mapped_column(Boolean, default=False)

    branch = relationship("BranchModel", back_populates="gate_devices")

class AccessLogModel(Base, TimestampMixin):
    __tablename__ = "access_logs"

    member_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("members.id"), nullable=True)
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    device_name: Mapped[str] = mapped_column(String(100))
    member_name: Mapped[str] = mapped_column(String(100))
    zone: Mapped[str] = mapped_column(String(50))
    direction: Mapped[str] = mapped_column(String(10)) # ENTRY, EXIT
    decision: Mapped[str] = mapped_column(String(50)) # GRANTED, DENIED_EXPIRED, etc.
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    member = relationship("MemberModel", back_populates="access_logs")

class FitnessClassModel(Base, TimestampMixin):
    __tablename__ = "fitness_classes"

    title: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(50)) # HIIT, POWERLIFTING, CROSSFIT, etc.
    branch_id: Mapped[str] = mapped_column(String(36), index=True)
    instructor_name: Mapped[str] = mapped_column(String(100))
    instructor_avatar: Mapped[str] = mapped_column(String(255), default="")
    room: Mapped[str] = mapped_column(String(50))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45)
    capacity: Mapped[int] = mapped_column(Integer, default=20)
    enrolled_count: Mapped[int] = mapped_column(Integer, default=0)
    intensity_level: Mapped[str] = mapped_column(String(20), default="ALL_LEVELS")
    burn_calories_estimate: Mapped[int] = mapped_column(Integer, default=400)
    description: Mapped[str] = mapped_column(Text, default="")

class SmartEquipmentModel(Base, TimestampMixin):
    __tablename__ = "smart_equipment"

    asset_tag: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(50))
    brand: Mapped[str] = mapped_column(String(50))
    zone: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="OPTIMAL") # OPTIMAL, INSPECTION_DUE, OUT_OF_SERVICE
    installed_date: Mapped[date] = mapped_column(Date)
    last_maintenance_date: Mapped[date] = mapped_column(Date)
    next_service_due_date: Mapped[date] = mapped_column(Date)
    total_usage_hours: Mapped[float] = mapped_column(Float, default=0.0)
