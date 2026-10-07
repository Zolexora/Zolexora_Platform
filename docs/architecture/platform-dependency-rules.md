# Platform Core Dependency Rules

This document establishes the dependency constraints for Platform Core and products within the Zolexora Platform, specifically following the introduction of our first shared capability, `@zolexora/api-contracts`.

## Core Dependency Rules

1. **Direction of Dependencies**:
   - Products MAY depend on Platform Core packages (e.g., `packages/api-contracts`).
   - Platform Core packages MUST NEVER depend on specific products or product internals.
   - Products MUST NEVER depend on other products' internals. If cross-product communication is necessary, it must happen via defined API contracts or event schemas provided by Platform Core.

2. **Platform Core Boundary**:
   - Platform Core packages should contain code that is genuinely shared and domain-agnostic.
   - They must NOT contain product-specific business logic or configuration.
   - Any new package added to `packages/` must first be proven as duplicated across at least two products.

3. **Versioning and Contracts**:
   - Platform Core packages (e.g., `@zolexora/api-contracts`) act as the source of truth for cross-product types and schemas.
   - Breaking changes in Platform Core must be communicated and validated across all consuming products.

4. **Integration Rules**:
   - When migrating a product to use a Platform Core capability, adapters should be used if the product's internal representation strictly differs, though direct adoption is preferred when types naturally align.
   - Local duplicate definitions must be removed upon successful migration.

## Current State
- **@zolexora/api-contracts**: Consumed by `RentoEasy`, `TheTextileCare`, and `ZolexoraEngage`.

## Turborepo and Workspace Isolation
To maintain strict product autonomy, we do NOT use a single global `pnpm-workspace.yaml` for the entire repository. Products maintain their own isolated workspaces.
Dependencies on Platform Core packages MUST be linked using relative `file:` paths (e.g., `"@zolexora/api-contracts": "file:../../../../packages/api-contracts"`).
This pattern is reproducible, CI-safe, and ensures Docker builds can selectively copy the required platform dependencies without dragging the entire monorepo into the container.
