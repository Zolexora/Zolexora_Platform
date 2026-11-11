from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, model_validator

from storefronts.models import StorefrontKey


class MappingModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class RetryPolicy(MappingModel):
    maximum_attempts: int = Field(ge=1, le=20)
    initial_backoff_seconds: int = Field(ge=1, le=3600)
    maximum_backoff_seconds: int = Field(ge=1, le=86400)


class ERPTenantReference(MappingModel):
    tenant_url: AnyHttpUrl
    tenant_external_id: str = Field(min_length=1)
    environment: Literal["development", "staging", "production"]
    contract_version: Literal["v1"]
    capabilities: frozenset[str]
    client_identity_reference: str = Field(min_length=1)
    allowed_scopes: frozenset[str] = Field(min_length=1)
    webhook_signing_identity_reference: str = Field(min_length=1)
    rate_limit_per_minute: int = Field(gt=0)
    retry_policy: RetryPolicy


class ERPOrganizationReference(MappingModel):
    organization_external_id: str = Field(min_length=1)
    company_reference: str = Field(min_length=1)


class StorefrontERPMapping(MappingModel):
    storefront_key: StorefrontKey
    tenant_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)
    sales_channel_external_id: str = Field(min_length=1)
    warehouse_external_id: str = Field(min_length=1)
    cost_center_external_id: str | None = None
    price_list_external_id: str | None = None
    customer_group_external_id: str | None = None
    tax_template_external_id: str | None = None


class PaymentModeMapping(MappingModel):
    marketplace_payment_account_reference: str = Field(min_length=1)
    payment_mode_external_id: str = Field(min_length=1)
    clearing_account_external_id: str = Field(min_length=1)
    organization_external_id: str = Field(min_length=1)


class SellerSupplierMappingStrategy(MappingModel):
    strategy: Literal["one-supplier-per-seller", "aggregate-clearing-supplier"]
    supplier_group_external_id: str = Field(min_length=1)


class MarketplaceERPConfiguration(MappingModel):
    tenant: ERPTenantReference
    organizations: tuple[ERPOrganizationReference, ...] = Field(min_length=1)
    storefronts: tuple[StorefrontERPMapping, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def reject_unsafe_duplicates(self):
        channels = [
            (mapping.organization_external_id, mapping.sales_channel_external_id)
            for mapping in self.storefronts
        ]
        if len(channels) != len(set(channels)):
            raise ValueError("ERP sales-channel mapping must be unique within an organization")
        if any(mapping.tenant_external_id != self.tenant.tenant_external_id for mapping in self.storefronts):
            raise ValueError("Storefront mappings must reference the configured tenant")
        organizations = {organization.organization_external_id for organization in self.organizations}
        if any(mapping.organization_external_id not in organizations for mapping in self.storefronts):
            raise ValueError("Storefront mappings must reference a configured organization")
        return self
