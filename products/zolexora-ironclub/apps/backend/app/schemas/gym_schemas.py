from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, date

class AccessVerificationIn(BaseModel):
    deviceId: str = Field(..., description="Unique Gate Controller Device ID")
    credentialType: str = Field("RFID_TAG", description="RFID_TAG | QR_DYNAMIC_TOKEN | BIOMETRIC_ID")
    credentialValue: str = Field(..., description="Scanned Card / Token / Hash")
    gateZone: str = Field("MAIN_ENTRY", description="MAIN_ENTRY | VIP_LOUNGE | etc.")
    direction: str = Field("ENTRY", description="ENTRY | EXIT")
    timestamp: Optional[str] = None

class AccessVerificationOut(BaseModel):
    decision: str
    accessGranted: bool
    memberId: Optional[str] = None
    memberName: Optional[str] = None
    memberPhotoUrl: Optional[str] = None
    membershipTier: Optional[str] = None
    message: str
    unlockDurationMs: int = 5000
    currentGymOccupancy: int = 0
    maxGymCapacity: int = 150

class MemberCreateIn(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    gender: str = "MALE"
    dob: Optional[str] = None
    homeBranchId: str = "branch-blr-01"
    tier: str = "GOLD" # BRONZE, SILVER, GOLD, BLACK_IRON_VIP
    durationMonths: int = 12
    rfidTagId: Optional[str] = None
    emergencyName: Optional[str] = None
    emergencyPhone: Optional[str] = None
    assignedTrainerId: Optional[str] = None

class ClassBookingIn(BaseModel):
    classId: str
    memberId: str

class EquipmentServiceTicketIn(BaseModel):
    equipmentId: str
    issueDescription: str
    severity: str = "MEDIUM" # LOW, MEDIUM, CRITICAL

class QuickPosOrderIn(BaseModel):
    memberId: Optional[str] = None
    items: List[dict] # [{ "itemId": "pos-01", "qty": 1, "price": 450 }]
    paymentMethod: str = "UPI_QR" # UPI_QR, CASH, MEMBER_TAB, CARD
    totalAmount: float
