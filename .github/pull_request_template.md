## What and why

<!-- What changes, and the problem it solves. Title must be a Conventional Commit: feat(tms): ..., fix!: ... -->

Closes #

## Products / areas touched

<!-- e.g. products/zolexora-tms, apps/zolexora-auth-service, packages/auth-client, .github -->

## How it was verified

<!-- Commands run and their result: pnpm --filter <pkg> test, pytest, docker compose config, manual steps -->

## Checklist

- [ ] Follows [AGENTS.md](../AGENTS.md) (root Docker build context, no forced `--build`, GHCR `image:` + `pull_policy: missing`)
- [ ] No secrets, `.env` files or secret defaults; new keys added to Infisical and listed in `docs/secrets.md`
- [ ] Ports changed? `docs/ports.md` updated
- [ ] Shared code changed? Every consumer still builds
- [ ] Docs updated (product README / `docs/`)

<!-- Specialised templates: append ?template=backend.md | frontend.md | infrastructure.md | release.md to the PR URL. -->
