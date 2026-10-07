# Zolexora Platform Project Tree
```text
/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform
├── backend
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
│   │       │   ├── css
│   │       │   │   ├── login.css
│   │       │   │   ├── zolexora.css
│   │       │   │   ├── zolexora_dark.css
│   │       │   │   └── zolexora-theme.css
│   │       │   ├── images
│   │       │   │   ├── favicon.svg
│   │       │   │   └── logo.svg
│   │       │   ├── img
│   │       │   │   ├── favicon.svg
│   │       │   │   ├── zolexora-icon.svg
│   │       │   │   └── zolexora-logo.svg
│   │       │   └── js
│   │       │       ├── login.js
│   │       │       ├── zolexora.js
│   │       │       └── zolexora-theme.js
│   │       ├── startup.py
│   │       ├── tests
│   │       │   ├── __init__.py
│   │       │   └── test_branding.py
│   │       └── zolexora_branding
│   │           └── __init__.py
│   ├── zolexora_core
│   │   ├── MANIFEST.in
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   └── zolexora_core
│   │       ├── api_endpoints.py
│   │       ├── api.py
│   │       ├── fixtures
│   │       │   └── workspace.json
│   │       ├── hooks.py
│   │       ├── __init__.py
│   │       ├── manifest.json
│   │       ├── modules.txt
│   │       ├── patches.txt
│   │       ├── services
│   │       │   ├── __init__.py
│   │       │   └── logging.py
│   │       ├── site_setup.py
│   │       ├── tests
│   │       │   ├── __init__.py
│   │       │   └── test_api.py
│   │       ├── workspace
│   │       │   ├── ai
│   │       │   │   └── ai.json
│   │       │   ├── analytics
│   │       │   │   └── analytics.json
│   │       │   ├── dashboard
│   │       │   │   └── dashboard.json
│   │       │   ├── fleet
│   │       │   │   └── fleet.json
│   │       │   └── logistics
│   │       │       └── logistics.json
│   │       └── zolexora_core
│   │           └── __init__.py
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
│   │       │   ├── __init__.py
│   │       │   ├── marketplace.py
│   │       │   └── notifications.py
│   │       ├── tests
│   │       │   ├── __init__.py
│   │       │   └── test_integrations.py
│   │       └── zolexora_integrations
│   │           └── __init__.py
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
│           │   ├── ai.py
│           │   ├── fleet.py
│           │   ├── __init__.py
│           │   ├── logistics.py
│           │   └── prediction.py
│           ├── tests
│           │   ├── __init__.py
│           │   └── test_platform.py
│           └── zolexora_platform
│               └── __init__.py
├── branding
├── clients
│   ├── admin
│   │   └── zolexora_admin
│   ├── desktop
│   │   └── zolexora_desktop
│   ├── mobile
│   │   └── zolexora_mobile
│   └── web
│       └── zolexora_web
├── compose.yaml
├── configs
│   ├── cloudflare.md
│   └── northflank.md
├── docs
│   ├── architecture
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
│   ├── compose
│   │   └── nginx.conf
│   ├── docker
│   │   └── Dockerfile
│   ├── environments
│   ├── monitoring
│   └── nginx
├── package.json
├── package-lock.json
├── packages
│   ├── api-contracts
│   ├── api-types
│   ├── design-tokens
│   ├── schemas
│   └── shared-config
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
├── storage
│   ├── backups
│   │   ├── 20260703_030349
│   │   ├── 20260703_030357
│   │   │   ├── 20260703_030358-site1_example_com-database.sql.gz
│   │   │   ├── 20260703_030358-site1_example_com-files.tar
│   │   │   ├── 20260703_030358-site1_example_com-private-files.tar
│   │   │   └── 20260703_030358-site1_example_com-site_config_backup.json
│   │   ├── 20260703_093705
│   │   ├── 20260703_093717
│   │   │   ├── 20260703_093718-site1_example_com-database.sql.gz
│   │   │   ├── 20260703_093718-site1_example_com-files.tar
│   │   │   ├── 20260703_093718-site1_example_com-private-files.tar
│   │   │   ├── 20260703_093718-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260703_183801
│   │   │   ├── 20260703_183802-site1_example_com-database.sql.gz
│   │   │   ├── 20260703_183802-site1_example_com-files.tar
│   │   │   ├── 20260703_183802-site1_example_com-private-files.tar
│   │   │   ├── 20260703_183802-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260703_190355
│   │   │   ├── 20260703_183802-site1_example_com-database.sql.gz
│   │   │   ├── 20260703_183802-site1_example_com-files.tar
│   │   │   ├── 20260703_183802-site1_example_com-private-files.tar
│   │   │   ├── 20260703_183802-site1_example_com-site_config_backup.json
│   │   │   ├── 20260703_190356-site1_example_com-database.sql.gz
│   │   │   ├── 20260703_190356-site1_example_com-files.tar
│   │   │   ├── 20260703_190356-site1_example_com-private-files.tar
│   │   │   ├── 20260703_190356-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260705_185529
│   │   ├── 20260705_185720
│   │   │   ├── 20260705_185721-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_185721-site1_example_com-files.tar
│   │   │   ├── 20260705_185721-site1_example_com-private-files.tar
│   │   │   ├── 20260705_185721-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260705_191340
│   │   │   ├── 20260705_185721-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_185721-site1_example_com-files.tar
│   │   │   ├── 20260705_185721-site1_example_com-private-files.tar
│   │   │   ├── 20260705_185721-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_191340-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_191340-site1_example_com-files.tar
│   │   │   ├── 20260705_191340-site1_example_com-private-files.tar
│   │   │   ├── 20260705_191340-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260705_193521
│   │   │   ├── 20260705_185721-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_185721-site1_example_com-files.tar
│   │   │   ├── 20260705_185721-site1_example_com-private-files.tar
│   │   │   ├── 20260705_185721-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_191340-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_191340-site1_example_com-files.tar
│   │   │   ├── 20260705_191340-site1_example_com-private-files.tar
│   │   │   ├── 20260705_191340-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_193521-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_193521-site1_example_com-files.tar
│   │   │   ├── 20260705_193521-site1_example_com-private-files.tar
│   │   │   ├── 20260705_193521-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260705_195219
│   │   │   ├── 20260705_185721-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_185721-site1_example_com-files.tar
│   │   │   ├── 20260705_185721-site1_example_com-private-files.tar
│   │   │   ├── 20260705_185721-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_191340-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_191340-site1_example_com-files.tar
│   │   │   ├── 20260705_191340-site1_example_com-private-files.tar
│   │   │   ├── 20260705_191340-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_193521-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_193521-site1_example_com-files.tar
│   │   │   ├── 20260705_193521-site1_example_com-private-files.tar
│   │   │   ├── 20260705_193521-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_195219-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_195219-site1_example_com-files.tar
│   │   │   ├── 20260705_195219-site1_example_com-private-files.tar
│   │   │   ├── 20260705_195219-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260705_201010
│   │   │   ├── 20260705_195219-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_195219-site1_example_com-files.tar
│   │   │   ├── 20260705_195219-site1_example_com-private-files.tar
│   │   │   ├── 20260705_195219-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_201011-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_201011-site1_example_com-files.tar
│   │   │   ├── 20260705_201011-site1_example_com-private-files.tar
│   │   │   ├── 20260705_201011-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260705_232216
│   │   │   ├── 20260705_232217-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_232217-site1_example_com-files.tar
│   │   │   ├── 20260705_232217-site1_example_com-private-files.tar
│   │   │   ├── 20260705_232217-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260705_232403
│   │   │   ├── 20260705_232217-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_232217-site1_example_com-files.tar
│   │   │   ├── 20260705_232217-site1_example_com-private-files.tar
│   │   │   ├── 20260705_232217-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_232403-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_232403-site1_example_com-files.tar
│   │   │   ├── 20260705_232403-site1_example_com-private-files.tar
│   │   │   ├── 20260705_232403-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260705_233128
│   │   │   ├── 20260705_232217-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_232217-site1_example_com-files.tar
│   │   │   ├── 20260705_232217-site1_example_com-private-files.tar
│   │   │   ├── 20260705_232217-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_232403-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_232403-site1_example_com-files.tar
│   │   │   ├── 20260705_232403-site1_example_com-private-files.tar
│   │   │   ├── 20260705_232403-site1_example_com-site_config_backup.json
│   │   │   ├── 20260705_233128-site1_example_com-database.sql.gz
│   │   │   ├── 20260705_233128-site1_example_com-files.tar
│   │   │   ├── 20260705_233128-site1_example_com-private-files.tar
│   │   │   ├── 20260705_233128-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260706_045303
│   │   │   ├── 20260706_045303-site1_example_com-database.sql.gz
│   │   │   ├── 20260706_045303-site1_example_com-files.tar
│   │   │   ├── 20260706_045303-site1_example_com-private-files.tar
│   │   │   ├── 20260706_045303-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260706_054142
│   │   │   ├── 20260706_054142-site1_example_com-database.sql.gz
│   │   │   ├── 20260706_054142-site1_example_com-files.tar
│   │   │   ├── 20260706_054142-site1_example_com-private-files.tar
│   │   │   ├── 20260706_054142-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260706_064911
│   │   │   ├── 20260706_064911-site1_example_com-database.sql.gz
│   │   │   ├── 20260706_064911-site1_example_com-files.tar
│   │   │   ├── 20260706_064911-site1_example_com-private-files.tar
│   │   │   ├── 20260706_064911-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260706_070507
│   │   │   ├── 20260706_064911-site1_example_com-database.sql.gz
│   │   │   ├── 20260706_064911-site1_example_com-files.tar
│   │   │   ├── 20260706_064911-site1_example_com-private-files.tar
│   │   │   ├── 20260706_064911-site1_example_com-site_config_backup.json
│   │   │   ├── 20260706_070508-site1_example_com-database.sql.gz
│   │   │   ├── 20260706_070508-site1_example_com-files.tar
│   │   │   ├── 20260706_070508-site1_example_com-private-files.tar
│   │   │   ├── 20260706_070508-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   ├── 20260706_074817
│   │   │   ├── 20260706_074818-site1_example_com-database.sql.gz
│   │   │   ├── 20260706_074818-site1_example_com-files.tar
│   │   │   ├── 20260706_074818-site1_example_com-private-files.tar
│   │   │   ├── 20260706_074818-site1_example_com-site_config_backup.json
│   │   │   └── SHA256SUMS
│   │   └── 20260706_091236
│   │       ├── 20260706_091236-site1_example_com-database.sql.gz
│   │       ├── 20260706_091236-site1_example_com-files.tar
│   │       ├── 20260706_091236-site1_example_com-private-files.tar
│   │       ├── 20260706_091236-site1_example_com-site_config_backup.json
│   │       └── SHA256SUMS
│   ├── exports
│   ├── logs
│   └── temporary
└── tests
    ├── api
    ├── e2e
    ├── integration
    └── smoke

108 directories, 296 files
```
