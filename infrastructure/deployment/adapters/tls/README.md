# TLS adapter contract

TLS adapters own the origin-certificate lifecycle interface: issuance, renewal, validation, and reporting the validated certificate and private-key paths to authorized consumers.

Failure must be explicit and must not replace a valid certificate with incomplete state. Private keys never belong in Git or logs. No issuance or renewal behavior exists in DP-03.
