# Deployment transport contract

A transport delivers an authorized immutable release request to the production server. It owns transport authentication, host identity verification, bounded delivery, and clear failure reporting.

Transport does not select releases, run migrations, evaluate application health, or make deployment decisions. Those responsibilities remain in provider-neutral deployment orchestration.
