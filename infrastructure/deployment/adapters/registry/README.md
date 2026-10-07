# Registry adapter contract

The registry boundary covers OCI-compatible authentication and configurable pull/push endpoints. Production references must identify immutable images by digest or commit-derived tag; the mutable `latest` tag is forbidden.

Registry credentials arrive through protected secret references and authentication must never echo them. DP-03 selects no vendor-specific registry and implements no login, push, or pull behavior.
