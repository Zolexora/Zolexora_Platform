"""TMS permission catalog registration and mapping (ADR 0005 §2)."""
import logging
from typing import Dict, Iterable, List, Optional, Tuple

import httpx

from app.auth.zolexora import auth_service_url
from app.core.config import settings
from app.modules.core.platform.capabilities import TMS_CAPABILITY_REGISTRY

log = logging.getLogger("tms.catalog")

PRODUCT = "tms"

# Legacy dot-notation permissions not derived 1:1 from TMS_CAPABILITY_REGISTRY
_EXTRA_LEGACY_TO_AUTH: Dict[str, str] = {
    "users.manage": "org:team:manage",
    "identity.users.manage": "org:team:manage",
    "compliance.manage_rules": "tms:compliance_records:manage_rules",
    "compliance.verify": "tms:compliance_records:verify",
    "compliance.override": "tms:compliance_records:override",
}


def _build_catalog() -> Tuple[Dict[str, str], Dict[str, str], Dict[str, str]]:
    catalog: Dict[str, str] = {}
    legacy_to_auth: Dict[str, str] = dict(_EXTRA_LEGACY_TO_AUTH)
    auth_to_legacy: Dict[str, str] = {
        "tms:compliance_records:manage_rules": "compliance.manage_rules",
        "tms:compliance_records:verify": "compliance.verify",
        "tms:compliance_records:override": "compliance.override",
        "org:team:manage": "identity.users.manage",
    }

    for mod in TMS_CAPABILITY_REGISTRY.modules:
        for page in mod.pages:
            for action in page.actions:
                auth_key = f"tms:{mod.code}_{page.code}:{action.code}"
                legacy_key = f"{mod.code}.{page.code}.{action.code}"
                catalog[auth_key] = f"{mod.name} — {page.name}: {action.name}"
                if legacy_key not in legacy_to_auth:
                    legacy_to_auth[legacy_key] = auth_key
                auth_to_legacy.setdefault(auth_key, legacy_key)

    catalog["tms:compliance_records:manage_rules"] = "Compliance — Rules: Manage Compliance Rules"
    catalog["tms:compliance_records:verify"] = "Compliance — Records: Verify Compliance Records"
    catalog["tms:compliance_records:override"] = "Compliance — Records: Override Compliance Status"
    return catalog, legacy_to_auth, auth_to_legacy


TMS_PERMISSIONS, LEGACY_TO_AUTH, AUTH_TO_LEGACY = _build_catalog()


def to_auth_permission(permission: str) -> str:
    return LEGACY_TO_AUTH.get(permission, permission)


def to_legacy_permission(permission: str) -> Optional[str]:
    return AUTH_TO_LEGACY.get(permission)


def expand_auth_permissions(permissions: Iterable[str]) -> List[str]:
    """Expands auth-service permission keys to include TMS legacy dot-notation equivalents."""
    expanded = set(permissions)
    for perm in list(expanded):
        legacy = AUTH_TO_LEGACY.get(perm)
        if legacy:
            expanded.add(legacy)
    return sorted(expanded)


async def register_catalog() -> None:
    """PUT the full TMS capability list to auth-service on startup (never blocks startup)."""
    base = auth_service_url()
    key = (settings.TMS_PRODUCT_KEY or "").strip()
    if not base or not key:
        log.info("TMS permission catalog registration skipped: AUTH_SERVICE_URL or TMS_PRODUCT_KEY not set.")
        return

    body = {"permissions": [{"key": k, "description": d} for k, d in TMS_PERMISSIONS.items()]}
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.put(
                f"{base}/api/v1/catalog/{PRODUCT}",
                json=body,
                headers={"X-Product-Key": key},
            )
        if res.status_code >= 300:
            log.warning("TMS permission catalog not registered: auth service returned %s", res.status_code)
        else:
            data = res.json()
            log.info(
                "TMS permission catalog v%s %s (added=%s, pending_removal=%s)",
                data.get("version"),
                data.get("status"),
                data.get("added"),
                data.get("pending_removal"),
            )
    except httpx.HTTPError as exc:
        log.warning("TMS permission catalog registration failed (%s): %s", type(exc).__name__, exc)
