---
name: render
description: Comprehensive Render cloud platform skill covering web services, background workers, private services, static sites, Postgres databases, Key Value, Cron Jobs, Docker containers, Blueprints (render.yaml), environment variables, Render CLI, and Render MCP server. Use for any Render deployment, configuration, debugging, or infrastructure management task.
---

# Render Platform Guide

This skill provides a comprehensive guide and index for operating, deploying, debugging, and managing resources on **Render** (render.com).

## 🚀 Key Render Capabilities & Specialized Sub-Skills

Render capabilities in this workspace are organized into specialized skills located in `.agents/skills/`:

| Capability | Skill Path | Description |
| :--- | :--- | :--- |
| **CLI Operations** | `render-cli` | Using the `render` CLI for deploys, logs, ssh, psql, blueprint validation, and automation |
| **MCP Integration** | `render-mcp` | Operating the official Render Model Context Protocol server (`https://mcp.render.com/mcp`) |
| **Deployment & Blueprints** | `render-deploy` | Codebase analysis, generating `render.yaml` Blueprints, and initiating deploys |
| **Infrastructure-as-Code** | `render-blueprints` | Authoring, validating, and parameterizing `render.yaml` files and preview environments |
| **Web Services** | `render-web-services` | Deploying HTTP APIs (FastAPI, Express, Django, Go, etc.) with custom domains & health checks |
| **Docker Containers** | `render-docker` | Multi-stage Dockerfiles, prebuilt container images, container registries, and optimizations |
| **PostgreSQL Database** | `render-postgres` | Managed Postgres provisioning, connection strings, backups, performance tuning, and psql |
| **Redis / Key Value** | `render-keyvalue` | Managed Redis-compatible Key Value datastore setup, connection patterns, and cache tuning |
| **Background Workers** | `render-background-workers` | Async task queues, Celery, BullMQ, Sidekiq, and graceful shutdown handling |
| **Cron Jobs** | `render-cron-jobs` | Scheduled jobs, cron syntax, batch processing, and migration from legacy schedulers |
| **Private Services** | `render-private-services` | Internal microservices, VPC communication, and non-public endpoints |
| **Environment Variables** | `render-env-vars` | Secret management, env groups, sync groups, and platform environment variables |
| **Scaling & Sizing** | `render-scaling` | Vertical instance sizing, horizontal autoscaling rules (CPU, memory), and concurrency |
| **Persistent Disks** | `render-disks` | Block storage volumes for stateful applications and databases |
| **Monitoring & Metrics** | `render-monitor` | CPU, RAM, bandwidth metrics, HTTP request throughput, and latency profiling |
| **Diagnostics & Debugging** | `render-debug` | Tailing real-time logs, diagnosing build and runtime crashes, and resolving deploy failures |
| **Custom Domains & DNS** | `render-domains` | Apex domains, subdomains, TLS certificates, Cloudflare proxy integration, and DNS records |
| **Private Networking** | `render-networking` | Service discovery, internal DNS (`service-name:port`), and zero-trust VPC patterns |
| **Workflows** | `render-workflows` | Multi-step deployment workflows and CI/CD pipelines |
| **Static Sites** | `render-static-sites` | JAMstack, React, Vite, Vue, static asset hosting with edge redirects and routing |
| **Heroku Migration** | `render-migrate-from-heroku` | Porting Procfiles, Heroku add-ons, and configs directly to Render |

---

## 🛠️ CLI Quick Reference

The Render CLI binary is installed at `/usr/local/bin/render` and `~/.local/bin/render`.

```bash
# Check version
render --version

# Log in interactively
render login

# Authenticate non-interactively in CI/CD or automation
export RENDER_API_KEY="rnd_xxxxxxxxxxxx"

# List resources
render services
render services --output json
render workspaces

# Deploy a service
render deploys create <SERVICE_ID> --confirm

# Tail service logs
render logs <SERVICE_ID> --tail

# Connect to database via psql
render psql <DATABASE_ID>

# SSH into service container
render ssh <SERVICE_ID>

# Validate render.yaml blueprint
render blueprints validate render.yaml
```

---

## 🤖 Model Context Protocol (MCP) Configuration

Render provides an official hosted MCP server accessible via HTTP/SSE:

- **Endpoint**: `https://mcp.render.com/mcp`
- **Authentication**: `Authorization: Bearer <RENDER_API_KEY>`
- **Tools Supported**:
  - `list_workspaces`, `select_workspace`, `get_selected_workspace`
  - `list_services`, `get_service`, `create_service`, `update_service`, `restart_service`
  - `list_deploys`, `get_deploy`, `trigger_deploy`, `cancel_deploy`
  - `list_postgres_instances`, `get_postgres_instance`, `create_postgres_instance`
  - `list_keyvalue_instances`, `get_keyvalue_instance`, `create_keyvalue_instance`
  - `get_service_logs`, `get_service_metrics`

Configurations are registered locally in `.gemini/mcp_config.json`, `.gemini/config/mcp_config.json`, `.vscode/mcp.json`, and `.cursor/mcp.json`.

---

## 📄 Standard Blueprint Pattern (`render.yaml`)

For a Python + FastAPI backend behind Cloudflare proxy:

```yaml
services:
  - type: web
    name: zolexora-backend-api
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    plan: standard
    region: oregon # or frankfurt, ohio, singapore
    healthCheckPath: /api/v1/health
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: PORT
        value: 8000
      - key: CLOUDFLARE_D1_TOKEN
        sync: false
      - key: ENVIRONMENT
        value: production
```
