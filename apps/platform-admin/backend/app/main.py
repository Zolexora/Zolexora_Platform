from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db.connections import close_all_connections
from .services.accounts import sync_accounts_from_infisical
from .routers import (
    health_router,
    accounts_router,
    telemetry_router,
    email_router,
    storage_router,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: perform initial discovery
    try:
        sync_accounts_from_infisical()
    except Exception:
        pass
    yield
    # Shutdown: clean up pooled connections
    await close_all_connections()

app = FastAPI(
    title="Zolexora Platform Admin Control Plane",
    description="Centralized backend for database routing, dynamic accounts, email gateway, and capacity telemetry",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health_router)
app.include_router(accounts_router)
app.include_router(telemetry_router)
app.include_router(email_router)
app.include_router(storage_router)
