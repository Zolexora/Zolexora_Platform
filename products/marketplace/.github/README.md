# Zolexora Marketplace - GitHub Configuration

This directory contains the community health files, pull request templates, issue templates, GitHub Actions workflows, and custom actions that define the operational automation and open-source standards for the Zolexora Marketplace repository.

## Structure Overview

- **`workflows/`**: Contains all GitHub Actions workflow files for CI/CD, security scanning, dependency updates, and other automated tasks.
- **`actions/`**: Contains reusable composite GitHub Actions used by the workflows to ensure consistency and reduce duplication.
- **`scripts/`**: Contains helper shell and Python scripts invoked by workflows or actions.
- **`ISSUE_TEMPLATE/`**: Standardized templates for reporting bugs, requesting features, and reporting security vulnerabilities.
- **`PULL_REQUEST_TEMPLATE/`**: Specialized templates for PRs depending on their scope (frontend, backend, infrastructure).
- **`DISCUSSION_TEMPLATE/`**: Templates for GitHub Discussions.
- **Community Health Files**: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SUPPORT.md`, `SECURITY.md`, `CODEOWNERS`, and `FUNDING.yml`.
- **Configuration Files**: `dependabot.yml`, `release.yml`, `stale.yml`, `settings.yml`, `semantic.yml`.
