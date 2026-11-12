"""Business verification, accepted documents, activity groups and permission-catalog approvals (ADR 0004 §6, ADR 0005 §2).

The auth service owns this data. These routes forward the admin's own bearer token to its
/api/v1/admin/... endpoints, which check platform-admin rights again. Only listed paths pass.
"""
import re

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from .. import auth

router = APIRouter(prefix="/api/identity", tags=["Identity"])

_UUID = r"[0-9a-fA-F-]{36}"
_KEY = r"[a-z0-9_]{2,40}"
ALLOWED = [
    ("GET", rf"verifications"),
    ("GET", rf"verifications/{_UUID}"),
    ("POST", rf"verifications/{_UUID}/decision"),
    ("GET", r"verification-document-types"),
    ("PUT", rf"verification-document-types/{_KEY}"),
    ("GET", r"activity-groups"),
    ("PUT", rf"activity-groups/{_KEY}"),
    ("GET", r"catalog/versions"),
    ("POST", rf"catalog/versions/{_UUID}/(approve|reject|rollback)"),
]
_QUERY_KEYS = {"status", "check", "product"}


async def _forward(method: str, url: str, authorization: str, **kwargs) -> JSONResponse:
    if not auth.AUTH_SERVICE_URL:
        raise HTTPException(503, "AUTH_SERVICE_URL is not set (Infisical)")
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.request(method, url, headers={"Authorization": authorization}, **kwargs)
    except httpx.HTTPError:
        raise HTTPException(503, "Auth service unreachable")
    try:
        body = res.json()
    except ValueError:
        body = {"detail": res.text[:300]}
    if res.status_code >= 400 and "detail" not in body:
        body = {**body, "detail": body.get("message") or f"Auth service error {res.status_code}"}
    return JSONResponse(status_code=res.status_code, content=body)


@router.post("/documents/{document_id}/url")
async def document_url(document_id: str, authorization: str = Header("")) -> JSONResponse:
    """A 15-minute download link for an uploaded verification document."""
    if not re.fullmatch(r"[A-Za-z0-9-]{8,100}", document_id):
        raise HTTPException(400, "Invalid document id")
    return await _forward("POST", f"{auth.AUTH_SERVICE_URL}/api/v1/storage/kyc/signed-url", authorization,
                          json={"document_id": document_id, "expiry_seconds": 900})


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT"])
async def proxy(path: str, request: Request, authorization: str = Header("")) -> JSONResponse:
    if not any(m == request.method and re.fullmatch(p, path) for m, p in ALLOWED):
        raise HTTPException(404, "Not found")
    params = {k: v for k, v in request.query_params.items() if k in _QUERY_KEYS}
    kwargs: dict = {"params": params}
    if request.method != "GET":
        try:
            kwargs["json"] = (await request.json()) if await request.body() else {}
        except ValueError:
            raise HTTPException(400, "Body must be JSON")
    return await _forward(request.method, f"{auth.AUTH_SERVICE_URL}/api/v1/admin/{path}", authorization, **kwargs)
