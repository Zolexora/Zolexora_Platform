from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Header, status
from app.schemas.gym_schemas import AccessVerificationIn, AccessVerificationOut
from app.services.turnstile_service import TurnstileEngine
from app.services.mock_data import MOCK_GATE_DEVICES, MOCK_ACCESS_LOGS, MOCK_BRANCHES

router = APIRouter(prefix="/access", tags=["Smart Turnstiles & Access Control"])

@router.post("/verify", response_model=AccessVerificationOut)
def verify_gate_access(
    req: AccessVerificationIn,
    x_gate_api_key: Optional[str] = Header(None, alias="X-Gate-API-Key")
):
    """
    Sub-50ms ultra-low latency verification endpoint for IoT Smart Turnstiles,
    Wiegand RFID controllers, biometric scanners, and Dynamic QR optical readers.
    """
    # Execute verification engine
    result = TurnstileEngine.verify_and_log(req)
    return result

@router.get("/devices")
def list_gate_devices():
    return {
        "count": len(MOCK_GATE_DEVICES),
        "devices": MOCK_GATE_DEVICES
    }

@router.post("/devices/{device_id}/unlock")
def manual_gate_override(device_id: str, duration_seconds: int = 5):
    gate = next((g for g in MOCK_GATE_DEVICES if g["id"] == device_id), None)
    if not gate:
        raise HTTPException(status_code=404, detail="Gate device not found")
    
    # Record manual unlock event
    gate["todayCyclesCount"] += 1
    log_event = {
        "id": f"log-manual-{device_id}",
        "timestamp": "2026-10-15T17:50:00Z",
        "memberId": None,
        "memberName": "Front Desk Officer (Manual Override)",
        "memberPhotoUrl": "",
        "deviceId": device_id,
        "deviceName": gate["name"],
        "zone": gate["zone"],
        "direction": "ENTRY",
        "decision": "GRANTED",
        "reason": f"Manual override trigger for {duration_seconds}s by staff."
    }
    MOCK_ACCESS_LOGS.insert(0, log_event)
    return {
        "success": True,
        "deviceId": device_id,
        "unlocked": True,
        "durationSeconds": duration_seconds,
        "message": f"{gate['name']} momentarily unlocked."
    }

@router.post("/devices/{device_id}/lockdown")
def toggle_device_lockdown(device_id: str, lockdown: bool = True):
    gate = next((g for g in MOCK_GATE_DEVICES if g["id"] == device_id), None)
    if not gate:
        raise HTTPException(status_code=404, detail="Gate device not found")
    gate["isLockedDown"] = lockdown
    return {
        "success": True,
        "deviceId": device_id,
        "isLockedDown": gate["isLockedDown"],
        "status": "LOCKED_DOWN" if lockdown else "NORMAL_OPERATION"
    }

@router.get("/logs")
def list_access_logs(limit: int = 50, decision: Optional[str] = None):
    logs = MOCK_ACCESS_LOGS
    if decision:
        logs = [l for l in logs if l["decision"] == decision]
    return {
        "count": len(logs[:limit]),
        "logs": logs[:limit]
    }
