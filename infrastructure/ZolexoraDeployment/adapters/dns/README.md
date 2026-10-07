# DNS adapter contract

DNS adapters reconcile explicitly authorized desired record state with a selected provider. Inputs must identify the zone, record, type, desired value, proxy intent where supported, and authorization context.

Reconciliation must be safe and idempotent. It must not implicitly delete records or infer destructive changes from missing input. Provider-neutral core cannot depend on a DNS provider or call its API directly.
