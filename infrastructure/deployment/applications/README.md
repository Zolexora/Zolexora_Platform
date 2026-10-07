# Application deployment packages

An application package owns its unique lowercase identifier, Compose project definition, immutable image requirements, configuration names, secret references, hostname-to-service routing, database-migration contract, health-check contract, persistent volumes, network exposure, release and rollback metadata, backup participation, and capacity assumptions.

Application packages contain no real secrets or application source. Application CI builds images; this repository consumes immutable image references. Database and Redis ports must never be published publicly, and only explicitly routed HTTP services may be reachable through Nginx.

Application-specific behavior must not be hard-coded into provider-neutral core. Packages place Compose configuration inside their own `applications/<identifier>/` directory. DP-09 establishes the first non-executing contract under `applications/marketplace/`; concrete services remain fail-closed until application-owned inputs are authoritative.
