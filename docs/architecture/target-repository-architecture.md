# Target Repository Architecture

**Date:** 2026-10-08
**Project:** Zolexora_Platform
**Scope:** Stage A Architecture Audit

## Core Principle
The repository must be **shallow, practical, and code-driven**. We will only maintain directories that contain actual implementations. Speculative architectural shells are banned.

## Target Tree Structure

```text
Zolexora_Platform/
├── infrastructure/               # Shared operational/deployment tooling
│   ├── compose/                  # Global docker-compose files
│   ├── docker/                   # Global Dockerfiles
│   └── ZolexoraDeployment/       # Bash-based deployment and disaster recovery system
│
├── products/                     # First-class applications and products
│   ├── ai/                       # AI product implementation (FastAPI)
│   ├── clarityfi/                # ClarityFi product implementation
│   ├── engage/                   # Engage product implementation
│   ├── erp/                      # Canonical ERP system (Frappe monolith boundary)
│   │   └── backend/              # Core ERP apps (frappe, erpnext, payments, etc.)
│   ├── ims/                      # Inventory Management System (React + Python/Workers)
│   ├── marketplace/              # Marketplace platform (React/Storefronts)
│   ├── maunkavach/               # MaunKavach product (Next.js)
│   ├── rentoeasy/                # RentoEasy product (Next.js)
│   ├── thetextilecare/           # TheTextileCare business system (React/FastAPI)
│   └── tms/                      # Transport Management System (React/FastAPI)
│
├── scripts/                      # Independent utility and maintenance scripts
│   ├── backup.sh
│   ├── cleanup_workspaces.py
│   ├── restore.sh
│   └── ...
│
└── docs/                         # Platform documentation and architecture records
    ├── architecture/
    └── project-tree.md
```

## Abolished Concepts
- **`platform/`**: Eliminated until genuine shared platform services are extracted.
- **`packages/`**: Eliminated until shared libraries spanning *multiple* products are required. (Local packages stay in their product directories).
- **`clients/`**: Eliminated. Client applications belong inside their respective `products/` boundary.
- **`solutions/`**: Eliminated. "Customer-specific" is an anti-pattern unless backed by actual code, in which case they are just products or configurations within products.
- **`tests/` (root)**: Eliminated. Tests must reside alongside the code they test within the product boundary (e.g., `products/TheTextileCare/backend/tests/`).
