# Shared Bash library contract

DP-04 provides these production libraries:

| Library | Public functions | Contract |
|---|---|---|
| `runtime.sh` | `dp_log_set_level`, `dp_log`, `dp_log_field`, `dp_redact`, `dp_die`, `dp_command_exists` | Exit constants, deterministic stderr logging, complete secret-field redaction, explicit fatal exit |
| `validation.sh` | `dp_is_nonempty`, identifier/key/integer/release/image/timestamp validators and requiring functions | Predicates return 0 only for valid values; requiring functions return safe sysexits-style failures |
| `paths.sh` | `dp_path_canonicalize`, `dp_path_contains_traversal`, `dp_path_is_within`, managed/destructive assertions | Explicit roots, canonical containment, traversal and symlink safety; never mutates paths |
| `config.sh` | `dp_config_load`, `dp_config_require_keys`, `dp_config_get` | Parses allowlisted literal configuration transactionally without sourcing or evaluation |
| `locking.sh` | `dp_lock_acquire`, `dp_lock_release` | Bounded `flock`, caller-owned descriptor variable, explicit release, no trap replacement |
| `release.sh` | `dp_release_validate`, `dp_release_metadata_render`, `dp_release_metadata_load` | Validates and deterministically serializes immutable release metadata without persistence |
| `diagnostics.sh` | `dp_diag_read_os_release`, `dp_diag_read_cpu_count`, `dp_diag_read_memory_kib`, `dp_diag_check_filesystem`, `dp_diag_inventory_commands`, `dp_diag_parse_listener_text`, `dp_diag_collect`, `dp_diag_render_text`, `dp_diag_render_json`, `dp_diag_status_exit` | Collects and renders fixed, provider-neutral, read-only host prerequisite results |
| `installation.sh` | Filesystem/package readers, layout/package inspectors, plan builder, renderers, and status mapping | Builds deterministic read-only installation plans without applying them |
| `installer-execution.sh` | Isolation validation/translation, plan parsing, simulated package and filesystem application, journaling, completion/recovery detection, renderers, and cleanup | Executes immutable fixture plans only inside exact validated disposable roots; never exposed by root commands |

Source `runtime.sh` before direct runtime use. Installation planning uses `runtime.sh`, `validation.sh`, `paths.sh`, `diagnostics.sh`, then `installation.sh`; isolated tests add `installer-execution.sh` last. Repeated sourcing is safe.

## Inputs, outputs, and failures

- Runtime logging accepts explicit levels and non-secret messages, emits to stderr, and returns usage/data errors for malformed input. `dp_die` is the only foundation function that intentionally exits the caller.
- Validation predicates accept one explicit value, produce no normal output, and return zero only when valid. Requiring functions return `DP_EXIT_DATAERR` with a value-free diagnostic.
- Path functions accept explicit absolute targets and allowed roots. Canonicalization writes only the canonical path to stdout; assertions return data/no-input/unavailable failures and never mutate the filesystem.
- Configuration functions accept variable names for an indexed allowlist and associative output. Loads commit output only after complete validation; getters write into one named caller variable. Format failures return `DP_EXIT_CONFIG`.
- Lock acquisition accepts an absolute lock path, timeout from 0 through 300, and an output variable name. Success returns a held descriptor; contention returns `DP_EXIT_TEMPFAIL`. Release consumes only descriptors tracked by the library.
- Release functions accept caller-supplied application, release, timestamp, and image values. Rendering writes deterministic metadata to stdout; loading fills an associative array only after parsing and complete validation.
- Diagnostics parsers accept explicit files, text, roots, or output variables. Collection returns associative keys `<check>.status`, `<check>.summary`, and `overall_status` for the fixed order `operating_system`, `required_commands`, `capacity`, `filesystem`, `docker`, `docker_compose`, `nginx`, `systemd`, `listeners`, `time_sync`, and `dns`. Status severity is `critical > warning > pass`; `dp_diag_status_exit` maps those statuses to 2, 1, and 0. Text and JSON renderers emit deterministic documents, and JSON always declares `production_ready` as false.
- Installation readers transactionally return indexed associative records. Layout inspection returns normalized states without raw identities. Package inventory uses local `dpkg-query` data only. Plans contain `<step>.status`, `<step>.summary`, and `overall_status` for ten fixed steps. JSON always sets `apply_authorized`, `host_modified`, and `production_ready` to false.
- Installer execution validates marked `/tmp/zolexora-dp07.*` roots, translates logical `/data` paths, parses the ten-step immutable execution plan, simulates package and identity state, applies only isolated directories/modes, journals atomic state transitions, verifies completion, and renders deterministic reports. Recovery plans classify state but never execute recovery. Execution JSON always denies production apply, host data/package mutation, and production readiness.

All libraries:

- use Bash under callers configured with `set -Eeuo pipefail`;
- be sourced, never executed as public commands;
- have no side effects merely from being sourced;
- make no network calls or host mutations at source time;
- use namespaced function names and quoted expansions;
- validate inputs explicitly;
- use consistent return and exit semantics;
- log without exposing secrets;
- include unit or contract tests;
- contain no provider-specific implementation.

They have mode `100644`, produce no source-time output or filesystem/network effects, and never change caller shell options or traps. Public functions use `dp_`; private helpers use `dp__`. Configuration values are literal, paths require explicit roots, and secret values must never be sent to public logging functions.

Diagnostics, installation planning, and isolated execution exclude hostnames, usernames, group identifiers, temporary paths, addresses, device names, raw service/package output, environment values, and secrets. They do not contact a network. Isolated execution may mutate and clean only a validated marked test root; every other production library remains non-mutating. Production code must never source test helpers or fixtures, execute a library publicly, use `eval`, or duplicate shared checks.

DP-08 adds no production library API. Its guarded integration harness reuses the existing installation, execution, recovery, path, and locking functions inside disposable Ubuntu containers; synthetic package processing remains test-owned and offline.
