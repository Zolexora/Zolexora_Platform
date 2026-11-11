import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import (
    auth,
    dashboard,
    members,
    access,
    classes,
    trainers,
    equipment,
    billing,
    pos
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ironclub.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🏋️ Zolexora IronClub Smart Gym Engine initialized.")
    logger.info("Gate Access Sub-system ready on /api/v1/access/verify")
    yield
    logger.info("Zolexora IronClub Backend safely shutting down.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise Multi-Branch Smart Gym Management & IoT Turnstile Access Gateway",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev / mobile / edge turnstiles
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health checks
@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "HEALTHY",
        "service": "zolexora-ironclub-backend",
        "version": settings.VERSION,
        "environment": "production-ready"
    }

@app.get("/ready", tags=["System"])
def readiness_check():
    return {
        "ready": True,
        "gateEngine": "ONLINE",
        "subsystem": "IronClub Smart Access Core"
    }

# Mount API V1 Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(access.router, prefix=settings.API_V1_STR)
app.include_router(members.router, prefix=settings.API_V1_STR)
app.include_router(classes.router, prefix=settings.API_V1_STR)
app.include_router(trainers.router, prefix=settings.API_V1_STR)
app.include_router(equipment.router, prefix=settings.API_V1_STR)
app.include_router(billing.router, prefix=settings.API_V1_STR)
app.include_router(pos.router, prefix=settings.API_V1_STR)

@app.get("/", tags=["System"])
def root():
    return {
        "platform": "Zolexora Platform",
        "app": "🏋️ Zolexora IronClub Smart Gym Management System",
        "version": settings.VERSION,
        "docs": "/docs",
        "apiV1": settings.API_V1_STR,
        "features": [
            "Smart IoT Turnstiles with Sub-50ms Verification",
            "Multi-Branch Capacity & Live Occupancy Telemetry",
            "Dynamic QR Anti-Passback Digital Pass",
            "Class Scheduling & Group Training",
            "Trainer Roster & PT Session Tracking",
            "Equipment Health & Preventative Maintenance",
            "Billing, Invoices & Pro-Shop POS"
        ]
    }
