import ipaddress
from fastapi import Request

from core.config import settings
from .models import (
    ApplicationSurface,
    StorefrontContext,
    StorefrontContextSource,
    StorefrontResolutionCode,
    StorefrontKey,
)
from .registry import normalize_host, normalize_origin

STOREFRONT_HEADER = "X-Storefront-Key"

class StorefrontResolutionError(Exception):
    def __init__(self, code: StorefrontResolutionCode, detail: str, status_code: int = 400):
        self.code = code
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)

def _error(code: StorefrontResolutionCode, detail: str) -> StorefrontResolutionError:
    return StorefrontResolutionError(code, detail)

def _is_trusted_proxy(ip: str) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for net in settings.TRUSTED_PROXIES:
        if addr in net:
            return True
    return False

def _get_request_host(request: Request) -> str:
    # First get direct host
    host = request.headers.get("host", "")
    
    client_ip = request.client.host if request.client else ""
    if _is_trusted_proxy(client_ip):
        fwd_host = request.headers.get("x-forwarded-host")
        if fwd_host:
            if "," in fwd_host:
                raise _error(StorefrontResolutionCode.HOST_INVALID, "Multiple forwarded hosts")
            return fwd_host.strip()
        
        fwd = request.headers.get("forwarded")
        if fwd:
            # Parse RFC 7239 Forwarded header
            # E.g. Forwarded: for=192.0.2.60;proto=http;by=203.0.113.43;host=node.example.com
            for part in fwd.split(";"):
                part = part.strip()
                if part.lower().startswith("host="):
                    val = part[5:]
                    if val.startswith('"') and val.endswith('"'):
                        val = val[1:-1]
                    if "," in val:
                        raise _error(StorefrontResolutionCode.HOST_INVALID, "Multiple forwarded hosts")
                    return val.strip()
    return host

async def resolve_storefront(request: Request, repository) -> StorefrontContext | None:
    raw_host = _get_request_host(request)
    allow_port = getattr(repository, "development", False)
    
    try:
        host = normalize_host(raw_host, allow_port=allow_port)
    except ValueError as exc:
        raise _error(StorefrontResolutionCode.HOST_INVALID, "Request host is invalid.") from exc

    direct = await repository.get_definition_by_host(host)
    surface = await repository.get_surface_by_host(host)
    
    if direct is None and surface is None:
        raise _error(StorefrontResolutionCode.UNKNOWN, "Request storefront is unknown.")

    signals: list[tuple[object, StorefrontContextSource]] = []
    if direct is not None:
        signals.append((direct, StorefrontContextSource.HOST))

    origins = request.headers.getlist("origin")
    if origins:
        if len(origins) != 1:
            raise _error(StorefrontResolutionCode.ORIGIN_INVALID, "Request Origin is invalid.")
        try:
            origin = normalize_origin(origins[0], allow_local_http=allow_port)
        except ValueError as exc:
            raise _error(StorefrontResolutionCode.ORIGIN_INVALID, "Request Origin is invalid.") from exc
            
        origin_storefront = await repository.get_definition_by_origin(origin)
        if origin_storefront is None:
            from urllib.parse import urlsplit
            try:
                p = urlsplit(origin)
                orig_host = normalize_host(f"{p.hostname}:{p.port}" if p.port else p.hostname or "", allow_port=allow_port)
                orig_surface = await repository.get_surface_by_host(orig_host)
            except Exception:
                orig_surface = None
            if orig_surface not in {ApplicationSurface.SELLER_PORTAL, ApplicationSurface.MARKETPLACE_ADMIN}:
                raise _error(StorefrontResolutionCode.ORIGIN_INVALID, "Request Origin is not approved.")
        else:
            if surface in {ApplicationSurface.SELLER_PORTAL, ApplicationSurface.MARKETPLACE_ADMIN}:
                raise _error(StorefrontResolutionCode.MISMATCH, "Request storefront context is inconsistent.")
            signals.append((origin_storefront, StorefrontContextSource.ORIGIN))

    hints = request.headers.getlist(STOREFRONT_HEADER)
    if hints:
        if len(hints) != 1 or not hints[0].strip() or "," in hints[0]:
            raise _error(StorefrontResolutionCode.UNKNOWN, "Storefront hint is invalid.")
        try:
            hint_key = StorefrontKey(hints[0].strip())
        except ValueError as exc:
            raise _error(StorefrontResolutionCode.UNKNOWN, "Storefront hint is unknown.") from exc
            
        hint_storefront = await repository.get_definition_by_key(hint_key)
        if hint_storefront is None:
            raise _error(StorefrontResolutionCode.UNKNOWN, "Storefront hint is unknown.")
        if surface in {ApplicationSurface.SELLER_PORTAL, ApplicationSurface.MARKETPLACE_ADMIN}:
            raise _error(StorefrontResolutionCode.MISMATCH, "Request storefront context is inconsistent.")
        signals.append((hint_storefront, StorefrontContextSource.CLIENT_HINT))

    if not signals:
        return None
        
    expected = signals[0][0]
    if any(storefront.key != expected.key for storefront, _ in signals[1:]):
        raise _error(StorefrontResolutionCode.MISMATCH, "Request storefront context is inconsistent.")
        
    if not expected.enabled:
        raise StorefrontResolutionError(
            StorefrontResolutionCode.DISABLED, "Storefront is unavailable.", status_code=404
        )
        
    return StorefrontContext(expected, signals[0][1])
