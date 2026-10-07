import os
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
import logging
import sentry_sdk
from prometheus_client import make_asgi_app

from core.config import settings
from core.database import get_db, close_db
from core.seed import seed_data
from core.middleware import RequestIDMiddleware, SecurityHeadersMiddleware

# ── Legacy routers (Sprint 3+ will migrate these) ────────────────────────────
from routers.products import router as products_router
from routers.reels import router as reels_router
from routers.cart import router as cart_router
from routers.wishlist import router as wishlist_router
from routers.orders import orders_router
from routers.admin_orders import admin_orders_router
from routers.portal_catalog import admin_catalog_router, seller_catalog_router
from routers.other import coins_router, subs_router, admin_router
from scripts.ensure_indexes import ensure_indexes
from shipping.router import router as shipping_router
from shipping.webhooks import router as shipping_webhooks_router
from routers.erp_webhooks import router as erp_webhooks_router

# ── New domain routers (Sprint 1 & 2) ────────────────────────────────────────
from auth.router import router as auth_router
from users.router import router as users_router
from storefronts.router import router as storefront_router
from storefronts.resolver import StorefrontResolutionError
from routers.payments import router as payments_router
from seller_orgs.router import router as seller_orgs_router
from media.router import router as media_router
from admin_management.router import router as admin_management_router

# ── New shared infrastructure ────────────────────────────────────────────────
from shared.database.postgres import init_pool, close_pool
from shared.database.redis import init_redis, close_redis, check_redis_connection

from core.logging_setup import setup_logging
setup_logging()
logger = logging.getLogger("zolexora")

sentry_dsn = os.environ.get("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        enable_tracing=True,
        traces_sample_rate=1.0,
    )

UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Zolexora API v2.1.0")
    settings.validate()

    # ── Shared infrastructure ──────────────────────────────────────────────
    init_redis()
    await check_redis_connection()
    await init_pool()

    # ── Legacy MongoDB (kept alive for unmigrated routers) ─────────────────
    db = get_db()
    await ensure_indexes(db)
    await seed_data(db)

    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    await close_redis()
    await close_pool()
    close_db()
    logger.info("Zolexora API stopped.")


app = FastAPI(
    title="Zolexora API", version="2.1.0",
    description="Provider-independent Marketplace API with PostgreSQL identities and Redis sessions",
    lifespan=lifespan,
)

# Middleware (outermost → innermost)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID", "X-Session-Transport", "X-Storefront-Key"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)

metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    logger.error("Unhandled req_id=%s path=%s: %s", req_id, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "request_id": req_id})


@app.exception_handler(StorefrontResolutionError)
async def _storefront_error(_request: Request, exc: StorefrontResolutionError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code.value, "detail": exc.detail},
    )


# Local static (dev fallback — production uses Cloudinary)
app.mount("/api/static", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

P = "/api"

# Mount routers under both /api and root so requests work seamlessly with or without /api prefix
for prefix in [P, ""]:
    # ── New domain routers (Sprint 1 & 2) ───────────── registered FIRST
    app.include_router(auth_router,  prefix=prefix)
    app.include_router(users_router, prefix=prefix)
    app.include_router(storefront_router, prefix=prefix)
    app.include_router(payments_router, prefix=prefix)
    app.include_router(seller_orgs_router, prefix=prefix)
    app.include_router(media_router, prefix=prefix)
    app.include_router(admin_management_router, prefix=prefix)

    # ── Legacy routers (to be migrated in Sprint 3 & 4) ──────────────────────
    app.include_router(products_router,          prefix=prefix)
    app.include_router(reels_router,             prefix=prefix)
    app.include_router(cart_router,              prefix=prefix)
    app.include_router(wishlist_router,          prefix=prefix)
    app.include_router(orders_router,            prefix=prefix)
    app.include_router(admin_orders_router,      prefix=prefix)
    app.include_router(seller_catalog_router,    prefix=prefix)
    app.include_router(admin_catalog_router,     prefix=prefix)
    app.include_router(coins_router,             prefix=prefix)
    app.include_router(subs_router,              prefix=prefix)
    app.include_router(admin_router,             prefix=prefix)
    app.include_router(shipping_router,          prefix=prefix)
    app.include_router(shipping_webhooks_router, prefix=prefix)
    app.include_router(erp_webhooks_router,      prefix=prefix)


@app.get("/", include_in_schema=False)
async def root(): return RedirectResponse("/docs")


@app.get("/health")
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "2.1.0"
    }


@app.get("/ready")
@app.get("/api/ready")
async def readiness():
    from database.engine import check_readiness
    from shared.database.redis import check_redis_connection

    database_ok = await check_readiness()
    redis_ok = await check_redis_connection()
    ready = database_ok and redis_ok
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"status": "ready" if ready else "unavailable", "database": database_ok, "redis": redis_ok},
    )
