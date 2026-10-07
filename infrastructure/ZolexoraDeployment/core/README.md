# Provider-neutral core

`core/` is the implementation boundary for behavior shared across supported Ubuntu servers and replaceable integrations. DP-07 adds isolated test-only installer execution; public host installation and deployment remain unimplemented.

Core logic:

- must not directly invoke AWS, OCI, Azure, GCP, or other cloud-provider APIs;
- must not directly invoke GitHub, GitLab, or Cloudflare APIs;
- must not depend on provider metadata services;
- receives validated configuration through documented interfaces;
- must not discover secrets by scanning the environment or filesystem;
- receives secret locations explicitly and never prints secret values;
- resolves and validates destructive filesystem targets before mutation;
- is idempotent where applicable and supports noninteractive execution.

Public command entry points remain at the repository root. `core/` must not contain duplicate public wrappers.

Installation planning sources `runtime.sh`, `validation.sh`, `paths.sh`, `diagnostics.sh`, then `installation.sh`. The installation library parses `core/install/*.tsv`, performs bounded local inspection, and renders a plan; it never applies one. Libraries remain source-only, non-executable, source-time side-effect-free, and provider-neutral.

Isolated execution adds `installer-execution.sh` after those dependencies. It accepts only immutable validated fixture plans and marked test-owned roots, translates logical `/data` paths below that root, simulates package and identity state, journals transactions, verifies postconditions, and builds recovery plans. No root command sources it.

`doctor.sh` remains read-only. `install.sh` supports dry-run planning only and fails closed without `--dry-run`. The other six root commands remain fail-closed.
