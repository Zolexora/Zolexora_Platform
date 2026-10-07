# ZolexoraDeployment agent instructions

## Scope and phase status

Work only inside the `ZolexoraDeployment` repository unless the user explicitly authorizes a broader scope. Do not inspect sibling product repositories to infer missing configuration.

DP-09 defines a fail-closed Marketplace application deployment contract without deploying an application. The repository is **not production-ready**. Public installation and deployment remain unauthorized, `install.sh --apply` remains invalid, and six root commands deliberately fail closed.

## Architecture

- Inspect existing files before creating alternatives.
- Do not create duplicate scripts with overlapping responsibilities.
- Preserve the provider-neutral core boundary.
- Put provider-specific and service-specific behavior in replaceable adapters.
- Keep public operational entry points at the repository root; internal libraries belong in `core/lib/` and must not duplicate them.
- Put application deployment contracts under `applications/<application>/`; application source belongs in its own repository.
- GitHub Actions workflows belong only under `.github/workflows/` when DP-12 authorizes them.
- Production applications run only through Docker Compose using immutable image tags, normally a Git commit SHA.
- Never use the mutable `latest` tag for a production image.
- Reuse `core/lib/` functions instead of duplicating validation, path, configuration, locking, release, logging, or redaction behavior.
- Preserve the `dp_` public and `dp__` private function namespaces.
- Keep production libraries non-executable and free of source-time side effects.
- Reuse `core/lib/diagnostics.sh`, preserve its fixed check identifiers, and keep diagnostics read-only and secret-safe.
- Never add remediation to `doctor.sh`, source OS-release data, or expose raw listener, resolver, service, or OS output.
- Preserve the deterministic doctor text and JSON schemas and add fixture-backed tests for diagnostic changes.
- Reuse `core/lib/installation.sh` and `core/install/`; do not duplicate their filesystem, package, version, idempotency, or transaction policy.
- Keep `install.sh` dry-run-only until a later explicitly authorized phase. Never add package, identity, filesystem, permission, service, or repository mutation to planning.
- Preserve the ten fixed installation-plan steps and deterministic text and JSON schemas. Add fixture-backed tests for planning changes.
- Reuse `core/lib/installer-execution.sh`; never expose its mutating functions through a root command without a later explicit phase.
- Preserve the exact DP-07 isolation marker and root validation, logical `/data` translation, ten-step execution order, deterministic reports, and mandatory false production booleans.
- Keep execution and recovery tests inside exact marked test roots. Never weaken symlink, ownership, mode, cleanup, or production-path guards.
- Keep DP-08 qualification explicitly opted in, container-only, offline, repository-read-only, and confined to disposable tmpfs storage. Never expose it through a root command or persist generated package or journal artifacts.
- Keep application deployment definitions under `applications/<application>/`; require digest-qualified images and never infer application roles, ports, commands, health checks, secrets, or storage from another repository.
- Treat the empty DP-09 Marketplace service set as a fail-closed blocker until application owners supply authoritative inputs. Do not weaken it with guessed services or placeholder execution.
- Keep Compose validation configuration-only. Never use validation to build, pull, create, start, run, or migrate a service.

## Security and operations

- Never commit secrets, private keys, certificates with private material, passwords, tokens, or real infrastructure credentials.
- Never print secret values during diagnostics or error handling.
- Never perform live production operations unless the prompt explicitly authorizes them.
- Never install packages, provision infrastructure, modify DNS, connect to production, deploy, restore, or delete data merely to validate code.
- Never commit or push unless explicitly requested.
- Never source runtime configuration as shell code or use `eval` for configuration or command construction.

## Shell requirements

- Use `#!/usr/bin/env bash` and `set -Eeuo pipefail` for production Bash scripts unless an exception is documented.
- Quote variable expansions.
- Validate all external input and filesystem targets.
- Supply explicit allowed roots to path-safety functions and use immutable release references.
- Reject empty, `/`, home-directory, and unresolved destructive targets.
- Never recursively delete or overwrite `/data`, `/`, a home directory, or a path derived from unresolved input.
- Prefer noninteractive and idempotent behavior.
- Use consistent logging and standard exit codes without leaking secrets.
- Run syntax and repository checks before reporting completion.
- Add tests for shared-library behavior, run `tests/run.sh`, and keep unsupported operational commands fail-closed.
