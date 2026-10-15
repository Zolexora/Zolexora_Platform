import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.services.mock_data import MOCK_MEMBERS
from app.schemas.gym_schemas import MemberCreateIn

router = APIRouter(prefix="/members", tags=["Members"])

@router.get("")
def list_members(
    query: Optional[str] = Query(None, description="Search by name, phone, email, or RFID"),
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, EXPIRED, etc."),
    tier: Optional[str] = Query(None, description="Filter by tier: BRONZE, SILVER, GOLD, BLACK_IRON_VIP")
):
    results = MOCK_MEMBERS
    if status:
        results = [m for m in results if m["status"] == status]
    if tier:
        results = [m for m in results if m["tier"] == tier]
    if query:
        q = query.lower()
        results = [
            m for m in results
            if (
                q in m["firstName"].lower() or 
                q in m["lastName"].lower() or 
                q in m["email"].lower() or 
                q in m["phone"] or
                q in m["membershipNumber"].lower() or
                (m.get("rfidTagId") and q in m["rfidTagId"].lower())
            )
        ]
    return {
        "count": len(results),
        "members": results
    }

@router.get("/{member_id}")
def get_member_detail(member_id: str):
    member = next((m for m in MOCK_MEMBERS if m["id"] == member_id or m["membershipNumber"] == member_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

@router.post("", status_code=status.HTTP_201_CREATED)
def create_member(data: MemberCreateIn):
    today = date.today()
    expiry = today + timedelta(days=data.durationMonths * 30)
    new_id = f"mem-{uuid.uuid4().hex[:6]}"
    membership_num = f"IC-2026-{uuid.uuid4().hex[:4].upper()}"
    
    new_member = {
        "id": new_id,
        "membershipNumber": membership_num,
        "firstName": data.firstName,
        "lastName": data.lastName,
        "email": data.email,
        "phone": data.phone,
        "gender": data.gender,
        "dob": data.dob or "1995-01-01",
        "avatarUrl": f"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80",
        "homeBranchId": data.homeBranchId,
        "tier": data.tier,
        "status": "ACTIVE",
        "joinDate": today.isoformat(),
        "expiryDate": expiry.isoformat(),
        "rfidTagId": data.rfidTagId or f"RFID-{uuid.uuid4().hex[:6].upper()}",
        "dynamicQrSecret": f"QRSEC-{uuid.uuid4().hex[:8].upper()}",
        "emergencyContact": {
            "name": data.emergencyName or "Primary Contact",
            "phone": data.emergencyPhone or data.phone,
            "relation": "Family"
        },
        "assignedTrainerId": data.assignedTrainerId,
        "healthConditions": [],
        "lockerNumber": f"L-{uuid.uuid4().hex[:3].upper()}",
        "stats": {
            "totalWorkouts": 0,
            "monthVisits": 0,
            "streakDays": 0,
            "lastVisit": None
        }
    }
    MOCK_MEMBERS.insert(0, new_member)
    return new_member

@router.patch("/{member_id}/status")
def update_member_status(member_id: str, new_status: str = Query(..., regex="^(ACTIVE|FROZEN|EXPIRED|SUSPENDED)$")):
    member = next((m for m in MOCK_MEMBERS if m["id"] == member_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member["status"] = new_status
    return {
        "success": True,
        "memberId": member["id"],
        "status": member["status"]
    }
