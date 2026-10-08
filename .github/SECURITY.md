# Security Policy

## Supported Versions

Zolexora Marketplace platform components currently receiving security updates:

| Component | Supported Version | Status |
| --------- | ----------------- | ------ |
| `services/marketplace-api` (FastAPI) | `v1.x` | :white_check_mark: |
| `apps/storefronts/*` | `v1.x` | :white_check_mark: |
| `apps/portals/*` | `v1.x` | :white_check_mark: |
| Transitional Express Backend | N/A | :warning: Transitional |

## Reporting a Vulnerability

We take the security of Zolexora Marketplace very seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Do NOT report security vulnerabilities through public GitHub issues.**

### Reporting Process

1. Email your findings to **security@zolexora.com**.
2. Include details about:
   - Affected service, storefront, or portal
   - Impact assessment
   - Detailed steps or proof-of-concept to reproduce the vulnerability
3. You will receive an acknowledgment within 48 hours.
4. We ask that you keep any reports confidential until we have resolved the issue.

## Security Practices & Architecture

- **Storefront Context & Payment Routing:** Storefront identity is resolved securely server-side from registered origin headers. Payment routing decisions are strictly server-enforced and credentials reside in OCI Secret Management.
- **Data Protection:** Database persistence uses secure connections to Oracle Cloud Infrastructure (OCI). Sensitive data is encrypted at rest and in transit.
