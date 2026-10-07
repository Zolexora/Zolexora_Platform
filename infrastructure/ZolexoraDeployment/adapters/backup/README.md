# Backup adapter contract

Backup adapters transport encrypted artifacts to and from off-server storage. They own upload, retrieval, transport integrity metadata, and the provider-side retention boundary.

Encryption must occur before an artifact crosses the trusted host boundary. The adapter receives encrypted artifacts and checksums; it does not implement database consistency, application quiescence, or backup creation. Those remain core/application responsibilities.

No backup adapter is implemented before DP-12. Future adapters must follow the common adapter contract and must not expose storage credentials.
