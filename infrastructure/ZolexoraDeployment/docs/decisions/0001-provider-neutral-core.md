# ADR 0001: Provider-neutral core

## Status

Accepted

## Context

Zolexora products must deploy to supported Ubuntu servers supplied by different infrastructure providers without duplicating operational logic or embedding one provider's APIs.

## Decision

Shared deployment behavior lives in a provider-neutral core. Replaceable adapters own service-specific behavior. The provider contract supplies Ubuntu LTS, persistent storage, networking, SSH, and root or passwordless sudo access.

Core cannot call cloud APIs, provider metadata services, GitHub, GitLab, Cloudflare, provider-specific DNS, or provider-specific object storage. Configuration and adapter selection are explicit validated inputs.

## Consequences

EC2, OCI Compute, Azure VM, GCP Compute Engine, or a generic VPS can host the same core. Adapters require separate contracts and tests. Provider conveniences cannot leak into shared scripts.

## Alternatives considered

- Separate deployment implementations per provider: rejected because behavior and safety controls would drift.
- One provider-specific core with conditional branches: rejected because provider replacement would require core changes.
