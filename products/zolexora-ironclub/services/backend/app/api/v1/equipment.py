from fastapi import APIRouter, HTTPException
from app.services.mock_data import MOCK_SMART_EQUIPMENT
from app.schemas.gym_schemas import EquipmentServiceTicketIn

router = APIRouter(prefix="/equipment", tags=["Smart Equipment"])

@router.get("")
def list_equipment():
    return {
        "count": len(MOCK_SMART_EQUIPMENT),
        "equipment": MOCK_SMART_EQUIPMENT
    }

@router.post("/tickets")
def create_service_ticket(ticket: EquipmentServiceTicketIn):
    eq = next((e for e in MOCK_SMART_EQUIPMENT if e["id"] == ticket.equipmentId), None)
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    eq["maintenanceTicketsCount"] += 1
    if ticket.severity == "CRITICAL":
        eq["status"] = "OUT_OF_SERVICE"
    else:
        eq["status"] = "INSPECTION_DUE"

    return {
        "success": True,
        "ticketId": f"tkt-{ticket.equipmentId}",
        "equipmentName": eq["name"],
        "status": eq["status"],
        "message": f"Maintenance dispatch ticket created for {eq['name']}."
    }
