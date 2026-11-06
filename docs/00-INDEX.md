# Documentation Index

## Canonical files (one copy each — cleaned 2026-11-05)
- Specification: `master/MASTER-SPECIFICATION.md` (this is Phase K). Summary: `master/MASTER-SPECIFICATION-SUMMARY.md`.
- Phase A = `requirements/PRODUCT-DEFINITION.md`. Phase B = `requirements/BRD-FULL.md`. Phases C–J: `phases/`.
- Status: `../prompts/recovery/03-PROGRESS-TRACKER.md` and `recovery-reports/`. `project-management/current-state.md` and `implementation-ledger.md` are pre-recovery history.
- Decisions: `../prompts/recovery/01-DECISIONS.md` and `decisions/` (ADRs).
- Removed copies and archives can be recovered from git history: see `audit/2026-11-05-documentation-hygiene.md`.

## Audit & Recovery (current source of truth for status)
- `audit/2026-10-30-system-gap-analysis/README.md`: the main audit
- `audit/2026-11-05-documentation-hygiene.md`: documentation cleanup (what was removed and why)
- `audit/2026-11-05-frontend-backend-persistence-audit.md`: actions that do not reach the backend, or are not reflected where expected
- `audit/2026-11-05-database-audit/README.md`: database inventory, Postgres enablement
- `infrastructure/DATABASE-PORTABILITY.md`: Neon/Postgres setup and provider switching
- `decisions/ADR-002-postgres-schema-per-tenant-and-provider-portability.md`

## Plans
- `plans/2026-11-05-platform-console-tenancy-venues-qr-plan.md`: super-admin console, tenant types, venues and scheduling, camera QR attendance, persistence fixes (PLAN, not implemented)

## Requirements
- `requirements/PRODUCT-DEFINITION.md` (Phase A)
- `requirements/BRD-FULL.md` (Phase B)
- `requirements/CONSOLIDATED-SPEC-PACKAGE.md`
- `requirements/REQUIREMENTS-ENGINEERING-WORKSHOP.md`

## Phases
- `phases/phase-c.md` … `phases/phase-j.md`

## Architecture
- `architecture/` (short notes; detail lives in the Master Specification)

## Contracts & engineering
- `api/` (stub: no API contract written yet)
- `backend/`, `frontend/` (includes `frontend/UIUX-QUALITY-GATE.md`), `design/`
- `testing/`, `security/` (stubs)
- `infrastructure/`, `../infrastructure/RUNBOOK.md`

## Domains
- `domains/<domain>/README.md`. Still empty templates: authorization, classroom, communication, platform, support.

## Project Management
- `project-management/pending.md`, `blocked.md`, `deferred.md`, `risks.md`: current lists derived from the tracker
- `project-management/changelog.md`
- `project-management/current-state.md`, `implementation-ledger.md`: history

The AI should load the master specification plus only the documentation relevant to its current task.
