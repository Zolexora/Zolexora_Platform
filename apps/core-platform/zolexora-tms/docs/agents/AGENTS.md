# Antigravity Workspace Guidelines

This document defines the core operational standards, tooling workflows, and architectural guidelines for AI agents working within the **Zolexora TMS** workspace.

---

## 1. Antigravity Agent Operations & Workflow

- **Reactive Wakeup & Zero Polling**: Antigravity resumes agent execution reactively when background tasks or subagents finish. Never run loops or poll status commands. Once background execution is triggered, yield execution by stopping tool calls.
- **Scheduling over Sleep**: Never invoke `sleep` in terminal commands. Use the native `schedule` tool for delayed wakeups or recurring cron executions.
- **Subagent Utilization**:
  - Use `research` subagents for extensive file audits, repository reconnaissance, or searching documentation without cluttering primary context.
  - Use `self` subagents for isolated task execution requiring workspace tools.
  - Define specialized subagents via `define_subagent` when repetitive domain-specific roles are needed.
- **Clickable File Links**: Always link to referenced files using clickable GitHub-style markdown links with the `file://` scheme and file basenames (e.g., [package.json](../../package.json) or [compose.yaml](../../compose.yaml)).

---

## 2. Generative UI & Visual Artifacts

When generating interactive components, previews, or data visualizations:
- **Tailwind CDN**: Use the approved gstatic Tailwind script:
  `<script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>`
- **Theme Variables**: Use semantic design tokens (`bg-[var(--card)]`, `text-[var(--foreground)]`, `border-[var(--border)]`, `bg-[var(--background)]`). Do not define local color fallbacks on `:root`.
- **Inline Widgets (`<agent-embed>`)**:
  - Keep widgets compact (under 500px in height).
  - Set `<body class="bg-transparent ...">` so the widget blends into the chat container.
  - Wrap content in card containers with borders and padding.
- **Standalone Artifacts**: For complex dashboards or workflows, save standalone `.html` artifacts to be viewed in the side auxiliary pane.

---

## 3. Model Context Protocol (MCP) Integration

MCP servers are configured in the repo-root `.agents/mcp_config.json` and globally in `~/.gemini/config/mcp_config.json`:
- **`filesystem`**: Scoped file operations across the repository.
- **`fetch`**: Fetch external web documentation and API endpoints.
- **`sequential-thinking`**: Deep reasoning and step-by-step problem breakdown.
- **`memory`**: Persistent cross-session knowledge and entity tracking.
- **`puppeteer`**: Automated headless browser testing and UI inspection.
- **`postgres`**: Database queries against local PostgreSQL (host port from [docs/ports.md](../../../../../docs/ports.md); never `5432`).
- **`github`**: GitHub repository management, issues, and PR interactions.

Manage servers via the Antigravity CLI:
```bash
agy mcp list
agy mcp add <name> <commandOrUrl> [args...]
```

---

## 4. Zolexora TMS Monorepo Architecture

- **Structure** (`apps/core-platform/zolexora-tms/`):
  - `apps/tms-web` (`@zolexora/tms-web`): client app — Vite + React 19, dev port 3031.
  - `apps/tms-admin` (`@zolexora/tms-admin`): admin dashboard — Vite + React 19, dev port 3032.
  - `apps/tms-mobile` (`@zolexora/tms-mobile`): Expo app.
  - `services/backend`: FastAPI API (port 4030 in Docker, host `4031`).
  - `compose.yaml` + `nginx.conf`: Docker stack, gateway on host `3090`.
- **Development Scripts** (run from the repo root):
  - `pnpm dev:tms:infisical` / `pnpm dev:tms:admin:infisical` / `pnpm dev:tms:api:infisical`: dev servers with Infisical secrets.
  - `pnpm dev:tms:mobile`: Expo dev server.
  - `pnpm docker:tms:start|stop|restart|build|pull|logs|status`: Docker stack (GHCR images, `pull_policy: missing`).
  - `pnpm turbo run lint typecheck build --filter='./apps/core-platform/zolexora-tms/**'`: checks for every TMS package.
- **Secrets**: Infisical only (`/Zolexora_TMS`); never create `.env` files.
- **Code Cleanliness**: Preserve all existing comments and docstrings. Verify TypeScript builds before completing tasks.

---

## 5. Ponytail: Lazy Senior Dev Decision Ladder

Enforce minimalism, avoid over-engineering, and write the minimum code that works. Before writing any code, climb this ladder:

1. **Does this need to be built at all?** (YAGNI - You Aren't Gonna Need It).
2. **Does it already exist in this codebase?** Reuse existing helpers, utilities, or patterns; do not duplicate logic.
3. **Does the standard library already do this?** Use built-in JavaScript/Node/TypeScript standard methods.
4. **Does a native platform feature cover it?** Use native Web API or runtime features.
5. **Does an already-installed dependency solve it?** Leverage existing packages rather than adding new ones.
6. **Can this be one line?** Prefer simple, readable one-liners or concise logic over heavy abstractions.
7. **Only then**: Write the minimum code that works.

**Core Directives**:
- No abstractions that weren't explicitly requested.
- No new dependencies if existing ones or stdlib suffice.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins once the root cause and problem flow are fully understood.

