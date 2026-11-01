from contextlib import asynccontextmanager
import logging
import time
import uuid
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
import sentry_sdk

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.storage import StorageError
from app.modules.core.health.routes import router as health_router

setup_logging()
logger = logging.getLogger("zolexora.api")

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.1,
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Zolexora TMS API service...")
    try:
        from app.db.base import Base
        from app.db.session import engine
        from app.modules.identity.roles.seed_platform_templates import seed as seed_role_templates
        # Production schema is managed only by Alembic (which also applies RLS policies);
        # create_all would add tables without tenant isolation.
        if settings.IS_DEV_OR_TEST:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        await seed_role_templates()
        logger.info("Database schema and platform role templates verified.")
    except Exception as e:
        logger.warning(f"Database auto-init on startup skipped or failed: {e}")
    yield
    logger.info("Shutting down Zolexora TMS API service...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    docs_url="/docs" if settings.IS_DEV_OR_TEST else None,
    redoc_url="/redoc" if settings.IS_DEV_OR_TEST else None,
    lifespan=lifespan,
)

# Strict CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{process_time:.2f}ms"
    return response

@app.exception_handler(StorageError)
async def storage_exception_handler(request: Request, exc: StorageError):
    logger.error(f"Storage failure [req_id={getattr(request.state, 'request_id', 'unknown')}]: {exc}")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"error": {"code": "STORAGE_UNAVAILABLE", "message": "File storage is unavailable. Please try again later."}},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"Unhandled exception [req_id={req_id}]: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "details": {"request_id": req_id} if settings.IS_DEV_OR_TEST else {},
            }
        },
    )

from app.db import models as _db_models  # noqa: F401

# Mount Routers
from app.modules.identity.organisations.routes import router as organisations_router
from app.modules.identity.users.routes import router as users_router
from app.modules.identity.roles.routes import router as roles_router
from app.modules.fleet.vehicles.routes import router as vehicles_router
from app.modules.operations.bookings.routes_request import router as booking_requests_router
from app.modules.operations.bookings.routes import router as bookings_router
from app.modules.operations.duties.routes import router as duties_router
from app.modules.core.customization.routes import router as customization_router
from app.modules.finance.billing.routes import router as billing_router
from app.modules.core.platform.routes import router as platform_router
from app.modules.core.platform.admin_routes import router as admin_router
from app.modules.identity.auth.routes import router as auth_router
from app.modules.core.extensions.r1rcm.routes import router as r1rcm_router
from app.modules.crm.clients.routes import router as clients_router
from app.modules.operations.operating_units.routes import router as operating_units_router
from app.modules.crm.vendors.routes import router as vendors_router
from app.modules.fleet.drivers.routes import router as drivers_router
from app.modules.operations.trips.routes import router as trips_router
from app.modules.operations.dispatch.routes import router as dispatch_router
from app.modules.core.compliance.routes import router as compliance_router
from app.modules.finance.invoices.routes import router as invoices_router
from app.modules.finance.invoices.adjustment_routes import router as adjustments_router
from app.modules.finance.payments.routes import router as payments_router
from app.modules.finance.payables.routes import router as payables_router
from app.modules.finance.expenses.routes import router as expenses_router
from app.modules.finance.pl.routes import router as pl_router

app.include_router(health_router)
app.include_router(health_router, prefix="/api")
app.include_router(organisations_router)
app.include_router(users_router)
app.include_router(roles_router)
app.include_router(customization_router)
app.include_router(vehicles_router)
app.include_router(booking_requests_router)
app.include_router(bookings_router)
app.include_router(duties_router)
app.include_router(billing_router)
app.include_router(platform_router)
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(r1rcm_router)
app.include_router(clients_router)
app.include_router(operating_units_router)
app.include_router(vendors_router)
app.include_router(drivers_router)
app.include_router(trips_router)
app.include_router(dispatch_router)
app.include_router(compliance_router)
# Finance routers declare short prefixes (/invoices, /payments, ...)
for finance_router in (invoices_router, adjustments_router, payments_router, payables_router, expenses_router, pl_router):
    app.include_router(finance_router, prefix="/api/v1")

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")
