# R9 — Verification & Release

> **بالعربي:** إثبات كل شيء بالأدلة: اختبارات E2E لكل دور، اختبارات العقد، مصفوفة الأدوار في CI، لقطات بصرية، Accessibility، Release Gate جديد، وتحديث الحالة.
> **Closes:** T-QA-01..06, C-09, T-UX-11
> **Depends on:** everything in scope for the release.

## Tasks

### R9-1 — E2E suite (Playwright)
- One spec per experience + critical flows: provisioning (R2), payment → access (R3), course build → watch → resume (R4), QR attendance (R5), exam lifecycle (R6), notifications (R8), support session (R2-6).
- Deterministic test data: `php artisan lms:seed-e2e` creating a fresh tenant with known users; tests never depend on demo data mutations.
- Runs in CI (GitHub Actions) with API + web started; artifacts: traces + screenshots on failure.

### R9-2 — Contract tests
- `docs/backend/openapi.yaml` complete for every route (generate list from `php artisan route:list --json` and fail CI if a route is undocumented).
- Backend: response-shape tests validating against OpenAPI for key endpoints.
- Frontend: types generated from OpenAPI in CI; `tsc` fails on drift.

### R9-3 — Role matrix in CI
- The R1 role-matrix test (system roles × endpoints) runs on every PR. Matrix expected results live in a fixture derived from `config/authorization.php`.

### R9-4 — Visual QA
- Playwright screenshot run over every route in the navigation registry × each experience × {390, 1440} × {light, dark}. Store under `docs/recovery-reports/visual/<date>/`. Review checklist from Quality Gate §38 filled in the report.

### R9-5 — Accessibility
- `@axe-core/playwright` on every route; 0 critical/serious violations.

### R9-6 — New release gate
- Rewrite `scripts/release-gate.ps1` (and a bash equivalent for CI) with gates: pint, phpunit, permission catalog integrity, role matrix, tsc, lint, build, E2E, axe, OpenAPI coverage, `composer audit`/`npm audit` (blocking), **coverage matrix check**: parse `docs/audit/2026-10-30-system-gap-analysis/04-capability-coverage-matrix.md` and fail if any in-scope row is `BROKEN` or `SIMULATED` (rows explicitly marked `DEFERRED (ADR-…)` are allowed).
- Output `docs/project-management/release-evidence.json` including per-gate command, duration, result, and commit SHA.

### R9-7 — Repository hygiene
- Delete leftover test tenant databases in `apps/api/database/tenants/` (keep none in git), ensure tests use temp paths and clean up.
- Add `offline.html` to the service worker precache; confirm SW never caches API responses, proofs, reports, or credentials (Master §69).
- Remove duplicate spec copies or mark them as generated mirrors (`phases/phase-k.md` vs `MASTER-SPECIFICATION.md`, etc.) — one canonical file each, with a note in `docs/00-INDEX.md`.
- Fix broken absolute `file:///c:/Users/...` links in docs.

### R9-8 — Documentation & status
- Update `04-capability-coverage-matrix.md` with final statuses and evidence links.
- `current-state.md`: replace free-text claims with a summary generated from the matrix; set Current Mode to `PRODUCTION_READY` **only if** the new release gate passes; otherwise `RELEASE_CANDIDATE` with the blocking list.
- Update `README.md` "Start here" to point to the current workflow (not M0).
- Archive `docs/frontend/frontend-recovery-plan.md` status table as superseded.
- Final report `docs/recovery-reports/R9.md` using Quality Gate §47 format.

## Acceptance criteria

- [ ] New release gate passes end-to-end on a clean clone (document exact commands).
- [ ] No P0/P1 finding from `02-technical-findings.md` remains open without an accepted ADR deferral.
- [ ] Coverage matrix has no BROKEN/SIMULATED rows in scope.
