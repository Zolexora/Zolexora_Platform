# Adapter contract

An adapter is a replaceable implementation outside provider-neutral core that translates a selected external service into a documented interface.

Every adapter must document its responsibility, supported interface, required non-secret configuration, secret references, inputs, outputs, exit or return behavior, idempotency expectations, network access, required external commands, failure behavior, redaction behavior, test strategy, provider coupling, owner, and implementation phase.

Adapters must not silently fall back to another provider, print credentials, or read arbitrary environment variables. Inputs use documented names or files, and credentials are referenced rather than embedded. Missing adapters fail clearly. Core contains no provider-specific conditional branches.

Local contract tests are deterministic and cannot contact external services. Live adapter tests require explicit authorization and are not normal local validation.
