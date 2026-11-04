# Phase Report — <PHASE ID> <Phase name>

**Date:** YYYY-MM-DD
**Status:** DONE | PARTIAL | BLOCKED
**Session scope:** <which task IDs were attempted>

## 1. Tasks

| Task | Finding IDs | Status | Evidence |
|---|---|---|---|
| R?-1 | T-… | DONE / PARTIAL / BLOCKED / ALREADY_FIXED | test name, command output, screenshot path |

## 2. What changed

- Backend files created/changed (path — one line why)
- Frontend files created/changed
- Migrations (name — reversible? data impact?)
- New/changed endpoints (method path — permission — scope — module)

## 3. Commands run (exact) and results

```text
apps/api> php artisan test          → N tests, M assertions, X failures
apps/api> vendor/bin/pint --test    → …
apps/web> npx tsc --noEmit          → …
apps/web> npm run lint              → …
apps/web> npm run build             → …
apps/web> npx playwright test …     → …
```

## 4. Behavior verified

For each finding closed: before (what happened) → after (what happens now) → which test proves it.

## 5. Not done / limitations

## 6. Discovered (new issues, not fixed)

## 7. Decisions needed

## 8. Docs updated

- [ ] 03-PROGRESS-TRACKER.md
- [ ] 04-capability-coverage-matrix.md rows: …
- [ ] changelog.md
- [ ] openapi.yaml
- [ ] ADR (if any): …
