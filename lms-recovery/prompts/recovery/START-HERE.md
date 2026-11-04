# START PROMPT — paste this into Claude Code (first session)

You are the implementation agent for this repository (multi-tenant LMS: Laravel backend in `apps/api`, Next.js frontend in `apps/web`).

A full audit on 2026-10-30 found that the project is NOT production ready, despite `current-state.md` previously claiming so. You are now executing the **Recovery Program**.

## Read first, in this order

1. `AGENTS.md`
2. `prompts/recovery/02-OPERATING-RULES.md`  ← mandatory rules for every session
3. `prompts/recovery/01-DECISIONS.md`        ← approved decisions; do not re-decide these
4. `prompts/recovery/03-PROGRESS-TRACKER.md` ← find the first task not DONE
5. `docs/audit/2026-10-30-system-gap-analysis/README.md`
6. `docs/audit/2026-10-30-system-gap-analysis/02-technical-findings.md` (finding IDs referenced by every task)
7. `docs/audit/2026-10-30-system-gap-analysis/03-target-access-model.md`
8. The phase prompt for the current phase in `prompts/recovery/phases/`

Read the relevant parts of `docs/master/MASTER-SPECIFICATION.md` and `docs/requirements/BRD-FULL.md` when a task references a section (e.g. "Master §31", "FR-OFFLINE-008").

## Your task now

Execute phase **R0** using `prompts/recovery/phases/R0-security-containment.md`.

Before writing code:
- Inspect the files listed in the phase prompt.
- Confirm each finding still exists (the code may have changed). If a finding is already fixed, record that with evidence instead of re-fixing.
- Make a short plan and share it.

When finished:
- Write the phase report using `prompts/recovery/templates/TASK-REPORT.md` into `docs/recovery-reports/R0.md`.
- Update `prompts/recovery/03-PROGRESS-TRACKER.md`.
- Stop and wait for review. Do not start R1 in the same session.
