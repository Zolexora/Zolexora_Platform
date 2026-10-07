# Zolexora Platform Directory Tree

```text
.
├── backend
│   ├── erpnext
│   │   ├── attributions.md
│   │   ├── babel_extractors.csv
│   │   ├── banking
│   │   │   ├── eslint.config.js
│   │   │   ├── index.html
│   │   │   ├── package.json
│   │   │   ├── proxyOptions.ts
│   │   │   ├── README.md
│   │   │   ├── src
│   │   │   ├── tsconfig.app.json
│   │   │   ├── tsconfig.json
│   │   │   ├── tsconfig.node.json
│   │   │   ├── vite.config.ts
│   │   │   └── yarn.lock
│   │   ├── codecov.yml
│   │   ├── CODE_OF_CONDUCT.md
│   │   ├── CODEOWNERS
│   │   ├── commitlint.config.js
│   │   ├── crowdin.yml
│   │   ├── erpnext
│   │   │   ├── accounts
│   │   │   ├── assets
│   │   │   ├── bulk_transaction
│   │   │   ├── buying
│   │   │   ├── change_log
│   │   │   ├── commands
│   │   │   ├── communication
│   │   │   ├── config
│   │   │   ├── controllers
│   │   │   ├── crm
│   │   │   ├── deprecation_dumpster.py
│   │   │   ├── desktop_icon
│   │   │   ├── dock
│   │   │   ├── domains
│   │   │   ├── edi
│   │   │   ├── erpnext_integrations
│   │   │   ├── exceptions.py
│   │   │   ├── gettext
│   │   │   ├── hooks.py
│   │   │   ├── __init__.py
│   │   │   ├── locale
│   │   │   ├── maintenance
│   │   │   ├── manufacturing
│   │   │   ├── modules.txt
│   │   │   ├── patches
│   │   │   ├── patches.txt
│   │   │   ├── portal
│   │   │   ├── projects
│   │   │   ├── public
│   │   │   ├── quality_management
│   │   │   ├── regional
│   │   │   ├── report_center
│   │   │   ├── selling
│   │   │   ├── setup
│   │   │   ├── shopping_cart
│   │   │   ├── startup
│   │   │   ├── stock
│   │   │   ├── subcontracting
│   │   │   ├── support
│   │   │   ├── telephony
│   │   │   ├── templates
│   │   │   ├── tests
│   │   │   ├── utilities
│   │   │   ├── workspace_sidebar
│   │   │   └── www
│   │   ├── license.txt
│   │   ├── package.json
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── SECURITY.md
│   │   ├── semgrep
│   │   │   └── test-correctness.yml
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
│   │   │   ├── plugins
│   │   │   ├── support
│   │   │   └── tsconfig.json
│   │   ├── esbuild
│   │   │   ├── build-cleanup.js
│   │   │   ├── esbuild.js
│   │   │   ├── frappe-html.js
│   │   │   ├── frappe-vue-style.js
│   │   │   ├── ignore-assets.js
│   │   │   ├── index.js
│   │   │   ├── sass_options.js
│   │   │   ├── update_icons.js
│   │   │   └── utils.js
│   │   ├── frappe
│   │   │   ├── api
│   │   │   ├── app.py
│   │   │   ├── apps.py
│   │   │   ├── auth.py
│   │   │   ├── automation
│   │   │   ├── automation_engine
│   │   │   ├── boot.py
│   │   │   ├── bundler.py
│   │   │   ├── cache_manager.py
│   │   │   ├── change_log
│   │   │   ├── client.py
│   │   │   ├── commands
│   │   │   ├── concurrency_limiter.py
│   │   │   ├── config.py
│   │   │   ├── contacts
│   │   │   ├── core
│   │   │   ├── coverage.py
│   │   │   ├── custom
│   │   │   ├── data
│   │   │   ├── database
│   │   │   ├── defaults.py
│   │   │   ├── deferred_insert.py
│   │   │   ├── deprecation_dumpster.py
│   │   │   ├── desk
│   │   │   ├── desktop_icon
│   │   │   ├── dock
│   │   │   ├── email
│   │   │   ├── exceptions.py
│   │   │   ├── frappeclient.py
│   │   │   ├── geo
│   │   │   ├── gettext
│   │   │   ├── handler.py
│   │   │   ├── hooks.py
│   │   │   ├── __init__.py
│   │   │   ├── installer.py
│   │   │   ├── integrations
│   │   │   ├── locale
│   │   │   ├── locale.py
│   │   │   ├── middlewares.py
│   │   │   ├── migrate.py
│   │   │   ├── model
│   │   │   ├── modules
│   │   │   ├── modules.txt
│   │   │   ├── monitor.py
│   │   │   ├── oauth.py
│   │   │   ├── onboarding.py
│   │   │   ├── _optimizations.py
│   │   │   ├── parallel_test_runner.py
│   │   │   ├── patches
│   │   │   ├── patches.txt
│   │   │   ├── permissions.py
│   │   │   ├── printing
│   │   │   ├── public
│   │   │   ├── pulse
│   │   │   ├── push_notification.py
│   │   │   ├── query_builder
│   │   │   ├── rate_limiter.py
│   │   │   ├── realtime.py
│   │   │   ├── recorder.py
│   │   │   ├── search
│   │   │   ├── sessions.py
│   │   │   ├── share.py
│   │   │   ├── system
│   │   │   ├── templates
│   │   │   ├── testing
│   │   │   ├── test_module
│   │   │   ├── test_runner.py
│   │   │   ├── tests
│   │   │   ├── translate.py
│   │   │   ├── twofactor.py
│   │   │   ├── types
│   │   │   ├── users
│   │   │   ├── utils
│   │   │   ├── website
│   │   │   ├── workflow
│   │   │   └── www
│   │   ├── generate_bootstrap_theme.js
│   │   ├── hooks.md
│   │   ├── jsconfig.json
│   │   ├── LICENSE
│   │   ├── node_utils.js
│   │   ├── package.json
│   │   ├── playwright
│   │   │   ├── fixtures
│   │   │   ├── support
│   │   │   └── tests
│   │   ├── playwright.config.js
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── realtime
│   │   │   ├── handlers.js
│   │   │   ├── index.js
│   │   │   ├── middlewares
│   │   │   └── utils.js
│   │   ├── SECURITY.md
│   │   ├── sider.yml
│   │   ├── socketio.js
│   │   ├── ui
│   │   │   ├── CLAUDE.md
│   │   │   ├── components.d.ts
│   │   │   ├── CONTEXT.md
│   │   │   ├── docs
│   │   │   ├── package.json
│   │   │   ├── PHILOSOPHY.md
│   │   │   ├── README.md
│   │   │   ├── src
│   │   │   ├── vite
│   │   │   └── yarn.lock
│   │   └── yarn.lock
│   ├── payments
│   │   ├── commitlint.config.js
│   │   ├── license.txt
│   │   ├── payments
│   │   │   ├── config
│   │   │   ├── hooks.py
│   │   │   ├── __init__.py
│   │   │   ├── modules.txt
│   │   │   ├── overrides
│   │   │   ├── patches.txt
│   │   │   ├── payment_gateways
│   │   │   ├── payments
│   │   │   ├── public
│   │   │   ├── templates
│   │   │   ├── tests
│   │   │   └── utils
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── semgrep
│   │       └── test-correctness.yml
│   ├── zolexora_branding
│   │   ├── MANIFEST.in
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── zolexora_branding
│   │       ├── hooks.py
│   │       ├── __init__.py
│   │       ├── manifest.json
│   │       ├── modules.txt
│   │       ├── patches.txt
│   │       ├── public
│   │       ├── startup.py
│   │       ├── tests
│   │       └── zolexora_branding
│   ├── zolexora_core
│   │   ├── MANIFEST.in
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── zolexora_core
│   │       ├── api_endpoints.py
│   │       ├── api.py
│   │       ├── fixtures
│   │       ├── hooks.py
│   │       ├── __init__.py
│   │       ├── manifest.json
│   │       ├── modules.txt
│   │       ├── patches.txt
│   │       ├── services
│   │       ├── site_setup.py
│   │       ├── tests
│   │       ├── workspace
│   │       └── zolexora_core
│   ├── zolexora_integrations
│   │   ├── MANIFEST.in
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── zolexora_integrations
│   │       ├── hooks.py
│   │       ├── __init__.py
│   │       ├── manifest.json
│   │       ├── modules.txt
│   │       ├── patches.txt
│   │       ├── services
│   │       ├── tests
│   │       └── zolexora_integrations
│   └── zolexora_platform
│       ├── MANIFEST.in
│       ├── pyproject.toml
│       ├── README.md
│       └── zolexora_platform
│           ├── api_endpoints.py
│           ├── hooks.py
│           ├── __init__.py
│           ├── manifest.json
│           ├── modules.txt
│           ├── patches.txt
│           ├── services
│           ├── tests
│           └── zolexora_platform
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
│   │   └── platform-boundary-review.md
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
│   │   │   ├── backup-report.md
│   │   │   ├── bootstrap-certification-report.md
│   │   │   ├── disaster-recovery-report.md
│   │   │   ├── final-production-readiness-report.md
│   │   │   ├── operational-certification-report.md
│   │   │   ├── phase-3.8-production-certification-report.md
│   │   │   ├── rc1-validation-report.md
│   │   │   └── upgrade-validation-report.md
│   │   ├── phases
│   │   │   ├── phase-3.8B-payments-clean-site-test-output.txt
│   │   │   ├── phase-3.8B-payments-investigation-report.md
│   │   │   ├── phase-3.8B-remediation-report.md
│   │   │   ├── phase-3.8C-remediation-report.md
│   │   │   ├── phase-3.8D-remediation-report.md
│   │   │   ├── phase-3.8E-remediation-report.md
│   │   │   ├── phase-3.8F-remediation-report.md
│   │   │   ├── phase-3.8G-remediation-report.md
│   │   │   ├── phase-3.8G-risk-closure-report.md
│   │   │   ├── phase-3.8H-verification-remediation-report.md
│   │   │   ├── phase-3.8H-verification-report.md
│   │   │   ├── phase-3.8I-final-external-proof-report.md
│   │   │   ├── phase-3.8J-payments-ci-proof-report.md
│   │   │   ├── phase-3.8J-remediation-report.md
│   │   │   ├── phase-3.8-remediation-report.md
│   │   │   ├── phase-3.8-summary-report.md
│   │   │   ├── phase-3.9A-custom-dark-theme-report.md
│   │   │   ├── phase-3.9B-branding-report.md
│   │   │   ├── phase-3.9C-remediation-report.md
│   │   │   └── phase-3.9C-workspace-fixtures-report.md
│   │   └── security
│   │       ├── gitleaks-report.json
│   │       ├── pip-audit-report.json
│   │       ├── security-review.md
│   │       ├── trivy-backend-image-report.json
│   │       └── trivy-fs-report.json
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
│       │   ├── backup
│       │   ├── dns
│       │   ├── infrastructure
│       │   ├── README.md
│       │   ├── registry
│       │   ├── tls
│       │   └── transport
│       ├── AGENTS.md
│       ├── applications
│       │   ├── marketplace
│       │   └── README.md
│       ├── backup.sh
│       ├── core
│       │   ├── install
│       │   ├── lib
│       │   └── README.md
│       ├── deploy.sh
│       ├── docs
│       │   ├── architecture.md
│       │   ├── backup-and-restore.md
│       │   ├── decisions
│       │   ├── disaster-recovery.md
│       │   ├── environments.md
│       │   ├── migration-runbook.md
│       │   ├── runbooks
│       │   └── security.md
│       ├── doctor.sh
│       ├── firewall
│       │   └── README.md
│       ├── healthcheck.sh
│       ├── install.sh
│       ├── nginx
│       │   └── README.md
│       ├── README.md
│       ├── restore.sh
│       ├── rollback.sh
│       ├── scripts
│       │   └── setup-cli-ecosystem.sh
│       ├── systemd
│       │   └── README.md
│       ├── templates
│       │   └── README.md
│       ├── tests
│       │   ├── contract
│       │   ├── fixtures
│       │   ├── integration
│       │   ├── lib
│       │   ├── README.md
│       │   ├── run.sh
│       │   └── unit
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
│   │   │   ├── agents
│   │   │   ├── api
│   │   │   ├── celery_app.py
│   │   │   ├── core
│   │   │   ├── __init__.py
│   │   │   ├── job_queue
│   │   │   ├── memory
│   │   │   ├── models
│   │   │   ├── orchestrator
│   │   │   ├── project_changes
│   │   │   ├── project_context
│   │   │   ├── project_files
│   │   │   ├── project_history
│   │   │   ├── prompts
│   │   │   ├── pytest.ini
│   │   │   ├── requirements.txt
│   │   │   ├── tests
│   │   │   └── tools
│   │   ├── docker-compose.yml
│   │   ├── docker.yaml
│   │   ├── docs
│   │   │   └── FEATURE_CHECKLIST.md
│   │   ├── frontend
│   │   │   ├── Dockerfile
│   │   │   ├── e2e
│   │   │   ├── index.html
│   │   │   ├── nginx
│   │   │   ├── package.json
│   │   │   ├── package-lock.json
│   │   │   ├── postcss.config.js
│   │   │   ├── public
│   │   │   ├── src
│   │   │   ├── tailwind.config.ts
│   │   │   ├── tsconfig.json
│   │   │   ├── tsconfig.node.json
│   │   │   └── vite.config.ts
│   │   ├── GEMINI.md
│   │   ├── infra
│   │   │   ├── azure
│   │   │   ├── docker-compose.yml
│   │   │   ├── Dockerfile
│   │   │   └── nginx.conf
│   │   ├── integrations
│   │   ├── main.py
│   │   ├── models
│   │   ├── README.md
│   │   ├── requirements.txt
│   │   ├── scripts
│   │   │   ├── deploy.sh
│   │   │   ├── seed_memory.sh
│   │   │   └── setup_azure.sh
│   │   ├── services
│   │   ├── sessions
│   │   └── tests
│   │       ├── __init__.py
│   │       └── test_smoke.py
│   ├── analytics
│   │   ├── backend
│   │   ├── docs
│   │   ├── frontend
│   │   ├── integrations
│   │   ├── pipelines
│   │   ├── README.md
│   │   ├── reports
│   │   └── tests
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
│   │   │   ├── admin
│   │   │   ├── api-server
│   │   │   └── client
│   │   ├── backend
│   │   ├── campaigns
│   │   ├── docker
│   │   │   ├── api.Dockerfile
│   │   │   ├── frontend.Dockerfile
│   │   │   └── nginx-spa.conf
│   │   ├── docker-compose.yml
│   │   ├── docs
│   │   ├── frontend
│   │   ├── integrations
│   │   ├── lib
│   │   │   ├── api-client-react
│   │   │   ├── api-spec
│   │   │   ├── api-zod
│   │   │   └── db
│   │   ├── package.json
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── render.yaml
│   │   ├── replit.md
│   │   ├── scripts
│   │   │   ├── PostMerge.sh
│   │   │   ├── RunProject.sh
│   │   │   └── RunWebDev.sh
│   │   ├── skills-lock.json
│   │   ├── supabase
│   │   │   └── config.toml
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
│   │   │   ├── erpnext
│   │   │   ├── frappe
│   │   │   ├── payments
│   │   │   ├── zolexora_branding
│   │   │   ├── zolexora_core
│   │   │   ├── zolexora_integrations
│   │   │   └── zolexora_platform
│   │   ├── backups
│   │   │   └── 20260703_030357
│   │   ├── compose
│   │   │   └── nginx.conf
│   │   ├── compose.yaml
│   │   ├── configs
│   │   │   ├── cloudflare.md
│   │   │   └── northflank.md
│   │   ├── docker
│   │   │   └── Dockerfile
│   │   ├── docs
│   │   │   ├── disaster-recovery-report.md -> reports/certifications/disaster-recovery-report.md
│   │   │   ├── gitleaks-report.json -> reports/security/gitleaks-report.json
│   │   │   ├── guides
│   │   │   ├── phase-3.8B-payments-clean-site-test-output.txt -> reports/phases/phase-3.8B-payments-clean-site-test-output.txt
│   │   │   ├── phase-3.8-production-certification-report.md -> reports/certifications/phase-3.8-production-certification-report.md
│   │   │   ├── pip-audit-report.json -> reports/security/pip-audit-report.json
│   │   │   ├── production-guide.md -> guides/production-guide.md
│   │   │   ├── README.md
│   │   │   ├── reports
│   │   │   ├── security-review.md -> reports/security/security-review.md
│   │   │   ├── trivy-backend-image-report.json -> reports/security/trivy-backend-image-report.json
│   │   │   ├── trivy-fs-report.json -> reports/security/trivy-fs-report.json
│   │   │   └── upgrade-validation-report.md -> reports/certifications/upgrade-validation-report.md
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   ├── PROJECT.md
│   │   ├── README.md
│   │   └── scripts
│   │       ├── backup.sh
│   │       ├── configure-common-site.sh
│   │       ├── daily-backup.sh
│   │       ├── disaster-recovery-test.sh
│   │       ├── healthcheck.sh
│   │       ├── init-site.sh
│   │       ├── payments-clean-site-test.sh
│   │       ├── restore.sh
│   │       ├── status.sh
│   │       ├── upgrade-validation.sh
│   │       └── yarn-wrapper.sh
│   ├── ims
│   │   ├── apps
│   │   │   ├── ims-admin
│   │   │   └── ims-user
│   │   ├── backend
│   │   ├── backend-shared
│   │   │   ├── __init__.py
│   │   │   ├── logging.py
│   │   │   ├── security.py
│   │   │   └── utils.py
│   │   ├── docker-compose.yml
│   │   ├── docs
│   │   │   ├── GITHUB_AND_SECURITY_AUDIT_REPORT.md
│   │   │   ├── INFILTRATION_AND_TAKEDOWN_THREAT_MODEL.md
│   │   │   ├── phase0-decision.md
│   │   │   └── REMEDIATION_PROMPT.md
│   │   ├── frontend
│   │   ├── GEMINI.md
│   │   ├── infra
│   │   │   ├── cloudflare-pages
│   │   │   ├── fly
│   │   │   ├── koyeb
│   │   │   └── render
│   │   ├── integrations
│   │   ├── mobile
│   │   ├── package.json
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── scripts
│   │   │   ├── db-ops.sh
│   │   │   ├── deploy-frontends-cloudflare.sh
│   │   │   ├── deploy-oracle-vps.sh
│   │   │   ├── deploy.sh
│   │   │   ├── docker-ops.sh
│   │   │   ├── health-check.sh
│   │   │   ├── mcp_payments_server.py
│   │   │   ├── menu.sh
│   │   │   ├── setup.sh
│   │   │   ├── sync-env.sh
│   │   │   └── test-all.sh
│   │   ├── setup.sh
│   │   ├── skills-lock.json
│   │   └── tests
│   ├── marketplace
│   │   ├── AGENTS.md
│   │   ├── apps
│   │   │   ├── portals
│   │   │   └── storefronts
│   │   ├── backend
│   │   ├── contracts
│   │   │   ├── marketplace
│   │   │   └── zolexora-erp
│   │   ├── docker-compose.yml
│   │   ├── docs
│   │   │   ├── Api_Test_Report
│   │   │   ├── architecture.md
│   │   │   ├── auth-token-storage-risk.md
│   │   │   ├── business-modules.md
│   │   │   ├── database-contracts.md
│   │   │   ├── data-model.md
│   │   │   ├── data-ownership.md
│   │   │   ├── data-platform-transition.md
│   │   │   ├── decisions
│   │   │   ├── design.md
│   │   │   ├── directory-plan
│   │   │   ├── domains-and-routing.md
│   │   │   ├── erp-integration.md
│   │   │   ├── erp-reconciliation.md
│   │   │   ├── legacy-data-import-postgresql.md
│   │   │   ├── mahila-legacy-inventory.md
│   │   │   ├── marketplace-repository-roadmap.md
│   │   │   ├── memory.md
│   │   │   ├── oracle-infrastructure.md
│   │   │   ├── oracle-persistence.md
│   │   │   ├── payment-architecture.md
│   │   │   ├── phases.md
│   │   │   ├── prd.md
│   │   │   ├── prompt_draft.md
│   │   │   ├── README.md
│   │   │   ├── runbooks
│   │   │   ├── status
│   │   │   └── teamwork-prompt.md
│   │   ├── firebase.json
│   │   ├── frontend
│   │   ├── infrastructure
│   │   │   ├── docker
│   │   │   ├── nginx
│   │   │   └── README.md
│   │   ├── integrations
│   │   ├── mobile
│   │   ├── package.json
│   │   ├── packages
│   │   │   ├── shared-api
│   │   │   └── shared-config
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── PROJECT.md
│   │   ├── README.md
│   │   ├── scripts
│   │   │   ├── check-openapi-drift.sh
│   │   │   ├── generate_openapi.py
│   │   │   ├── py-exec.mjs
│   │   │   ├── tests
│   │   │   ├── validate-doc-links.py
│   │   │   ├── validate-erp-contracts.py
│   │   │   ├── validate-postgresql-schema.py
│   │   │   └── verify-workspace.mjs
│   │   ├── SECURITY.md
│   │   ├── services
│   │   │   └── marketplace-api
│   │   ├── skills-lock.json
│   │   ├── tests
│   │   └── turbo.json
│   ├── maunkavach
│   │   ├── app
│   │   │   ├── build.gradle.kts
│   │   │   ├── proguard-rules.pro
│   │   │   └── src
│   │   ├── backend
│   │   │   ├── auth.js
│   │   │   ├── db.js
│   │   │   ├── package.json
│   │   │   ├── package-lock.json
│   │   │   ├── render.yaml
│   │   │   ├── server.js
│   │   │   ├── sql
│   │   │   ├── storage.js
│   │   │   └── test
│   │   ├── build.gradle.kts
│   │   ├── DEPLOY.md
│   │   ├── docs
│   │   │   └── reports
│   │   ├── gradle
│   │   │   └── wrapper
│   │   ├── gradle.properties
│   │   ├── gradlew
│   │   ├── README.md
│   │   ├── settings.gradle.kts
│   │   └── web
│   │       ├── components.json
│   │       ├── index.html
│   │       ├── package.json
│   │       ├── package-lock.json
│   │       ├── public
│   │       ├── src
│   │       ├── tsconfig.json
│   │       ├── vercel.json
│   │       └── vite.config.ts
│   ├── README.md
│   ├── rentoeasy
│   │   ├── apps
│   │   │   ├── web-admin
│   │   │   ├── web-owner
│   │   │   └── web-tenant
│   │   ├── docker-compose.yml
│   │   ├── package.json
│   │   ├── packages
│   │   │   ├── shared-types
│   │   │   └── shared-utils
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── services
│   │   │   └── api
│   │   ├── tsconfig.base.json
│   │   └── turbo.json
│   ├── thetextilecare
│   │   ├── apps
│   │   │   ├── admin-web
│   │   │   ├── driver-mobile
│   │   │   ├── marketplace-mobile
│   │   │   ├── marketplace-web
│   │   │   ├── seller-mobile
│   │   │   └── seller-web
│   │   ├── backend
│   │   │   ├── alembic.ini
│   │   │   ├── app
│   │   │   ├── Dockerfile
│   │   │   ├── fix_status.py
│   │   │   ├── migrations
│   │   │   ├── pyproject.toml
│   │   │   ├── README.md
│   │   │   ├── seed.py
│   │   │   └── tests
│   │   ├── docker-compose.yml
│   │   ├── docs
│   │   │   ├── app-factory
│   │   │   ├── architecture
│   │   │   ├── customization
│   │   │   ├── database
│   │   │   ├── decisions
│   │   │   ├── deployment
│   │   │   ├── phase7
│   │   │   ├── project-status
│   │   │   ├── README.md
│   │   │   ├── security
│   │   │   └── white-label
│   │   ├── infrastructure
│   │   │   ├── cloudflare
│   │   │   ├── database
│   │   │   ├── docker
│   │   │   ├── monitoring
│   │   │   ├── README.md
│   │   │   └── terraform
│   │   ├── package.json
│   │   ├── packages
│   │   │   ├── api-client
│   │   │   ├── auth
│   │   │   ├── branding
│   │   │   ├── config
│   │   │   ├── tenant
│   │   │   ├── types
│   │   │   └── ui
│   │   ├── platform
│   │   │   ├── app-factory
│   │   │   ├── customization
│   │   │   ├── README.md
│   │   │   └── white-label
│   │   ├── pnpm-lock.yaml
│   │   ├── pnpm-workspace.yaml
│   │   ├── README.md
│   │   ├── scripts
│   │   │   ├── docker-start.sh
│   │   │   └── start.sh
│   │   ├── supabase
│   │   │   └── config.toml
│   │   ├── tsconfig.base.json
│   │   ├── tsconfig.json
│   │   └── turbo.json
│   └── tms
│       ├── AGENTS.md
│       ├── apps
│       │   ├── backend
│       │   └── frontend
│       ├── backend
│       ├── Dockerfile
│       ├── docs
│       │   ├── architecture
│       │   ├── authentication
│       │   ├── customizations
│       │   ├── database
│       │   └── ecosystem_and_tooling
│       ├── frontend
│       ├── GEMINI.md -> AGENTS.md
│       ├── infrastructure
│       │   ├── docker-compose.yml
│       │   ├── nginx
│       │   └── supabase
│       ├── integrations
│       ├── mcp.json
│       ├── mobile
│       ├── package.json
│       ├── pnpm-lock.yaml
│       ├── pnpm-workspace.yaml
│       ├── README.md
│       ├── scripts
│       │   ├── docker-start.sh
│       │   ├── hooks
│       │   ├── local-start.sh
│       │   └── setup-cli-ecosystem.sh
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

618 directories, 519 files
```
