from .health import router as health_router
from .accounts import router as accounts_router
from .telemetry import router as telemetry_router
from .email import router as email_router
from .storage import router as storage_router

__all__ = [
    "health_router",
    "accounts_router",
    "telemetry_router",
    "email_router",
    "storage_router",
]
