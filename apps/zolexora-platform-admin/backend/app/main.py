import logging
import os
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .auth import require_platform_admin
from .db.connections import close_all_connections
from .services.accounts import sync_accounts_from_infisical
from .routers import (
    health_router,
    accounts_router,
    telemetry_router,
    email_router,
    storage_router,
)

logger = logging.getLogger("platform-admin")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        sync_accounts_from_infisical()
    except Exception:
        logger.exception("Initial account discovery failed")
    yield
    await close_all_connections()


app = FastAPI(
    title="Zolexora Platform Admin Control Plane",
    description="Centralized backend for database routing, dynamic accounts, email gateway, and capacity telemetry",
    version="1.0.0",
    lifespan=lifespan,
)

# The UI calls the API through the nginx gateway (same origin), so CORS is off by default.
# CORS_ORIGINS (comma-separated, explicit origins only) enables it, e.g. for `next dev`.
cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if "*" in cors_origins:
    raise RuntimeError("CORS_ORIGINS must list explicit origins, not *")
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Authorization", "Content-Type"],
    )

admin_only = [Depends(require_platform_admin)]
app.include_router(health_router)  # /api/health is the unauthenticated liveness probe; /databases is guarded in the router
app.include_router(accounts_router, dependencies=admin_only)
app.include_router(telemetry_router, dependencies=admin_only)
app.include_router(email_router, dependencies=admin_only)
app.include_router(storage_router, dependencies=admin_only)
