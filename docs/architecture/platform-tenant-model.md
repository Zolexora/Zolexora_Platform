# Platform Tenant Model

**Date:** 2026-10-08

## Current Landscape
* **TheTextileCare & RentoEasy:** Use "Tenant" to refer to a *property/rental customer*, NOT a software tenant.
* **ZolexoraTMS & ZolexoraERP:** Use "Workspace", "Company", or "Site" to represent a B2B SaaS tenant.

## Decision
Do NOT introduce a generic `tenant_id` at the Platform Core level yet. The terminology collision between "Tenant as a user persona" (RentoEasy) and "Tenant as a software partition" (TMS) will cause massive confusion.

Platform API contracts will use `workspace_id` or `organization_id` when referring to B2B partitions to avoid clashing with the rental domain's terminology.
