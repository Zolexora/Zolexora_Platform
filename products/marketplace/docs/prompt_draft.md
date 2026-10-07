# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Complete the remaining ZolexoraMarketplace roadmap (MR-05 to MR-19) as a controlled autonomous loop. Ensure strict adherence to the canonical architecture, execute one bounded phase at a time, and verify every step rigorously before proceeding.

Working directory: /data/projects/development/Zolexora/ZolexoraMarketplace
Integrity mode: development

## Requirements

### R1. Execution Loop
Execute the remaining Marketplace roadmap as a controlled autonomous loop, beginning with MR-05 and continuing sequentially through MR-19. Do not wait for the user to type “next” after every successful phase. Do not bypass acceptance gates, invent business policies, silently broaden scope, or claim incomplete work as complete.

### R2. Pre-Flight Check
Before starting MR-05, perform a bounded baseline reconciliation. Verify that the repository is ZolexoraMarketplace, check Git status without mutating, and ensure MR-00 through MR-04 are completed. Run existing regression suites.

### R3. Phase Execution Strategy
For every phase (MR-05 through MR-19): Inspect, classify existing implementation, identify gaps, implement only the authorized phase, add/repair tests, run proportionate verification, update durable documentation (ADRs, memory, status), produce a complete phase report, and continue only when the verdict is PASS and decision gates are resolved.

### R4. Phase Implementations
Strictly implement the requirements, mandatory behaviors, tests, and acceptance gates specified for MR-05 through MR-19 in the roadmap document. Stop and report blockers if a legal, GST, merchant, settlement, or ownership decision is unresolved.

### R5. Verification and Git Rules
Follow the comprehensive verification strategy (Static, Unit, Database, API, Payments, Contracts, End-to-end, Security, Release). Follow Git rules: Do not commit, push, or mutate cloud/DNS resources unless explicitly authorized. Never use destructive Git commands.

## Acceptance Criteria

### Execution & Reporting
- [ ] The execution loop correctly steps through the roadmap phases sequentially.
- [ ] Each phase concludes with a mandatory Phase Report detailing Verdict, baseline, scope, files, commands, evidence, blockers, and Git state.
- [ ] Documentation (ADRs, memory.md, status files) accurately reflects the resulting truth.

### Verification & Constraints
- [ ] All mandatory test suites pass with zero skipped critical tests for each phase.
- [ ] No placeholder behavior is represented as complete, and no client-authoritative commercial totals are trusted.
- [ ] No production secrets, cloud resource provisioning, or live financial transactions occur.

---
*Note: The comprehensive 31-section roadmap rules provided by the user will be appended in full to the final prompt sent to the teamwork system to ensure all specific constraints (e.g., MR-05 through MR-19 details) are enforced.*

---
*Next: when approved → delegate via invoke_subagent (see Delegation Protocol)*
