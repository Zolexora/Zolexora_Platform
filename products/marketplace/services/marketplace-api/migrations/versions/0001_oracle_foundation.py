"""Marketplace Oracle persistence foundation.

Revision ID: 0001_oracle_foundation
Revises: None
"""
from alembic import op

revision = "0001_oracle_foundation"
down_revision = None
branch_labels = None
depends_on = None

DDL = (
    r"""CREATE TABLE external_system (
    id VARCHAR2(36 CHAR) NOT NULL, 
    system_key VARCHAR2(64 CHAR) NOT NULL, 
    display_name VARCHAR2(128 CHAR) NOT NULL, 
    status VARCHAR2(16 CHAR) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    CONSTRAINT pk_external_system PRIMARY KEY (id), 
    CONSTRAINT uq_external_system_system_key UNIQUE (system_key)
)""",
    r"""CREATE TABLE storefront (
    id VARCHAR2(36 CHAR) NOT NULL, 
    storefront_key VARCHAR2(64 CHAR) NOT NULL, 
    display_name VARCHAR2(128 CHAR) NOT NULL, 
    is_active SMALLINT NOT NULL, 
    currency VARCHAR2(3 CHAR) NOT NULL, 
    locale VARCHAR2(16 CHAR) NOT NULL, 
    row_version INTEGER DEFAULT '1' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    CONSTRAINT pk_storefront PRIMARY KEY (id), 
    CONSTRAINT ck_storefront_storefront_key_lower CHECK (storefront_key = LOWER(storefront_key)), 
    CONSTRAINT uq_storefront_storefront_key UNIQUE (storefront_key)
)""",
    r"""CREATE OR REPLACE TRIGGER trg_storefront_key_immutable
BEFORE UPDATE OF storefront_key ON storefront
FOR EACH ROW
BEGIN
    IF \:OLD.storefront_key <> \:NEW.storefront_key THEN
        RAISE_APPLICATION_ERROR(-20001, 'storefront_key is immutable');
    END IF;
END;""",
    r"""CREATE TABLE external_tenant (
    id VARCHAR2(36 CHAR) NOT NULL, 
    external_system_id VARCHAR2(36 CHAR) NOT NULL, 
    tenant_key VARCHAR2(128 CHAR) NOT NULL, 
    endpoint_url VARCHAR2(512 CHAR), 
    environment VARCHAR2(16 CHAR) NOT NULL, 
    status VARCHAR2(16 CHAR) NOT NULL, 
    credential_ref VARCHAR2(256 CHAR), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    CONSTRAINT pk_external_tenant PRIMARY KEY (id), 
    CONSTRAINT uq_ext_tenant_scope UNIQUE (external_system_id, tenant_key, environment), 
    CONSTRAINT fk_external_tenant_external_system_id FOREIGN KEY(external_system_id) REFERENCES external_system (id)
)""",
    r"""CREATE TABLE storefront_domain (
    id VARCHAR2(36 CHAR) NOT NULL, 
    storefront_id VARCHAR2(36 CHAR) NOT NULL, 
    hostname VARCHAR2(253 CHAR) NOT NULL, 
    environment VARCHAR2(16 CHAR) NOT NULL, 
    domain_role VARCHAR2(16 CHAR) NOT NULL, 
    is_active SMALLINT NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    CONSTRAINT pk_storefront_domain PRIMARY KEY (id), 
    CONSTRAINT ck_storefront_domain_domain_hostname_lower CHECK (hostname = LOWER(hostname)), 
    CONSTRAINT ck_storefront_domain_domain_hostname_shape CHECK (INSTR(hostname, '.') > 0 AND INSTR(hostname, '/') = 0 AND INSTR(hostname, ':') = 0 AND INSTR(hostname, '*') = 0 AND INSTR(hostname, '?') = 0 AND INSTR(hostname, '#') = 0 AND INSTR(hostname, '@') = 0 AND INSTR(hostname, ' ') = 0), 
    CONSTRAINT ck_storefront_domain_domain_role_values CHECK (domain_role IN ('primary','alias','development')), 
    CONSTRAINT ck_storefront_domain_domain_env_values CHECK (environment IN ('production','development','test')), 
    CONSTRAINT fk_storefront_domain_storefront_id FOREIGN KEY(storefront_id) REFERENCES storefront (id), 
    CONSTRAINT uq_storefront_domain_hostname UNIQUE (hostname)
)""",
    r"""CREATE UNIQUE INDEX uq_domain_active_primary ON storefront_domain (CASE WHEN (is_active = 1 AND domain_role = 'primary') THEN storefront_id END, CASE WHEN (is_active = 1 AND domain_role = 'primary') THEN environment END)""",
    r"""CREATE TABLE external_entity_mapping (
    id VARCHAR2(36 CHAR) NOT NULL, 
    external_tenant_id VARCHAR2(36 CHAR) NOT NULL, 
    entity_type VARCHAR2(64 CHAR) NOT NULL, 
    marketplace_id VARCHAR2(128 CHAR) NOT NULL, 
    external_id VARCHAR2(256 CHAR) NOT NULL, 
    status VARCHAR2(16 CHAR) NOT NULL, 
    mapping_version INTEGER DEFAULT '1' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    CONSTRAINT pk_external_entity_mapping PRIMARY KEY (id), 
    CONSTRAINT uq_entity_marketplace UNIQUE (external_tenant_id, entity_type, marketplace_id), 
    CONSTRAINT uq_entity_external UNIQUE (external_tenant_id, entity_type, external_id), 
    CONSTRAINT fk_external_entity_mapping_external_tenant_id FOREIGN KEY(external_tenant_id) REFERENCES external_tenant (id)
)""",
    r"""CREATE TABLE external_organization (
    id VARCHAR2(36 CHAR) NOT NULL, 
    external_tenant_id VARCHAR2(36 CHAR) NOT NULL, 
    organization_key VARCHAR2(128 CHAR) NOT NULL, 
    display_name VARCHAR2(256 CHAR), 
    status VARCHAR2(16 CHAR) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    CONSTRAINT pk_external_organization PRIMARY KEY (id), 
    CONSTRAINT uq_ext_org_scope UNIQUE (external_tenant_id, organization_key), 
    CONSTRAINT fk_external_organization_external_tenant_id FOREIGN KEY(external_tenant_id) REFERENCES external_tenant (id)
)""",
    r"""CREATE TABLE integration_inbox (
    id VARCHAR2(36 CHAR) NOT NULL, 
    external_tenant_id VARCHAR2(36 CHAR) NOT NULL, 
    external_event_id VARCHAR2(128 CHAR) NOT NULL, 
    event_type VARCHAR2(128 CHAR) NOT NULL, 
    schema_version VARCHAR2(16 CHAR) NOT NULL, 
    payload_hash VARCHAR2(64 CHAR) NOT NULL, 
    processing_status VARCHAR2(24 CHAR) NOT NULL, 
    correlation_id VARCHAR2(64 CHAR), 
    failure_category VARCHAR2(64 CHAR), 
    received_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    processed_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_integration_inbox PRIMARY KEY (id), 
    CONSTRAINT uq_inbox_tenant_event UNIQUE (external_tenant_id, external_event_id), 
    CONSTRAINT fk_integration_inbox_external_tenant_id FOREIGN KEY(external_tenant_id) REFERENCES external_tenant (id)
)""",
    r"""CREATE TABLE integration_outbox (
    id VARCHAR2(36 CHAR) NOT NULL, 
    event_type VARCHAR2(128 CHAR) NOT NULL, 
    schema_version VARCHAR2(16 CHAR) NOT NULL, 
    aggregate_type VARCHAR2(64 CHAR) NOT NULL, 
    aggregate_id VARCHAR2(128 CHAR) NOT NULL, 
    storefront_id VARCHAR2(36 CHAR), 
    external_tenant_id VARCHAR2(36 CHAR), 
    correlation_id VARCHAR2(64 CHAR), 
    causation_id VARCHAR2(64 CHAR), 
    idempotency_key VARCHAR2(128 CHAR) NOT NULL, 
    payload_json CLOB NOT NULL, 
    payload_hash VARCHAR2(64 CHAR) NOT NULL, 
    status VARCHAR2(24 CHAR) NOT NULL, 
    attempt_count INTEGER DEFAULT '0' NOT NULL, 
    available_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    next_attempt_at TIMESTAMP WITH TIME ZONE, 
    published_at TIMESTAMP WITH TIME ZONE, 
    lease_owner VARCHAR2(128 CHAR), 
    lease_until TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    CONSTRAINT pk_integration_outbox PRIMARY KEY (id), 
    CONSTRAINT ck_integration_outbox_outbox_payload_json CHECK (payload_json IS JSON), 
    CONSTRAINT fk_integration_outbox_storefront_id FOREIGN KEY(storefront_id) REFERENCES storefront (id), 
    CONSTRAINT fk_integration_outbox_external_tenant_id FOREIGN KEY(external_tenant_id) REFERENCES external_tenant (id), 
    CONSTRAINT uq_integration_outbox_idempotency_key UNIQUE (idempotency_key)
)""",
    r"""CREATE INDEX ix_outbox_claim ON integration_outbox (status, available_at, next_attempt_at)""",
    r"""CREATE TABLE reconciliation_run (
    id VARCHAR2(36 CHAR) NOT NULL, 
    external_tenant_id VARCHAR2(36 CHAR) NOT NULL, 
    domain VARCHAR2(64 CHAR) NOT NULL, 
    window_start TIMESTAMP WITH TIME ZONE NOT NULL, 
    window_end TIMESTAMP WITH TIME ZONE NOT NULL, 
    status VARCHAR2(24 CHAR) NOT NULL, 
    checked_count INTEGER DEFAULT '0' NOT NULL, 
    issue_count INTEGER DEFAULT '0' NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    completed_at TIMESTAMP WITH TIME ZONE, 
    initiator_type VARCHAR2(32 CHAR) NOT NULL, 
    correlation_id VARCHAR2(64 CHAR), 
    CONSTRAINT pk_reconciliation_run PRIMARY KEY (id), 
    CONSTRAINT fk_reconciliation_run_external_tenant_id FOREIGN KEY(external_tenant_id) REFERENCES external_tenant (id)
)""",
    r"""CREATE TABLE integration_dead_letter (
    id VARCHAR2(36 CHAR) NOT NULL, 
    outbox_id VARCHAR2(36 CHAR), 
    inbox_id VARCHAR2(36 CHAR), 
    reason_category VARCHAR2(64 CHAR) NOT NULL, 
    first_failure_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    latest_failure_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    replay_status VARCHAR2(24 CHAR) NOT NULL, 
    operator_ref VARCHAR2(128 CHAR), 
    resolved_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_integration_dead_letter PRIMARY KEY (id), 
    CONSTRAINT ck_integration_dead_letter_dead_letter_source CHECK (outbox_id IS NOT NULL OR inbox_id IS NOT NULL), 
    CONSTRAINT fk_integration_dead_letter_outbox_id FOREIGN KEY(outbox_id) REFERENCES integration_outbox (id), 
    CONSTRAINT fk_integration_dead_letter_inbox_id FOREIGN KEY(inbox_id) REFERENCES integration_inbox (id)
)""",
    r"""CREATE TABLE integration_delivery_attempt (
    id VARCHAR2(36 CHAR) NOT NULL, 
    outbox_id VARCHAR2(36 CHAR) NOT NULL, 
    attempt_number INTEGER NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    completed_at TIMESTAMP WITH TIME ZONE, 
    result_category VARCHAR2(64 CHAR), 
    retry_classification VARCHAR2(32 CHAR), 
    response_metadata_json CLOB, 
    CONSTRAINT pk_integration_delivery_attempt PRIMARY KEY (id), 
    CONSTRAINT ck_integration_delivery_attempt_attempt_metadata_json CHECK (response_metadata_json IS JSON), 
    CONSTRAINT uq_attempt_number UNIQUE (outbox_id, attempt_number), 
    CONSTRAINT fk_integration_delivery_attempt_outbox_id FOREIGN KEY(outbox_id) REFERENCES integration_outbox (id)
)""",
    r"""CREATE TABLE reconciliation_issue (
    id VARCHAR2(36 CHAR) NOT NULL, 
    reconciliation_run_id VARCHAR2(36 CHAR) NOT NULL, 
    storefront_id VARCHAR2(36 CHAR), 
    entity_type VARCHAR2(64 CHAR) NOT NULL, 
    marketplace_id VARCHAR2(128 CHAR), 
    external_id VARCHAR2(256 CHAR), 
    difference_category VARCHAR2(64 CHAR) NOT NULL, 
    severity VARCHAR2(16 CHAR) NOT NULL, 
    expected_json CLOB, 
    observed_json CLOB, 
    resolution_status VARCHAR2(24 CHAR) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    resolved_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_reconciliation_issue PRIMARY KEY (id), 
    CONSTRAINT ck_reconciliation_issue_issue_expected_json CHECK (expected_json IS JSON), 
    CONSTRAINT ck_reconciliation_issue_issue_observed_json CHECK (observed_json IS JSON), 
    CONSTRAINT fk_reconciliation_issue_reconciliation_run_id FOREIGN KEY(reconciliation_run_id) REFERENCES reconciliation_run (id), 
    CONSTRAINT fk_reconciliation_issue_storefront_id FOREIGN KEY(storefront_id) REFERENCES storefront (id)
)""",
    r"""CREATE TABLE storefront_erp_mapping (
    id VARCHAR2(36 CHAR) NOT NULL, 
    storefront_id VARCHAR2(36 CHAR) NOT NULL, 
    external_tenant_id VARCHAR2(36 CHAR) NOT NULL, 
    external_organization_id VARCHAR2(36 CHAR) NOT NULL, 
    purpose VARCHAR2(32 CHAR) NOT NULL, 
    sales_channel_ref VARCHAR2(128 CHAR), 
    cost_center_ref VARCHAR2(128 CHAR), 
    warehouse_ref VARCHAR2(128 CHAR), 
    price_list_ref VARCHAR2(128 CHAR), 
    payment_mode_ref VARCHAR2(128 CHAR), 
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL, 
    effective_to TIMESTAMP WITH TIME ZONE, 
    is_active SMALLINT NOT NULL, 
    metadata_json CLOB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, 
    CONSTRAINT pk_storefront_erp_mapping PRIMARY KEY (id), 
    CONSTRAINT ck_storefront_erp_mapping_erp_map_metadata_json CHECK (metadata_json IS JSON), 
    CONSTRAINT fk_storefront_erp_mapping_storefront_id FOREIGN KEY(storefront_id) REFERENCES storefront (id), 
    CONSTRAINT fk_storefront_erp_mapping_external_tenant_id FOREIGN KEY(external_tenant_id) REFERENCES external_tenant (id), 
    CONSTRAINT fk_storefront_erp_mapping_external_organization_id FOREIGN KEY(external_organization_id) REFERENCES external_organization (id)
)""",
    r"""CREATE UNIQUE INDEX uq_store_erp_period ON storefront_erp_mapping (storefront_id, purpose, SYS_EXTRACT_UTC(effective_from))""",
)

def upgrade() -> None:
    for statement in DDL:
        op.execute(statement)


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
