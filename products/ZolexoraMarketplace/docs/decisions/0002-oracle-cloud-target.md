# ADR 0002: Oracle Cloud is the final platform target

- **Status:** Superseded by [ADR 0012](0012-marketplace-cloud-agnostic-baseline.md)
- **Date:** 2026-07-14
- **Decision owners:** Marketplace engineering and operations

## Context

The current Zolexora system depends on MongoDB, Supabase PostgreSQL/Auth, Redis, Cloudinary, Vercel/Northflank-oriented configuration, and provider-specific deployment instructions. Mahila Madel adds a second MongoDB/Express deployment. The business has chosen to move the complete final platform to Oracle Cloud Infrastructure.

The repository does not yet contain an Oracle schema, OCI infrastructure as code, Object Storage adapter, OCI secret integration, or verified target-architecture container builds.

## Decision

OCI is the approved final production platform.

The target uses:

- OCI DNS, WAF, Load Balancer, and certificate management for public ingress.
- OCI Compute for containerized application workloads, using Ampere A1 where capacity and compatibility are verified.
- OCIR for immutable application images.
- Autonomous Database as the canonical transactional data store.
- OCI Object Storage for media and generated artifacts.
- OCI Cache for appropriate ephemeral data and coordination.
- OCI Secret Management/Vault capabilities for runtime secrets and key management.
- OCI Logging, Monitoring, Alarms, Notifications, and Audit for operations.
- Infrastructure as code for reproducible environments.

Provider-neutral application interfaces will isolate database repositories, object storage, cache, and secrets from business modules.

## Consequences

### Positive

- One cloud ownership model for application, data, ingress, security, and observability.
- Transactional relational modeling for storefront, inventory, orders, and payments.
- Workload identity and managed secret access reduce credential distribution.
- Infrastructure can be reviewed, reproduced, and audited.
- ARM-based compute can be cost-effective when images and dependencies support it.

### Costs and risks

- Existing MongoDB/Supabase/Cloudinary integrations must be replaced or isolated behind adapters.
- Oracle schema design and repository work are substantial and require database expertise.
- OCI service limits, region capacity, networking, IAM, and operational skills must be validated.
- ARM64 compatibility cannot be inferred from Dockerfile syntax; full builds and runtime tests are required.
- Cloud migration and storefront/payment changes must be sequenced to avoid an untestable big-bang release.

## Rejected alternatives

### Keep the current mixed hosting permanently

Rejected because it conflicts with the chosen complete Oracle migration and preserves fragmented operational ownership.

### Lift and shift only the API VM

Rejected as the final state because MongoDB, Supabase, Cloudinary, DNS, secrets, and observability would remain outside the target platform.

### Rewrite all application modules before establishing OCI foundations

Rejected because data, image, identity, and runtime constraints need early staging validation. Migration proceeds in controlled phases with provider-neutral boundaries.

## Implementation constraints

- All infrastructure and database changes are versioned and reviewable.
- No secrets, Terraform state, wallets, or private keys enter source control.
- Production data requires automated recovery and tested restore procedures, even though initial development may start from a fresh dataset.
- Dev, staging, and production credentials/resources are isolated.
- Application images are built and tested for the deployed CPU architecture.
- No live cutover occurs before staging security, recovery, payment, and rollback gates pass.

## Related documents

- [Oracle infrastructure](../oracle-infrastructure.md)
- [Architecture](../architecture.md)
- [Delivery phases](../phases.md)

