# Zolexora IMS — Local Project Configuration

## Scope & Guidelines
- **Local-First Configuration**: All agent settings, customizations, rules, and MCP configurations must be kept locally within this workspace (`.gemini/`, `.agents/`, and `.vscode/`).
- **Do Not Store Globally**: Avoid writing configurations or skills to global user home directories (`~/.gemini`, `~/.agents`).
- **MCP Servers**: Local configuration is defined in `.gemini/mcp_config.json`, `.gemini/config/mcp_config.json`, and `.vscode/mcp.json`.
- **Skills**: All custom and Cloudflare skills are stored locally under `.agents/skills/`.
