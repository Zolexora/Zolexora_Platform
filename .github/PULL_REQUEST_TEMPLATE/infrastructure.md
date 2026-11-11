## What and why

Closes #

## Change

<!-- Dockerfiles, compose.yaml, GitHub Actions, scripts/, infrastructure/ -->

## Checklist

- [ ] Docker builds use the repo root as context (`context: ../../`, `dockerfile: products/<p>/Dockerfile.<svc>`)
- [ ] Compose services have `image: ${..._IMAGE:-ghcr.io/zolexora/zolexora-<product>-<svc>:latest}` and `pull_policy: missing`
- [ ] No local image builds: compose has no `build:`, start scripts wrap `scripts/docker/product-stack.sh` (strict pull + `up -d`, through `scripts/setup/with-infisical.sh`)
- [ ] `docker compose config` passes for every touched stack
- [ ] Host ports follow `docs/ports.md` (and it is updated)
- [ ] No `docker system prune -a`; cleanup goes through `pnpm docker:clean` / `pnpm docker:prune`
- [ ] Workflows: least-privilege `permissions:`, secrets only via Infisical / GitHub secrets

## Rollout / rollback

<!-- How to deploy, and how to undo it -->
