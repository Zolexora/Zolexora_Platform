# GitHub Actions adapter boundary

`.github/workflows/` is the canonical location for GitHub Actions workflows. No workflow exists yet; DP-12 will implement this selected CI/CD adapter.

Future production workflows must use protected GitHub Environments, minimal permissions, concurrency control, immutable image references, verified SSH host keys, deployment health gates, and rollback behavior. GitHub Actions is an adapter and must not become a dependency of provider-neutral core logic.
