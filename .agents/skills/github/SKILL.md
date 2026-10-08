---
name: github
description: Comprehensive GitHub CLI (gh) and GitHub MCP skill. Use for managing GitHub repositories, branches, pull requests, issues, releases, GitHub Actions workflows, secrets, GitHub Copilot in CLI, and GitHub MCP server integration.
---

# GitHub CLI (`gh`) & GitHub MCP Skill

This skill provides complete reference and execution patterns for GitHub operations using the **GitHub CLI (`gh`)** and the **GitHub Model Context Protocol (MCP) Server**.

---

## 1. Authentication & Session Management

In GitHub Codespaces and CI/CD environments, authentication is managed automatically via `GITHUB_TOKEN`.

### Check Authentication Status
```bash
gh auth status
```

### Log In (Interactive or Token)
```bash
# Interactive web browser or one-time code
gh auth login

# Authenticate with a personal access token (PAT) via stdin
echo "$MY_GITHUB_PAT" | gh auth login --with-token

# Check currently active token
gh auth token
```

> [!NOTE]
> Running `gh login` directly will error with `unknown command "login" for "gh"`. The canonical command is `gh auth login`.

---

## 2. Pull Request (PR) Workflows

| Action | Command |
| :--- | :--- |
| **Create PR** | `gh pr create --title "feat: title" --body "description" --base main` |
| **Create Draft PR** | `gh pr create --draft --title "wip: title" --body "description"` |
| **List PRs** | `gh pr list --state open` |
| **View PR status** | `gh pr status` |
| **Checkout PR locally** | `gh pr checkout <pr-number>` |
| **View PR diff** | `gh pr diff <pr-number>` |
| **Approve PR** | `gh pr review <pr-number> --approve -b "LGTM"` |
| **Merge PR (Squash)** | `gh pr merge <pr-number> --squash --delete-branch` |
| **Close PR** | `gh pr close <pr-number>` |

---

## 3. Issue Management

| Action | Command |
| :--- | :--- |
| **Create Issue** | `gh issue create --title "Bug title" --body "Steps to reproduce" --label bug` |
| **List Issues** | `gh issue list --state open --assignee "@me"` |
| **View Issue** | `gh issue view <issue-number> --comments` |
| **Add Comment** | `gh issue comment <issue-number> --body "Fixed in commit abc1234"` |
| **Close Issue** | `gh issue close <issue-number> --reason completed` |

---

## 4. GitHub Actions Workflows

| Action | Command |
| :--- | :--- |
| **List Workflow Runs** | `gh run list --limit 10` |
| **Watch Active Run** | `gh run watch <run-id>` |
| **View Run Logs** | `gh run view <run-id> --log` |
| **Rerun Failed Jobs** | `gh run rerun <run-id> --failed` |
| **Trigger Workflow** | `gh workflow run deploy.yml --ref main` |

---

## 5. Secrets and Variables

```bash
# Set repository secret
gh secret set CLOUDFLARE_API_TOKEN --body "token_value"

# List repository secrets
gh secret list

# Set environment secret
gh secret set DB_PASSWORD --env production --body "password"

# Set configuration variable
gh variable set ENVIRONMENT --body "production"
```

---

## 6. Installed Extensions & Tools

The following specialized tools are installed and ready:

### 1. `gh copilot`
Provides command explanation and terminal suggestions powered by GitHub Copilot:
```bash
# Get command suggestion
gh copilot suggest "find all files modified in the last 24 hours"

# Explain a shell command
gh copilot explain "git log --graph --oneline --decorate --all"
```

### 2. `gh dash`
Interactive terminal dashboard for PRs, issues, and notifications:
```bash
gh dash
```

### 3. `gh aw` (GitHub Agentic Workflows)
Tools for agentic automation and workflow coordination:
```bash
gh aw --help
```

---

## 7. Raw GitHub REST & GraphQL API (`gh api`)

Execute direct authenticated API calls without manually writing curl headers:

```bash
# Get repository metadata
gh api /repos/{owner}/{repo}

# List commits on main
gh api /repos/{owner}/{repo}/commits?per_page=5

# GraphQL Query
gh api graphql -f query='
  query {
    viewer {
      login
      repositories(first: 5) {
        nodes {
          name
        }
      }
    }
  }
'
```

---

## 8. GitHub MCP Server Integration

The repository is configured with the standard GitHub MCP server (`@modelcontextprotocol/server-github`).

### Capabilities:
- `create_or_update_file`: Push single files directly via GitHub API.
- `create_issue`: Open new issues.
- `create_pull_request`: Submit pull requests with automated branch tracking.
- `fork_repository`: Fork repos.
- `create_branch`: Create new git branches remotely.
- `list_commits`, `get_file_contents`, `search_repositories`.

### Configurations Active:
- `.vscode/mcp.json`
- `.gemini/mcp_config.json`
- `.gemini/config/mcp_config.json`
