# Testing contract

Testing layers will include repository contract tests, shell unit tests, static analysis, Compose validation, template-rendering tests, idempotency tests, container integration tests, fresh-server rehearsal, and explicitly authorized live adapter tests.

Normal contract tests must be local, deterministic, non-mutating, secret-safe, and network-free. Live adapter tests are separate and require explicit authorization.

The implemented local suite includes:

- `contract/repository-structure.sh` for repository layout and safety invariants;
- `contract/library-contract.sh` for source-time, namespace, mode, dependency, and prohibited-command rules;
- six `unit/*-test.sh` suites for runtime, validation, paths, configuration, locking, and release metadata;
- `unit/diagnostics-test.sh` for fixture-backed parsing, capacity and filesystem boundaries, local command stubs, aggregation, and deterministic rendering;
- `contract/doctor-contract.sh` for the operational read-only command boundary and output schemas;
- `fixtures/doctor/` for fake OS, capacity, listener, resolver, and time data;
- `fixtures/install/` for filesystem, package, and local dpkg state;
- `unit/installation-test.sh` for manifests, inspection, package inventory, idempotency, rendering, and safety;
- `contract/install-plan-contract.sh` for the dry-run-only root interface and mutation prohibitions;
- `fixtures/install/execution/` for immutable plans, simulated package states, journal, and recovery expectations;
- `unit/installer-execution-test.sh` for isolation, plan, package, journal, failure, recovery, idempotency, and rendering behavior;
- `contract/installer-execution-contract.sh` for the test-only execution boundary and public apply prohibition;
- `integration/isolated-installer-test.sh` for end-to-end marked-root execution and all fixed failure boundaries;
- `integration/disposable-ubuntu-test.sh` for separately guarded local-image-only Ubuntu 24.04/26.04 validation;
- `integration/preproduction-installer-qualification-test.sh` for explicit-opt-in, offline synthetic-package, filesystem, recovery, and locking qualification in both supported disposable Ubuntu environments;
- `contract/application-deployment-contract.sh` for the DP-09 fail-closed Compose, immutable-image example, network, hardening, and public-command boundaries;
- `lib/test-helpers.sh`, which is test-only and owns validated `/tmp/zolexora-dp04.*` and marked `/tmp/zolexora-dp07.*` cleanup;
- `run.sh`, the single runner in contract-then-unit order.

`run.sh` preserves the earlier order, then runs the installer-execution contract, unit suite, and isolated integration suite. Disposable Ubuntu validation is separate and requires explicit development/test classification, local exact images, disabled networking and pulls, and safe mounts. Tests use fake values and exact test-owned temporary directories. JSON is checked in Bash and additionally parsed with Python when available. Tests contact no network and mutate no host configuration.

DP-07 concluded with PASS after the development/test classification was confirmed and the guarded Ubuntu 24.04 and 26.04 disposable tests both passed. This validates only simulated installation inside disposable roots: public installation remains disabled and production readiness remains false.

DP-08 qualification remains separate from `run.sh` because the default suite must not require Docker. Run it only with `ZOLEXORA_PREPRODUCTION_QUALIFICATION=ZOLEXORA_PREPRODUCTION_QUALIFICATION_CONFIRMED tests/integration/preproduction-installer-qualification-test.sh`. It uses exact local images, disabled pulls and networking, a read-only repository, disposable tmpfs storage, and an inert runtime-built package. Passing qualification does not enable public installation or establish production readiness.

DP-09 adds configuration-only validation. The contract test parses the Marketplace YAML with an already-installed YAML module when available, otherwise requires existing Compose v2, validates the literal example through shared configuration and immutable-image helpers, and may run only `docker compose config --quiet`. It creates no container, network, volume, or secret and performs no registry access.
