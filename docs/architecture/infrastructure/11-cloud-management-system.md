# 11 Cloud Management System (CMS) & Multi-Cloud Sharding Strategy

This document outlines the architecture for the **Cloud Management System (CMS)** built into the Zolexora Platform Admin Panel. This system orchestrates deployment and resource utilization across **39 independent free-tier cloud accounts (13 Cloudflare, 13 AWS, 13 Azure)** to achieve massive scale and redundancy at zero cost.

---

## 1. The 39-Account Sharding Strategy

To bypass individual provider limits, we distribute our backend services, frontends, and serverless functions across 39 distinct accounts.

### 13 AWS Accounts (Compute & Serverless)
AWS offers generous free tiers, including 1 Million Lambda requests per month and 750 hours of EC2 `t2.micro` or `t3.micro` per month (for 12 months).
- **Usage:** Serverless backend functions, background task runners, and Docker containers running on free EC2 nodes.
- **Scale:** 13 accounts = 13 Million Lambda executions/month, 13 EC2 instances running 24/7.
- **Routing:** API Gateway in each AWS account receives traffic routed from our Cloudflare edge.

### 13 Azure Accounts (App Services & Static Web Apps)
Azure provides a permanent free tier for App Services (F1) and Azure Static Web Apps, plus 1 Million Azure Function executions per month.
- **Usage:** Next.js Frontends hosted on Azure Static Web Apps; persistent lightweight APIs hosted on Azure App Service (F1).
- **Scale:** 13 App Services running concurrently, 13 static sites globally distributed.

### 13 Cloudflare Accounts (Edge & DNS)
As detailed in the API Security strategy, these accounts handle DNS routing, WAF, JWT validation, and rate limiting (1.3 Million requests/day).

---

## 2. Cloud Management System (CMS) Architecture

Because managing 39 accounts manually is impossible, the **Platform Admin Panel** will feature a custom **Cloud Management System (CMS)**. 

### Core CMS Capabilities
The CMS acts as the single pane of glass and control plane for all 39 accounts.

1. **Global Account Registry:**
   - Stores API keys, IAM credentials, and Subscription IDs for all 39 accounts securely in Infisical.
   - Maps which Zolexora products (e.g., TMS, ERP, HRMS) are currently deployed to which specific AWS/Azure account.

2. **Automated Resource Provisioning (Terraform / Pulumi API):**
   - The CMS uses infrastructure-as-code libraries (e.g., `@cdktf/cli` or standard Terraform REST integrations) behind the scenes.
   - Admin clicks "Deploy ERP Module" -> CMS selects an AWS account with available EC2/Lambda quota -> Automatically provisions the resource via AWS SDK.

3. **Quota & Billing Monitor:**
   - Background workers continuously poll the AWS Cost Explorer API, Azure Consumption API, and Cloudflare API.
   - **Failsafe:** If an AWS account hits 95% of its free tier usage, the CMS automatically reroutes traffic to the next available account and powers down the instance to prevent billing overages.

4. **Unified Deployment Pipeline (CI/CD Dispatcher):**
   - GitHub Actions handles code building, but the CMS dictates the deployment target.
   - The CMS maintains a `deployment_targets.json` state. During a CI/CD run, the pipeline queries the CMS: *"Where should I deploy the Marketplace API?"* The CMS responds with the precise AWS IAM role or Azure Publish Profile of the least-utilized account.

---

## 3. CMS Admin Panel UI Modules

The Cloud Management System will be integrated into the Next.js `platform-admin` frontend with the following modules:

### A. The Fleet Dashboard
- A visual grid of all 39 accounts (13 CF, 13 AWS, 13 Azure).
- Status indicators (Green/Yellow/Red) based on API quota consumption and health checks.
- Aggregate metrics: Total Lambda invocations across all AWS accounts, total Azure App Service memory usage.

### B. Traffic Router UI
- A visual map showing how Cloudflare accounts route to specific AWS/Azure backends.
- Manual override switches to drain traffic from a specific AWS account and funnel it to an Azure account instantly.

### C. Zero-Cost Sentinel
- A dedicated billing tab.
- Displays forecasted costs (which must always equal $0.00).
- If any account accidentally provisions a paid resource, the Sentinel immediately alerts the admin and can trigger an automated teardown script via the cloud provider's API.

---

## 4. Multi-Cloud Failover Workflow

1. **Primary Route:** User -> Cloudflare Worker (Account 1) -> AWS EC2 (Account 1).
2. **Quota Alert:** CMS detects AWS Account 1 has reached 700 hours of EC2 usage this month (close to 750h limit).
3. **Automated Migration:** 
   - CMS spins up the Docker container on Azure App Service (Account 1).
   - Once Azure reports healthy, CMS updates Cloudflare Worker (Account 1) to route traffic to Azure instead of AWS.
   - CMS gracefully shuts down the EC2 instance in AWS Account 1.
4. **Reset:** At the start of the next billing month, the CMS automatically re-enables AWS Account 1 as an available deployment target.
