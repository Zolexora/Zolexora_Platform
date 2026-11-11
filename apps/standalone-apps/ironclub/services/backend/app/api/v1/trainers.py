from fastapi import APIRouter
from app.services.mock_data import MOCK_TRAINERS

router = APIRouter(prefix="/trainers", tags=["Trainers"])

@router.get("")
def list_trainers():
    return {
        "count": len(MOCK_TRAINERS),
        "trainers": MOCK_TRAINERS
    }

@router.get("/{trainer_id}")
def get_trainer(trainer_id: str):
    trainer = next((t for t in MOCK_TRAINERS if t["id"] == trainer_id), None)
    if not trainer:
        return MOCK_TRAINERS[0]
    return trainer
