# Zolexora Platform Directory Tree

```text
.
├── backend
│   ├── erpnext
│   │   ├── attributions.md
│   │   ├── babel_extractors.csv
│   │   ├── banking
│   │   ├── codecov.yml
│   │   ├── CODE_OF_CONDUCT.md
│   │   ├── CODEOWNERS
│   │   ├── commitlint.config.js
│   │   ├── crowdin.yml
│   │   ├── erpnext
│   │   ├── license.txt
│   │   ├── package.json
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── SECURITY.md
│   │   ├── semgrep
│   │   ├── sider.yml
│   │   ├── sponsors.md
│   │   ├── TRADEMARK_POLICY.md
│   │   ├── transaction-deletion-import-logic-summary.md
│   │   └── yarn.lock
│   ├── frappe
│   │   ├── attributions.md
│   │   ├── babel_extractors.csv
│   │   ├── codecov.yml
│   │   ├── CODE_OF_CONDUCT.md
│   │   ├── CODEOWNERS
│   │   ├── commitlint.config.js
│   │   ├── crowdin.yml
│   │   ├── cypress
│   │   ├── esbuild
│   │   ├── frappe
│   │   ├── generate_bootstrap_theme.js
│   │   ├── hooks.md
│   │   ├── jsconfig.json
│   │   ├── LICENSE
│   │   ├── node_utils.js
│   │   ├── package.json
│   │   ├── playwright
│   │   ├── playwright.config.js
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── realtime
│   │   ├── SECURITY.md
│   │   ├── sider.yml
│   │   ├── socketio.js
│   │   ├── ui
│   │   └── yarn.lock
│   ├── payments
│   │   ├── commitlint.config.js
│   │   ├── license.txt
│   │   ├── payments
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── semgrep
│   ├── zolexora_branding
│   │   ├── MANIFEST.in
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── zolexora_branding
│   ├── zolexora_core
│   │   ├── MANIFEST.in
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── zolexora_core
│   ├── zolexora_integrations
│   │   ├── MANIFEST.in
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── zolexora_integrations
│   └── zolexora_platform
│       ├── MANIFEST.in
│       ├── pyproject.toml
│       ├── README.md
│       └── zolexora_platform
├── branding
├── clients
│   ├── admin
│   │   ├── app
│   │   ├── audit
│   │   ├── billing
│   │   ├── entitlements
│   │   ├── integrations
│   │   ├── organizations
│   │   ├── platform
│   │   ├── products
│   │   ├── users
│   │   └── zolexora_admin
│   ├── desktop
│   │   ├── app
│   │   ├── core
│   │   ├── integrations
│   │   ├── shell
│   │   └── zolexora_desktop
│   ├── mobile
│   │   ├── app
│   │   ├── authentication
│   │   ├── core
│   │   ├── integrations
│   │   ├── notifications
│   │   ├── organizations
│   │   └── zolexora_mobile
│   ├── README.md
│   └── web
│       ├── app
│       ├── authentication
│       ├── components
│       ├── entitlements
│       ├── integrations
│       ├── layouts
│       ├── organizations
│       ├── routing
│       ├── themes
│       └── zolexora_web
├── clone_missing_ssh_3.sh
├── clone_missing_ssh.sh
├── clone_products.sh
├── clone_products_ssh.sh
├── compose.yaml
├── configs
│   ├── cloudflare.md
│   └── northflank.md
├── docs
│   ├── architecture
│   │   ├── platform-boundary-review.md
│   │   └── product-source-audit.md
│   ├── decisions
│   ├── deployment
│   ├── development
│   ├── disaster-recovery-report.md -> reports/certifications/disaster-recovery-report.md
│   ├── gitleaks-report.json -> reports/security/gitleaks-report.json
│   ├── guides
│   │   ├── admin-guide.md
│   │   ├── api-guide.md
│   │   ├── architecture.md
│   │   ├── backup.md
│   │   ├── cloudflare.md
│   │   ├── deployment.md
│   │   ├── developer-guide.md
│   │   ├── installation.md
│   │   ├── northflank.md
│   │   ├── production-guide.md
│   │   ├── restore.md
│   │   ├── roadmap.md
│   │   ├── security-guide.md
│   │   ├── testing-guide.md
│   │   └── user-guide.md
│   ├── operations
│   ├── phase-3.8B-payments-clean-site-test-output.txt -> reports/phases/phase-3.8B-payments-clean-site-test-output.txt
│   ├── phase-3.8-production-certification-report.md -> reports/certifications/phase-3.8-production-certification-report.md
│   ├── pip-audit-report.json -> reports/security/pip-audit-report.json
│   ├── production-guide.md -> guides/production-guide.md
│   ├── project-tree.md
│   ├── README.md
│   ├── reports
│   │   ├── certifications
│   │   ├── phases
│   │   └── security
│   ├── security-review.md -> reports/security/security-review.md
│   ├── trivy-backend-image-report.json -> reports/security/trivy-backend-image-report.json
│   ├── trivy-fs-report.json -> reports/security/trivy-fs-report.json
│   └── upgrade-validation-report.md -> reports/certifications/upgrade-validation-report.md
├── infrastructure
│   ├── cloudflare
│   │   ├── dns
│   │   ├── README.md
│   │   ├── routing
│   │   └── security
│   ├── compose
│   │   ├── development
│   │   ├── nginx.conf
│   │   ├── production
│   │   ├── README.md
│   │   └── staging
│   ├── deployment
│   │   ├── platform
│   │   ├── products
│   │   ├── rollback
│   │   └── verification
│   ├── docker
│   │   ├── base
│   │   ├── Dockerfile
│   │   ├── platform
│   │   ├── products
│   │   └── README.md
│   ├── environments
│   │   ├── development
│   │   ├── production
│   │   └── staging
│   ├── monitoring
│   │   ├── alerts
│   │   ├── dashboards
│   │   ├── logs
│   │   └── metrics
│   ├── nginx
│   │   ├── platform
│   │   ├── products
│   │   └── README.md
│   ├── README.md
│   └── ZolexoraDeployment
│       ├── adapters
│       ├── AGENTS.md
│       ├── applications
│       ├── backup.sh
│       ├── core
│       ├── deploy.sh
│       ├── docs
│       ├── doctor.sh
│       ├── firewall
│       ├── healthcheck.sh
│       ├── install.sh
│       ├── nginx
│       ├── README.md
│       ├── restore.sh
│       ├── rollback.sh
│       ├── scripts
│       ├── systemd
│       ├── templates
│       ├── tests
│       ├── verify-backup.sh
│       └── versions.env
├── package.json
├── package-lock.json
├── packages
│   ├── api-contracts
│   │   ├── integrations
│   │   ├── platform
│   │   ├── products
│   │   └── README.md
│   ├── api-types
│   │   ├── platform
│   │   ├── products
│   │   └── README.md
│   ├── auth
│   │   ├── adapters
│   │   ├── contracts
│   │   └── README.md
│   ├── design-tokens
│   │   ├── README.md
│   │   └── tokens
│   ├── entitlements
│   │   ├── contracts
│   │   ├── evaluation
│   │   └── README.md
│   ├── events
│   │   ├── platform
│   │   ├── products
│   │   └── README.md
│   ├── integrations
│   │   ├── contracts
│   │   ├── events
│   │   ├── README.md
│   │   └── webhooks
│   ├── organizations
│   │   ├── contracts
│   │   └── README.md
│   ├── permissions
│   │   ├── policies
│   │   ├── README.md
│   │   └── roles
│   ├── README.md
│   ├── schemas
│   │   ├── platform
│   │   ├── products
│   │   └── README.md
│   └── shared-config
│       ├── development
│       ├── production
│       ├── README.md
│       └── testing
├── platform
│   ├── administration
│   │   ├── organization-admin
│   │   ├── platform-admin
│   │   ├── platform-settings
│   │   ├── product-admin
│   │   ├── README.md
│   │   └── system-settings
│   ├── audit
│   │   ├── activity
│   │   ├── audit-log
│   │   ├── compliance
│   │   ├── README.md
│   │   └── security-events
│   ├── automation
│   │   ├── actions
│   │   ├── conditions
│   │   ├── execution
│   │   ├── README.md
│   │   ├── rules
│   │   ├── schedules
│   │   ├── triggers
│   │   └── workflows
│   ├── billing
│   │   ├── billing-events
│   │   ├── invoices
│   │   ├── payments
│   │   ├── plans
│   │   ├── README.md
│   │   ├── subscriptions
│   │   └── usage
│   ├── domains
│   │   ├── branding
│   │   ├── custom-domains
│   │   ├── README.md
│   │   ├── routing
│   │   └── verification
│   ├── entitlements
│   │   ├── evaluation
│   │   ├── feature-flags
│   │   ├── features
│   │   ├── limits
│   │   ├── plans
│   │   ├── README.md
│   │   └── subscriptions
│   ├── identity
│   │   ├── authentication
│   │   ├── credentials
│   │   ├── identity-providers
│   │   ├── README.md
│   │   ├── sessions
│   │   ├── tenant-context
│   │   └── users
│   ├── integrations
│   │   ├── api-connections
│   │   ├── connectors
│   │   ├── credentials
│   │   ├── product-integrations
│   │   ├── providers
│   │   ├── README.md
│   │   ├── registry
│   │   └── webhooks
│   ├── notifications
│   │   ├── email
│   │   ├── in-app
│   │   ├── preferences
│   │   ├── push
│   │   ├── README.md
│   │   ├── sms
│   │   └── templates
│   ├── organizations
│   │   ├── memberships
│   │   ├── organizations
│   │   ├── README.md
│   │   ├── relationships
│   │   ├── teams
│   │   └── tenant-isolation
│   ├── platform-api
│   │   ├── internal
│   │   ├── middleware
│   │   ├── public
│   │   ├── README.md
│   │   └── versioning
│   ├── product-registry
│   │   ├── availability
│   │   ├── capabilities
│   │   ├── modules
│   │   ├── products
│   │   ├── README.md
│   │   └── versions
│   ├── README.md
│   └── support
│       ├── customer-support
│       ├── incidents
│       ├── README.md
│       ├── system-status
│       └── tickets
├── products
│   ├── ads
│   │   ├── backend
│   │   ├── campaigns
│   │   ├── docs
│   │   ├── frontend
│   │   ├── integrations
│   │   ├── README.md
│   │   └── tests
│   ├── ai
│   │   ├── ARCHITECTURE.md
│   │   ├── backend
│   │   ├── docker-compose.yml
│   │   ├── docker.yaml
│   │   ├── docs
│   │   ├── frontend
│   │   ├── GEMINI.md
│   │   ├── infra
│   │   ├── integrations
│   │   ├── main.py
│   │   ├── models
│   │   ├── README.md
│   │   ├── requirements.txt
│   │   ├── scripts
│   │   ├── services
│   │   ├── sessions
│   │   └── tests
│   ├── analytics
│   │   ├── backend
│   │   ├── docs
│   │   ├── frontend
│   │   ├── integrations
│   │   ├── pipelines
│   │   ├── README.md
│   │   ├── reports
│   │   └── tests
│   ├── clarityfi
│   │   ├── apps
│   │   ├── package.json
│   │   ├── packages
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── scripts
│   │   ├── tsconfig.base.json
│   │   ├── tsconfig.json
│   │   └── vercel.json
│   ├── cloud
│   │   ├── backend
│   │   ├── docs
│   │   ├── frontend
│   │   ├── infrastructure
│   │   ├── integrations
│   │   ├── README.md
│   │   ├── services
│   │   └── tests
│   ├── engage
│   │   ├── artifacts
│   │   ├── backend
│   │   ├── campaigns
│   │   ├── docker
│   │   ├── docker-compose.yml
│   │   ├── docs
│   │   ├── frontend
│   │   ├── integrations
│   │   ├── lib
│   │   ├── package.json
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── render.yaml
│   │   ├── replit.md
│   │   ├── scripts
│   │   ├── skills-lock.json
│   │   ├── supabase
│   │   ├── tests
│   │   ├── tsconfig.base.json
│   │   └── tsconfig.json
│   ├── erp
│   │   ├── backend
│   │   ├── desktop
│   │   ├── docs
│   │   ├── frontend
│   │   ├── infrastructure
│   │   ├── integrations
│   │   ├── mobile
│   │   ├── README.md
│   │   └── tests
│   ├── erp_repo_clone
│   │   ├── apps
│   │   ├── compose
│   │   ├── compose.yaml
│   │   ├── configs
│   │   ├── docker
│   │   ├── docs
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   ├── PROJECT.md
│   │   ├── README.md
│   │   └── scripts
│   ├── ims
│   │   ├── apps
│   │   ├── backend
│   │   ├── backend-shared
│   │   ├── docker-compose.yml
│   │   ├── docs
│   │   ├── frontend
│   │   ├── GEMINI.md
│   │   ├── infra
│   │   ├── integrations
│   │   ├── mobile
│   │   ├── package.json
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── scripts
│   │   ├── setup.sh
│   │   ├── skills-lock.json
│   │   └── tests
│   ├── marketplace
│   │   ├── AGENTS.md
│   │   ├── apps
│   │   ├── backend
│   │   ├── contracts
│   │   ├── docker-compose.yml
│   │   ├── docs
│   │   ├── firebase.json
│   │   ├── frontend
│   │   ├── infrastructure
│   │   ├── integrations
│   │   ├── mobile
│   │   ├── package.json
│   │   ├── packages
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── PROJECT.md
│   │   ├── README.md
│   │   ├── scripts
│   │   ├── SECURITY.md
│   │   ├── services
│   │   ├── skills-lock.json
│   │   ├── tests
│   │   └── turbo.json
│   ├── maunkavach
│   │   ├── app
│   │   ├── backend
│   │   ├── build.gradle.kts
│   │   ├── DEPLOY.md
│   │   ├── docs
│   │   ├── gradle
│   │   ├── gradle.properties
│   │   ├── gradlew
│   │   ├── README.md
│   │   ├── settings.gradle.kts
│   │   └── web
│   ├── README.md
│   ├── rentoeasy
│   │   ├── apps
│   │   ├── docker-compose.yml
│   │   ├── package.json
│   │   ├── packages
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── services
│   │   ├── tsconfig.base.json
│   │   └── turbo.json
│   ├── thetextilecare
│   │   ├── apps
│   │   ├── backend
│   │   ├── docker-compose.yml
│   │   ├── docs
│   │   ├── infrastructure
│   │   ├── package.json
│   │   ├── packages
│   │   ├── platform
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── scripts
│   │   ├── supabase
│   │   ├── tsconfig.base.json
│   │   ├── tsconfig.json
│   │   └── turbo.json
│   └── tms
│       ├── AGENTS.md
│       ├── apps
│       ├── backend
│       ├── Dockerfile
│       ├── docs
│       ├── frontend
│       ├── GEMINI.md -> AGENTS.md
│       ├── infrastructure
│       ├── integrations
│       ├── mcp.json
│       ├── mobile
│       ├── package.json
│       ├── pnpm-lock.yaml
│       ├── pnpm-workspace.yaml
│       ├── README.md
│       ├── scripts
│       ├── skills-lock.json
│       └── tests
├── PROJECT.md
├── README.md
├── scripts
│   ├── backup
│   ├── backup.sh
│   ├── cleanup_workspaces.py
│   ├── configure-common-site.sh
│   ├── daily-backup.sh
│   ├── deployment
│   ├── development
│   ├── disaster-recovery-test.sh
│   ├── healthcheck.sh
│   ├── init-site.sh
│   ├── maintenance
│   ├── payments-clean-site-test.sh
│   ├── restore
│   ├── restore.sh
│   ├── setup
│   ├── status.sh
│   ├── testing
│   ├── upgrade-validation.sh
│   └── yarn-wrapper.sh
├── sites
│   └── apps.txt
├── solutions
│   ├── customer-specific
│   │   └── TheTextileCare
│   ├── integrations
│   └── README.md
└── tests
    ├── api
    │   ├── platform
    │   └── products
    ├── e2e
    │   ├── platform
    │   └── products
    ├── integration
    │   ├── cross-product
    │   ├── platform
    │   └── products
    ├── security
    ├── smoke
    └── unit
        ├── packages
        ├── platform
        └── products

383 directories, 235 files
```

## Directory Classification Legend
*   **[CURRENT IMPLEMENTATION]**: Active application code functioning in its current location.
*   **[ARCHITECTURAL PLACEHOLDER]**: Empty scaffolding created for the future platform boundaries.
*   **[MIGRATION COPY]**: A redundant clone meant only for safety/comparison before deletion.
*   **[LEGACY]**: Existing structures that will be migrated to the new architecture.

## Notable Locations
*   `backend/` - **[LEGACY]** / **[CURRENT IMPLEMENTATION]** (The actual working ERP implementation to be moved to `products/erp/`)
*   `products/erp_repo_clone/` - **[MIGRATION COPY]** (Redundant clone of this exact repo)
*   `products/erp/` - **[ARCHITECTURAL PLACEHOLDER]** (Scaffolding awaiting the backend migration)
*   `products/ads/` & `products/cloud/` - **[ARCHITECTURAL PLACEHOLDER]** (Repositories were empty)
*   `platform/` - **[ARCHITECTURAL PLACEHOLDER]** (Empty boundary directories)
