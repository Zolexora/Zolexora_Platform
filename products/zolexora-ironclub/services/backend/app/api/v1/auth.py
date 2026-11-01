from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.security import create_access_token
from app.services.mock_data import MOCK_MEMBERS

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    portal: str = "ADMIN" # ADMIN or MEMBER

@router.post("/login")
def login(req: LoginRequest):
    # Admin demo credentials
    if req.portal == "ADMIN":
        if req.email == "admin@ironclub.zolexora.io" or "admin" in req.email:
            token = create_access_token({
                "sub": "usr-admin-01",
                "email": req.email,
                "role": "SUPER_ADMIN",
                "name": "Marcus Kane (Head Coach)"
            })
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": "usr-admin-01",
                    "email": req.email,
                    "name": "Marcus Kane",
                    "role": "SUPER_ADMIN",
                    "branchId": "branch-blr-01"
                }
            }
    
    # Member demo login
    member = next((m for m in MOCK_MEMBERS if m["email"].lower() == req.email.lower()), None)
    if not member:
        # Default fallback to Vikram
        member = MOCK_MEMBERS[0]

    token = create_access_token({
        "sub": member["id"],
        "email": member["email"],
        "role": "MEMBER",
        "name": f"{member['firstName']} {member['lastName']}"
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": member["id"],
            "membershipNumber": member["membershipNumber"],
            "email": member["email"],
            "name": f"{member['firstName']} {member['lastName']}",
            "role": "MEMBER",
            "tier": member["tier"],
            "avatarUrl": member["avatarUrl"]
        }
    }
