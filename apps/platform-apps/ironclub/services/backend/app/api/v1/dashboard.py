from fastapi import APIRouter
from app.services.mock_data import (
    MOCK_BRANCHES, 
    MOCK_MEMBERS, 
    MOCK_ACCESS_LOGS, 
    MOCK_CLASSES,
    MOCK_SMART_EQUIPMENT
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Analytics"])

@router.get("/overview")
def get_dashboard_overview():
    branch = MOCK_BRANCHES[0]
    total_active_members = len([m for m in MOCK_MEMBERS if m["status"] in ["ACTIVE", "EXPIRING_SOON"]])
    today_checkins = len([log for log in MOCK_ACCESS_LOGS if log["decision"] == "GRANTED" and log["direction"] == "ENTRY"])
    
    # Peak hours distribution curve
    peak_distribution = [
        {"hour": "06:00", "count": 28},
        {"hour": "07:00", "count": 74},
        {"hour": "08:00", "count": 92},
        {"hour": "09:00", "count": 65},
        {"hour": "10:00", "count": 38},
        {"hour": "11:00", "count": 24},
        {"hour": "12:00", "count": 18},
        {"hour": "13:00", "count": 22},
        {"hour": "14:00", "count": 16},
        {"hour": "15:00", "count": 25},
        {"hour": "16:00", "count": 48},
        {"hour": "17:00", "count": 86},
        {"hour": "18:00", "count": 115},
        {"hour": "19:00", "count": 128},
        {"hour": "20:00", "count": 95},
        {"hour": "21:00", "count": 52},
        {"hour": "22:00", "count": 22}
    ]

    return {
        "branch": branch,
        "liveOccupancy": branch["currentOccupancy"],
        "maxCapacity": branch["maxCapacity"],
        "occupancyPercentage": round((branch["currentOccupancy"] / branch["maxCapacity"]) * 100, 1),
        "totalActiveMembers": total_active_members,
        "todayCheckIns": today_checkins + 142, # Realistic base
        "mrrAmount": 3485000, # INR ~34.8 Lakhs
        "newJoinersThisMonth": 48,
        "activeClassesToday": len(MOCK_CLASSES),
        "equipmentHealthScore": 97,
        "peakHoursDistribution": peak_distribution,
        "recentAccessLogs": MOCK_ACCESS_LOGS[:6]
    }
