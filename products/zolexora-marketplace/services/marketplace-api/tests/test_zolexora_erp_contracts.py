import inspect
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from integrations.zolexora_erp.contracts import (
    EventEnvelope,
    PaymentAccountingEntry,
    ReconciliationResult,
    SalesOrderLine,
    SalesOrderRequest,
)
from integrations.zolexora_erp.mappings import (
    ERPOrganizationReference,
    ERPTenantReference,
    MarketplaceERPConfiguration,
    RetryPolicy,
    StorefrontERPMapping,
)


def event_data():
    return {
        "schema_version": "1.0",
        "event_id": str(uuid4()),
        "event_type": "sales_order.requested",
        "occurred_at": "2026-07-15T12:00:00Z",
        "source_system": "customer-commerce-system",
        "source_tenant_id": "tenant-1",
        "organization_external_id": "org-1",
        "correlation_id": "correlation-1",
        "idempotency_key": "order-1:v1",
        "payload": {"order_external_id": "order-1"},
    }


@pytest.mark.parametrize(
    "field",
    ["schema_version", "event_id", "source_tenant_id", "organization_external_id", "idempotency_key"],
)
def test_event_envelope_requires_identity_and_idempotency(field):
    data = event_data()
    del data[field]
    with pytest.raises(ValidationError):
        EventEnvelope.model_validate(data)


def test_event_envelope_requires_utc_and_known_version():
    data = event_data()
    data["occurred_at"] = datetime(2026, 7, 15, 12, 0)
    with pytest.raises(ValidationError):
        EventEnvelope.model_validate(data)
    data = event_data()
    data["schema_version"] = "2.0"
    with pytest.raises(ValidationError):
        EventEnvelope.model_validate(data)


def tenant():
    return ERPTenantReference(
        tenant_url="https://customer-erp.example",
        tenant_external_id="tenant-1",
        environment="production",
        contract_version="v1",
        capabilities=frozenset({"sales-orders", "inventory"}),
        client_identity_reference="marketplace-service-client",
        allowed_scopes=frozenset({"sales-orders:write", "inventory:read"}),
        webhook_signing_identity_reference="marketplace-webhook-key",
        rate_limit_per_minute=120,
        retry_policy=RetryPolicy(maximum_attempts=8, initial_backoff_seconds=5, maximum_backoff_seconds=3600),
    )


def mapping(storefront, organization, channel):
    return StorefrontERPMapping(
        storefront_key=storefront,
        tenant_external_id="tenant-1",
        organization_external_id=organization,
        sales_channel_external_id=channel,
        warehouse_external_id="warehouse-main",
    )


def test_mapping_supports_one_legal_company_with_two_channels():
    config = MarketplaceERPConfiguration(
        tenant=tenant(),
        organizations=(ERPOrganizationReference(organization_external_id="org-1", company_reference="company-1"),),
        storefronts=(mapping("zolexora-shop", "org-1", "channel-a"), mapping("mahila-madel", "org-1", "channel-b")),
    )
    assert len(config.organizations) == 1


def test_mapping_supports_two_legal_companies():
    config = MarketplaceERPConfiguration(
        tenant=tenant(),
        organizations=(
            ERPOrganizationReference(organization_external_id="org-1", company_reference="company-1"),
            ERPOrganizationReference(organization_external_id="org-2", company_reference="company-2"),
        ),
        storefronts=(mapping("zolexora-shop", "org-1", "online"), mapping("mahila-madel", "org-2", "online")),
    )
    assert len(config.organizations) == 2


def test_duplicate_sales_channel_in_same_organization_is_rejected():
    with pytest.raises(ValidationError):
        MarketplaceERPConfiguration(
            tenant=tenant(),
            organizations=(ERPOrganizationReference(organization_external_id="org-1", company_reference="company-1"),),
            storefronts=(mapping("zolexora-shop", "org-1", "online"), mapping("mahila-madel", "org-1", "online")),
        )


def test_no_default_tenant_or_company_exists():
    with pytest.raises(ValidationError):
        ERPTenantReference.model_validate({})
    with pytest.raises(ValidationError):
        ERPOrganizationReference.model_validate({})


def test_public_mapping_models_cannot_represent_credentials():
    assert not {"api_key", "client_secret", "password", "token"} & set(ERPTenantReference.model_fields)
    with pytest.raises(ValidationError):
        ERPTenantReference.model_validate({**tenant().model_dump(), "client_secret": "forbidden"})


def test_marketplace_storefront_keys_translate_only_through_configuration():
    assert mapping("zolexora-shop", "org-1", "channel-a").sales_channel_external_id == "channel-a"
    assert mapping("mahila-madel", "org-2", "channel-b").organization_external_id == "org-2"


def test_generic_contract_models_do_not_hardcode_marketplace_storefronts():
    source = inspect.getsource(__import__("integrations.zolexora_erp.contracts", fromlist=["*"]))
    assert "zolexora-shop" not in source
    assert "mahila-madel" not in source


def test_sales_order_requires_mutation_idempotency():
    with pytest.raises(ValidationError):
        SalesOrderRequest(
            schema_version="1.0",
            tenant_external_id="tenant-1",
            organization_external_id="org-1",
            order_external_id="order-1",
            sales_channel_external_id="channel-a",
            customer_external_id="customer-1",
            currency="INR",
            total_minor=100,
            lines=(SalesOrderLine(line_external_id="line-1", item_external_id="sku-1", warehouse_external_id="wh-1", quantity=1, unit_price_minor=100, tax_amount_minor=0),),
        )


def test_payment_accounting_has_no_gateway_secret_fields():
    fields = set(PaymentAccountingEntry.model_fields)
    assert not {"provider", "gateway_secret", "merchant_secret", "api_key"} & fields


def test_reconciliation_mismatch_stays_open():
    result = ReconciliationResult(
        schema_version="1.0",
        tenant_external_id="tenant-1",
        organization_external_id="org-1",
        entity_type="sales-order",
        marketplace_reference="order-1",
        erp_reference="SO-1",
        expected_state="paid",
        observed_state="unpaid",
        matched=False,
    )
    assert result.resolution_status == "open"


def test_serialization_uses_stable_contract_field_names():
    envelope = EventEnvelope.model_validate(event_data())
    assert list(envelope.model_dump(mode="json")) == [
        "schema_version", "event_id", "event_type", "occurred_at", "source_system",
        "source_tenant_id", "organization_external_id", "correlation_id", "causation_id",
        "idempotency_key", "payload",
    ]


def test_contract_tree_is_language_neutral_and_versioned():
    root = Path(__file__).parents[3] / "contracts" / "zolexora-erp" / "v1"
    assert (root / "proposed-openapi.yaml").is_file()
    assert len(list((root / "schemas").glob("*.schema.json"))) == 12
    assert len(list((root / "examples").glob("*.example.json"))) == 7
