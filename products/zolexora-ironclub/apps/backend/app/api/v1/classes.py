import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.services.mock_data import MOCK_CLASSES, MOCK_MEMBERS
from app.schemas.gym_schemas import ClassBookingIn

router = APIRouter(prefix="/classes", tags=["Classes & Studios"])

@router.get("")
def list_fitness_classes(category: Optional[str] = None):
    classes = MOCK_CLASSES
    if category:
        classes = [c for c in classes if c["category"] == category]
    return {
        "count": len(classes),
        "classes": classes
    }

@router.post("/book")
def book_class(req: ClassBookingIn):
    cls = next((c for c in MOCK_CLASSES if c["id"] == req.classId), None)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    member = next((m for m in MOCK_MEMBERS if m["id"] == req.memberId), None)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    if cls["enrolledCount"] >= cls["capacity"]:
        cls["waitlistCount"] += 1
        return {
            "bookingId": f"bkg-{uuid.uuid4().hex[:6]}",
            "classId": cls["id"],
            "memberId": member["id"],
            "status": "WAITLISTED",
            "message": f"Class is currently full. Added to waitlist at position #{cls['waitlistCount']}."
        }
    
    cls["enrolledCount"] += 1
    return {
        "bookingId": f"bkg-{uuid.uuid4().hex[:6]}",
        "classId": cls["id"],
        "memberId": member["id"],
        "status": "CONFIRMED",
        "message": f"Spot reserved for {cls['title']}!"
    }

@router.post("/{class_id}/cancel")
def cancel_booking(class_id: str, member_id: str = Query(...)):
    cls = next((c for c in MOCK_CLASSES if c["id"] == class_id), None)
    if cls and cls["enrolledCount"] > 0:
        cls["enrolledCount"] -= 1
    return {
        "success": True,
        "message": "Class reservation successfully cancelled."
    }
