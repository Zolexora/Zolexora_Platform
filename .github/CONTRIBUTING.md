# Contributing

## Setup

See the [root README](../README.md#getting-started): Docker, Node 20 + pnpm 9 (`corepack enable`), Python 3.12, Infisical CLI (`infisical login`), then `pnpm install` and `pre-commit install`.

## Workflow

1. Branch from `main`: `feat/<product>-<topic>`, `fix/...`, `chore/...`.
2. Keep each PR to one product or one shared change. A change to `packages/*` or `apps/zolexora-auth-service` must keep every consumer building.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) for commits and PR titles, with the product as scope: `feat(tms): ...`, `fix(marketplace)!: ...`. CI checks the PR title.
4. Fill in the PR template; specialised ones exist for backend, frontend, infrastructure and releases.
5. Squash-merge after one approving review from the code owners.

## Rules

- [AGENTS.md](../AGENTS.md) and [docs/architecture.md](../docs/architecture.md) define layout and dependency rules; they apply to humans too.
- Secrets come only from Infisical through `scripts/setup/with-infisical.sh`. Never commit `.env` files, templates or default secret values. List new key names in [docs/secrets.md](../docs/secrets.md).
- Docker: images are built only in GitHub CI (repo root context) and pulled from GHCR; compose has `image:` + `pull_policy: missing` and no `build:`. See [.agents/rules/docker-product-standards.md](../.agents/rules/docker-product-standards.md).
- New host ports go in [docs/ports.md](../docs/ports.md).
- Product layout: `products/<product>/{apps,services,packages}`.

## Reporting

Bugs and features: issue forms. Questions: Discussions. Vulnerabilities: [SECURITY.md](SECURITY.md), never a public issue.
