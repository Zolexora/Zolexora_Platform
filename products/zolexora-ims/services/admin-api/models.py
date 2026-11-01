from typing import Optional
from pydantic import BaseModel


class OrganizationCreate(BaseModel):
    id: str
    name: str
    industry: Optional[str] = "Retail"
    owner_email: str
    currency: Optional[str] = "₹"


class OrganizationItem(BaseModel):
    id: str
    name: str
    industry: Optional[str] = None
    owner_email: Optional[str] = None
    currency: Optional[str] = "₹"
    status: str = "Active"
    created_at: str


class SqlQueryRequest(BaseModel):
    sql: str
