# Firewall ownership

The future host firewall uses a default-deny inbound policy with explicit SSH, HTTP, and HTTPS rules. SSH sources should be restricted where the selected environment supports it. PostgreSQL and Redis must never be publicly exposed.

Provider and host firewalls are separate defense layers. Future host configuration must be idempotent. Implementation belongs to DP-06; DP-03 adds no UFW or other firewall commands.
