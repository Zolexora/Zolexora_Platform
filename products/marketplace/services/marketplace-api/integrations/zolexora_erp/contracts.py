from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class EventEnvelope(ContractModel):
    schema_version: Literal["1.0"]
    event_id: UUID
    event_type: str = Field(min_length=1, max_length=100)
    occurred_at: datetime
    source_system: str = Field(min_length=1, max_length=100)
    source_tenant_id: str = Field(min_length=1, max_length=100)
    organization_external_id: str = Field(min_length=1, max_length=100)
    correlation_id: str = Field(min_length=1, max_length=100)
    causation_id: str | None = Field(default=None, max_length=100)
    idempotency_key: str = Field(min_length=1, max_length=200)
    payload: dict[str, Any]

    @field_validator("occurred_at")
    @classmethod
    def require_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value):
            raise ValueError("occurred_at must be UTC")
        return value


class OrganizationReference(ContractModel):
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    legal_name: str = Field(min_length=1)
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    tax_registration_reference: str | None = None


class ExternalEntityReference(ContractModel):
    entity_type: str = Field(min_length=1)
    external_id: str = Field(min_length=1)
    erp_reference: str | None = None


class SalesOrderLine(ContractModel):
    line_external_id: str = Field(min_length=1)
    item_external_id: str = Field(min_length=1)
    warehouse_external_id: str = Field(min_length=1)
    quantity: Decimal = Field(gt=0)
    unit_price_minor: int = Field(ge=0)
    tax_amount_minor: int = Field(ge=0)


class SalesOrderRequest(ContractModel):
    schema_version: Literal["1.0"]
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    order_external_id: str = Field(min_length=1)
    sales_channel_external_id: str = Field(min_length=1)
    customer_external_id: str = Field(min_length=1)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    total_minor: int = Field(ge=0)
    idempotency_key: str = Field(min_length=1)
    lines: tuple[SalesOrderLine, ...] = Field(min_length=1)


class InventoryBalance(ContractModel):
    schema_version: Literal["1.0"]
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    item_external_id: str = Field(min_length=1)
    warehouse_external_id: str = Field(min_length=1)
    available_quantity: Decimal
    as_of: datetime


class DeliveryUpdate(ContractModel):
    schema_version: Literal["1.0"]
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    order_external_id: str = Field(min_length=1)
    delivery_external_id: str = Field(min_length=1)
    status: Literal["created", "dispatched", "delivered", "cancelled"]
    occurred_at: datetime
    idempotency_key: str = Field(min_length=1)


class SalesInvoiceUpdate(ContractModel):
    schema_version: Literal["1.0"]
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    order_external_id: str = Field(min_length=1)
    invoice_external_id: str = Field(min_length=1)
    status: Literal["draft", "submitted", "paid", "cancelled"]
    total_minor: int = Field(ge=0)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    idempotency_key: str = Field(min_length=1)


class PaymentAccountingEntry(ContractModel):
    schema_version: Literal["1.0"]
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    payment_external_id: str = Field(min_length=1)
    order_external_id: str = Field(min_length=1)
    payment_mode_external_id: str = Field(min_length=1)
    amount_minor: int = Field(gt=0)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    status: Literal["captured", "reversed"]
    idempotency_key: str = Field(min_length=1)


class ReturnRequest(ContractModel):
    schema_version: Literal["1.0"]
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    return_external_id: str = Field(min_length=1)
    order_external_id: str = Field(min_length=1)
    reason_code: str = Field(min_length=1)
    amount_minor: int = Field(ge=0)
    idempotency_key: str = Field(min_length=1)


class RefundAccountingEntry(ContractModel):
    schema_version: Literal["1.0"]
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    refund_external_id: str = Field(min_length=1)
    payment_external_id: str = Field(min_length=1)
    credit_reference: str | None = None
    amount_minor: int = Field(gt=0)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    idempotency_key: str = Field(min_length=1)


class ReconciliationResult(ContractModel):
    schema_version: Literal["1.0"]
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    entity_type: str = Field(min_length=1)
    marketplace_reference: str = Field(min_length=1)
    erp_reference: str | None = None
    expected_state: str = Field(min_length=1)
    observed_state: str | None = None
    matched: bool
    resolution_status: Literal["open", "acknowledged", "resolved"] = "open"
