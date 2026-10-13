# Repository Ponytail Audit Memory

Last updated: 2026-10-12
Status: In progress

## Purpose

Shared resume point for any agent performing a repository-wide over-engineering audit. Update this file as sections are reviewed, with evidence and next paths. A scan is complete only when all in-scope first-party code and configuration have a recorded review status.

## Scope and method

- Repository: `/workspaces/Zolexora_Platform`.
- Initial inventory: 3,268 Git-tracked files; 1,557 tracked code files by source extension; three Git submodules under `products/zolexora-erp/backend/`.
- Review first-party code/configuration in bounded product and infrastructure sections. Inspect full files for concrete candidates; use search/checksums only to locate likely duplication, not as proof of code quality.
- Treat vendored/generated/build/cache/dependency output as out of scope unless the repository authors maintain it or it creates a clear first-party maintenance burden. Review the ERP submodule integration and local custom code; upstream submodule internals are not first-party code.
- Audit over-engineering only: dead code, duplicate logic/config, unnecessary abstractions/dependencies, wrappers, excess configuration, and straightforward shrink opportunities. Correctness, security, and performance issues are separate review topics.
- Do not modify product code during the audit. Do not run tests unless the user requests verification.

## Coverage ledger

| Section | Status | Notes |
| --- | --- | --- |
| Root workspace and shared packages | Initial pass | Read root manifests/configs; detailed package-source review pending. |
| `.agents`, docs, config, scripts, infrastructure | Initial pass | Inventory done; some configs/manifests/scripts reviewed; broad review pending. |
| `products/clarityfi` | Initial pass | README, workspace/package usage, API server routes, and mobile API call sites reviewed; full mobile source review pending. |
| `products/maunkavach` | Initial pass | README, web manifest, app composition, and UI consumers reviewed; Android/backend source review pending. |
| `products/platform-admin` | Code reviewed | 325 lines read; database router/health/R2 modules are disconnected from the FastAPI app, whose only route is static health. |
| `products/rentoeasy` | Initial pass | Root/API/workspace manifests reviewed; detailed frontend/backend code review pending. |
| `products/the-textile-care` | Initial pass | Exact asset duplicate scan and shared-package/call-site review started; backend and app source review pending. |
| `products/zolexora-ai` | Initial pass | README/architecture, package manifests, requirement files, Docker/Compose references, source inventory and project history/file/change call graph reviewed; full source files remain pending. |
| `products/zolexora-appsuite` | Code reviewed | Read 2,631 lines of app/config/schema/README source; excluded `.next`, tsbuildinfo, and `.env.local`. Two unreferenced server actions; request creation also exists as a page handler and API endpoint. |
| `products/zolexora-engage` | Initial pass | README, workspace/package usage, and exact duplicate packages reviewed; detailed app/API flow review pending. |
| `products/zolexora-erp` first-party code | Not reviewed | Inspect local customization/integration only; upstream submodules excluded. |
| `products/zolexora-ims` | Not reviewed | |
| `products/zolexora-marketplace` | Not reviewed | Follow its local agent instructions before detailed review. |
| `products/zolexora-tms` | Initial pass | Agent instructions read; first-pass abstraction inventory only. |
| Git submodule internals | Excluded | Third-party ERPNext, Frappe, and Payments upstream trees; assess only first-party integration. |

## Candidate findings (preliminary, verify before final report)

- `shrink:` Remove the repeated `products/zolexora-engage/apps/*` glob from root `pnpm-workspace.yaml` (one duplicate line).
- `delete:` Consolidate byte-identical Nginx and PostgreSQL test Compose configs under `infrastructure/containers/{compose,docker}`; verify all references and compatibility paths before recommending a canonical path.
- `delete:` The Textile Care `logo.png` and `logo-white.png` assets are byte-identical across seller, marketplace, and admin web public directories; consider a shared canonical asset source. Determine build/deploy constraints before finalizing.
- `yagni:` The Zolexora Marketplace buyer mobile apps contain nine identical route/store files (1,435 duplicate lines) despite ADR 0007 rejecting copied full-app behavior and requiring two distinct binaries. Share identical app behavior while retaining separate app identities, storefront config, and release artifacts.

These candidates are not yet final findings; validate file ownership, consumers, and intended product boundaries during the detailed pass.

- `delete:` In untracked `products/zolexora-appsuite`, `lib/actions/contracts.ts` (`signContract`) has no callers; `lib/actions/requests.ts` (`createApplicationRequest`) has no callers and overlaps the page's direct insert. Both are removable unless an external integration is planned. Verify with `rg` before finalizing.
- `yagni:` The App Suite `app/api/requests` route has no in-app callers and duplicates request listing/creation already done directly via Supabase in pages. Keep it only if it is an intentional external API contract; no local docs currently describe one.
- `delete:` `infrastructure/containers/compose/postgres-test.yml` is identical to `infrastructure/containers/docker/postgres-test.compose.yml`; current marketplace tests use the latter path through the documented `infrastructure/docker` compatibility symlink. Verify no other consumer of the former before finalizing.
- `delete:` TheTextileCare `packages/tenant` is listed as a workspace dependency but has no code imports; its resolver is only a no-op placeholder. Remove the unused package/dependency/path alias unless the frontend implementation is scheduled imminently.
- `delete:` Remove uncalled placeholder implementations `PlaceholderAuthProvider` and `PlaceholderTenantResolver`; keep `AuthUser`/`AuthSession` types used by the app.
- `delete:` `@ttc/config` exports three unreferenced default constants and `@ttc/api-client` exports unreferenced `createApiClientConfig`; retain the used runtime config and API client.
- `delete:` TheTextileCare's logo/image set is byte-identical across all three web apps (7 files per app); one canonical source can feed each app's static build instead of storing 21 copies. Verify asset pipeline/deployment paths before finalizing.
- `delete:` Remove unused `@zolexora/eslint-config` package and its sole declared dependency; no ESLint config extends it, and the root config is used instead.
- `delete:` `packages/api-contracts/openapi.yaml` is unreferenced and has empty `paths`; keep the TypeScript contracts only unless external tooling consumes the YAML outside this repository.
- `delete:` Clarity FI's `packages/db` is an unused scaffold (empty schema, no code imports); the API server only exposes health and the mobile app stores data locally. Remove the package and its API-server dependency unless a database-backed feature is scheduled now.
- `delete:` Clarity FI declares `@workspace/api-client-react` in the mobile app but imports no client functions; its optional API server exposes only health. Drop the client package/dependency until a real API feature consumes it.
- `delete:` Clarity FI and Zolexora Engage each carry an identical empty Drizzle schema package; Engage also has no code imports of `@workspace/db` (only a manifest dependency and setup docs). Remove the unused DB package/dependencies or add an actual schema/consumer when required.
- `shrink:` Simplify `products/rentoeasy/package.json`: remove the npm/Yarn `workspaces` list and duplicated Nest dependencies; pnpm already defines workspace globs in `pnpm-workspace.yaml`, and `services/api` declares its own runtime dependencies.
- `delete:` Remove `products/platform-admin/backend/app/db/` and its unused dependencies until an admin route consumes it; the only FastAPI route returns a static health payload and no code imports the database package.
- `delete:` Trim the Maun Kavach marketing site's generated `components/ui` catalog and its Radix/form/chart/carousel dependencies to the components actually used. The live app imports only Card, while its Toaster and TooltipProvider have no feature consumers; `@tanstack/react-query` is only mounted in an app with no query hooks.
- `delete:` Remove `createSignedDownloadUrl` from Maun Kavach storage until a caller needs direct streaming; the Android client currently proxies downloads through the API and the exported function has no callers.

- `delete:` `products/zolexora-ai/backend/requirements.txt` repeats the root requirements list with only two additional Azure packages; repository setup and the production Dockerfile use the root file, and no local installer references the backend copy. Remove the duplicate file or have the root manifest include those Azure packages. Verify any external backend-only workflow before finalizing.

## Progress updates

- 2026-10-12: Created this shared ledger and linked it from `.agents/rules/ponytail.md` so agents have a repository-wide resume point.
- 2026-10-12: Initial workspace inventory and quick candidate discovery completed. Existing worktree changes at start: modified root `pnpm-lock.yaml`, modified root `pnpm-workspace.yaml`, untracked `products/zolexora-appsuite/`; preserve these.
- 2026-10-12: Read the App Suite's first-party source, schema, package manifests, and README. Excluded generated `.next` files and did not open the local `.env.local`. Confirmed both server-action exports lack local callers; `createApplicationRequest` duplicates the active new-request page flow. No code fixes applied.
- 2026-10-12: Verified marketplace ADR 0007 and package manifests; nine route/store files are byte-identical in the two buyer mobile workspaces (1,435 duplicated lines). The two apps retain distinct storefront config and identities, so only shared behavior is a simplification candidate.
- 2026-10-12: Initial infrastructure/config read-through found duplicate PostgreSQL test stacks, with the `docker/` path used through the backward-compatibility symlink. Full scripts and infrastructure read-through remains pending.
- 2026-10-12: Textile Care initial package review found an unused frontend tenant package and no-op placeholder providers, plus unused exported config helpers/constants. Confirmed seven branding assets are byte-identical in all three web apps; full app/backend review pending.
- 2026-10-12: Root shared-package review found the shared ESLint package is never extended, despite being declared as one product's dev dependency; the shared OpenAPI YAML is unreferenced and declares no paths.
- 2026-10-12: Clarity FI review found the README's API is optional and the mobile UI uses AsyncStorage/direct Google Sheets fetches; its API server currently only provides health. The Drizzle package has no schema or code imports, and the declared client package is not imported by the mobile UI. Engage has the same empty Drizzle schema package with no code imports; its API package has a stale `@workspace/db` dependency.
- 2026-10-12: Read all 325 Platform Admin code lines. Its `app/db` modules export a cross-product database router, health aggregator, and stub R2 URL, but are never imported; the FastAPI app only serves a static health route and the frontend only renders a title.
- 2026-10-12: Maun Kavach web manifest has a large generated Radix/shadcn dependency set. Its app only uses a card on the not-found page; toast/tooltip wrappers have no feature call sites, and TanStack Query is mounted without any query consumers. Android and backend remain unreviewed.
- 2026-10-12: Read the Maun Kavach Node backend, SQL schema, and integration test. Confirmed `createSignedDownloadUrl` is exported but never called; current client downloads are proxied through the API. The app's `AutoLockManager` is intentionally a security feature and out of this complexity audit despite being not yet wired, per the product's stated security scope.
- 2026-10-12: Rento Easy root manifest duplicates workspace declarations (`workspaces` and `pnpm-workspace.yaml`) and declares Nest runtime dependencies that are owned by `services/api`; no root source imports them. Detailed product source review remains pending.
- 2026-10-12: Zolexora AI initial inventory covers about 17,356 Python/TypeScript source lines (12,589 backend Python lines plus frontend source), excluding tests for the source count. Root/backend requirements substantially duplicate; README and production Dockerfile use the root list, while no repository-local setup references the backend copy. Compose files have distinct contents and were not treated as duplicates. History/file/change services are used by the projects API and context builder. Full code review remains pending.
- 2026-10-12: First-pass TMS provider search found the D1 provider is the only active code consumer, while old reports claim an active PostgreSQL fallback and newer phase reports say it was disabled. Do not make a provider-removal finding until the authoritative current status is reconciled.

## Resume here

Continue with detailed read-through by product, beginning with Zolexora AI backend and frontend. Update the coverage ledger and progress notes after each section. Before publishing final findings, verify each candidate against callers, manifests, docs, and deployment structure; remove unsupported candidates. Report remaining unreviewed paths explicitly.
