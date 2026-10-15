import uuid
from fastapi import APIRouter
from app.services.mock_data import MOCK_POS_ITEMS
from app.schemas.gym_schemas import QuickPosOrderIn

router = APIRouter(prefix="/pos", tags=["Pro-Shop & POS"])

@router.get("/items")
def list_pos_items():
    return {
        "count": len(MOCK_POS_ITEMS),
        "items": MOCK_POS_ITEMS
    }

@router.post("/orders")
def process_pos_order(order: QuickPosOrderIn):
    # Decrement inventory stock
    for ordered in order.items:
        item = next((i for i in MOCK_POS_ITEMS if i["id"] == ordered.get("itemId")), None)
        if item and item["stockQty"] > 0:
            item["stockQty"] -= ordered.get("qty", 1)

    return {
        "success": True,
        "receiptNumber": f"POS-RCP-{uuid.uuid4().hex[:6].upper()}",
        "totalPaid": order.totalAmount,
        "paymentMethod": order.paymentMethod,
        "message": "Transaction complete. Receipt generated."
    }
