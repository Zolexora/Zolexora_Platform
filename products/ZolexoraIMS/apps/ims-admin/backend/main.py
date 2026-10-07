import os
from datetime import datetime, timezone
from typing import List

try:
    from dotenv import load_dotenv
    _backend_dir = os.path.dirname(os.path.abspath(__file__))
    for _env_file in (".env.local", "env.local", ".env"):
        _target = os.path.join(_backend_dir, _env_file)
        if os.path.isfile(_target):
            load_dotenv(_target)
except ImportError:
    pass

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

try:
    from .db import db
    from .auth import require_superadmin
    from .models import OrganizationCreate, OrganizationItem, SqlQueryRequest
except ImportError:
    from db import db
    from auth import require_superadmin
    from models import OrganizationCreate, OrganizationItem, SqlQueryRequest

app = FastAPI(title="Zolexora IMS Admin Control Plane API", version="2.0.0")

raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*")
if raw_origins.strip() == "*":
    cors_origins = ["*"]
    allow_credentials = False
else:
    cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
@app.get("/api/v1/health")
async def health():
    return {"status": "healthy", "service": "ims-admin-api"}


@app.get("/api/v1/organizations", response_model=List[OrganizationItem])
async def list_orgs(admin=Depends(require_superadmin)):
    return await db.query("SELECT * FROM organizations ORDER BY created_at DESC;")


@app.post("/api/v1/organizations", status_code=201)
async def create_org(org: OrganizationCreate, admin=Depends(require_superadmin)):
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        "INSERT INTO organizations (id, name, industry, owner_email, currency, status, created_at) VALUES (?, ?, ?, ?, ?, 'Active', ?);",
        [org.id, org.name, org.industry, org.owner_email, org.currency or "₹", now]
    )
    return await db.fetch_one("SELECT * FROM organizations WHERE id = ?;", [org.id])


@app.post("/api/v1/sql")
async def execute_sql_console(query: SqlQueryRequest, admin=Depends(require_superadmin)):
    sql = query.sql.strip()
    if sql.upper().startswith("SELECT"):
        rows = await db.query(sql)
        return {"success": True, "rows": rows, "count": len(rows)}
    else:
        res = await db.execute(sql)
        return {"success": True, "meta": res}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
