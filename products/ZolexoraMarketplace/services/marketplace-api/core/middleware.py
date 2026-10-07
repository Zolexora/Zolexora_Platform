import uuid
import time
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from core.logging_setup import request_id_context

logger = logging.getLogger("zolexora.http")
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = req_id
        token = request_id_context.set(req_id)

        t0 = time.perf_counter()
        try:
            response: Response = await call_next(request)
            if request.url.path.startswith(("/admin/", "/api/admin/")) and request.method not in SAFE_METHODS:
                try:
                    from admin_management.audit import audit_admin_mutation
                    actor = getattr(request.state, "authenticated_user", None)
                    if actor:
                        await audit_admin_mutation(request, response, actor)
                except Exception as exc:
                    logger.warning("Admin audit hook failed: %s", exc)
        finally:
            request_id_context.reset(token)

        ms = round((time.perf_counter() - t0) * 1000, 1)
        response.headers["X-Request-ID"]    = req_id
        response.headers["X-Response-Time"] = f"{ms}ms"
        logger.info("%s %s %s %.1fms req_id=%s storefront=%s source=%s",
            request.method, request.url.path, response.status_code, ms, req_id,
            getattr(request.state, "storefront_key", "none"),
            getattr(request.state, "storefront_source", "none"))
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        h = response.headers
        h["X-Content-Type-Options"]    = "nosniff"
        h["X-Frame-Options"]           = "DENY"
        h["X-XSS-Protection"]          = "1; mode=block"
        h["Referrer-Policy"]           = "strict-origin-when-cross-origin"
        h["Permissions-Policy"]        = "camera=(), microphone=(), geolocation=()"
        h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if request.url.path in {"/docs", "/redoc", "/openapi.json"} or request.url.path.startswith(("/docs", "/redoc")):
            h["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://cdn.jsdelivr.net; "
                "worker-src 'self' blob:;"
            )
        else:
            h["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self';"
        return response


def real_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
