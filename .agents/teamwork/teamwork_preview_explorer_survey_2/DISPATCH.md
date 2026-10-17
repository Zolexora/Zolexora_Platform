# Explorer 2 Dispatch: Startup Scripts & Compose Integration

- Role: Scripts & Orchestration Specialist
- Scope: Investigate `scripts/zolexora-tms/start-docker.sh`, `scripts/setup/start.sh`, and other setup scripts. Analyze how Docker Compose is called, how `infisical run` should wrap commands non-destructively, and alignment with `products/zolexora-tms/compose.yaml`.
- Read: `/workspaces/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md`
- Working Directory: `/workspaces/Zolexora_Platform/.agents/teamwork/teamwork_preview_explorer_survey_2/`

## 2026-10-17T10:03:22Z
You are Explorer 2 (Scripts & Orchestration Specialist).
Your working directory is /workspaces/Zolexora_Platform/.agents/teamwork/teamwork_preview_explorer_survey_2/.
Project root: /workspaces/Zolexora_Platform.
Your parent is Project Orchestrator (orchestrator_1).

MANDATORY FIRST STEP: Read /workspaces/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md and your /workspaces/Zolexora_Platform/.agents/teamwork/teamwork_preview_explorer_survey_2/DISPATCH.md.

Mission & Objective:
Perform an in-depth, read-only survey of the startup and orchestration scripts across the repository:
1. Inspect `scripts/zolexora-tms/start-docker.sh` and `scripts/setup/start.sh`.
2. Inspect any other scripts in `scripts/` or `package.json` scripts related to TMS or Docker startup.
3. Check which compose file(s) are currently targeted by these scripts (e.g. `products/zolexora-tms/compose.yaml` vs others).
4. Analyze how `infisical run` is currently used, or how it needs to be integrated into `start-docker.sh` and `start.sh` so secrets are injected into containers during `docker compose up`.
5. Identify edge cases: handling interactive vs non-interactive execution, handling cases where containers are already running, handling clean restart / down / build flags, logging and error handling.
6. Detail the exact changes required in each script to satisfy Acceptance Criteria R2 (non-destructive execution, launching containers using `infisical run`, targeting `products/zolexora-tms/compose.yaml`).

Scope boundaries:
- Read-only investigation. DO NOT edit or modify source scripts yet.
- You may run non-destructive inspection shell commands.
- Maintain `progress.md` with timestamps as your liveness heartbeat.

Deliverable:
Write your comprehensive findings to /workspaces/Zolexora_Platform/.agents/teamwork/teamwork_preview_explorer_survey_2/analysis.md and complete /workspaces/Zolexora_Platform/.agents/teamwork/teamwork_preview_explorer_survey_2/handoff.md.
Then send a completion message to the parent.
