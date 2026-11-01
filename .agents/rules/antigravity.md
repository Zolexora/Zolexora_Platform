# Antigravity Execution Standards

## Tool Execution & Safety
- Before executing modifying commands, confirm target directories and file paths.
- Avoid deleting untracked files or resetting git worktrees without explicit instructions.
- Never write credentials, private keys, or API tokens into tracked files. Secrets come only from Infisical (`bash scripts/setup/with-infisical.sh <product-dir> <cmd>`).

## Monorepo Standards
- One pnpm workspace at the repo root: add dependencies with `pnpm --filter <@zolexora/pkg> add …` and commit the single root `pnpm-lock.yaml`. No nested lockfiles, no `npm`.
- Run tasks through Turborepo from the root: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, or scoped (`pnpm turbo run lint --filter=@zolexora/tms-web`). Per-product shortcuts live in root `package.json` (`dev:tms`, `lint:admin`, …).
- Keep components modular and favor Tailwind CSS v4 utility classes.

## Generative UI & Visual Artifacts
- All visual widgets embedded inline must use the `<agent-embed>` syntax with a relative or `file://` URI to an artifact HTML file.
- Keep inline embeds under 500px to avoid scroll clipping.
- Use host CSS variables (`--card`, `--border`, `--foreground`, `--background`, `--primary`).
