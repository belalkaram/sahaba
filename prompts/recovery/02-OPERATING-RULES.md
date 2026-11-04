# Operating Rules — Recovery Program

These rules apply to every session and every task. They extend `AGENTS.md`; where they conflict, the stricter rule wins.

## 1. Environment facts

- Backend: Laravel 13 (`apps/api`). Control DB = default connection; each tenant has its own DB on connection `tenant` (SQLite files in `apps/api/database/tenants/` locally). Tenant is resolved by `X-Tenant-Slug` / `X-Tenant` / `X-Tenant-ID` header or host (`app/Tenancy/TenantResolver.php`).
- Middleware aliases (in `apps/api/bootstrap/app.php`): `tenant`, `tenant.auth`, `tenant.can:<perm>`. New aliases go there.
- Auth: custom bearer tokens (`App\Models\TenantToken`), not Sanctum.
- Responses: always via `App\Support\ApiResponse` (`{data, meta}` / `{error, meta}`).
- Frontend: Next.js 16 App Router, React 19, Tailwind v4, TypeScript strict (`apps/web`). **This Next.js version has breaking changes** — read `apps/web/node_modules/next/dist/docs/` before using routing middleware/proxy, caching, or any API you are unsure about (see `apps/web/AGENTS.md`).
- OS of the developer: Windows (PowerShell). Release gate: `scripts/release-gate.ps1`.
- Demo tenant: `almustaqbal`; seed via `php artisan db:seed` (`DatabaseSeeder`). Demo users: `admin@`, `teacher@`, `student@`, `parent@almustaqbal.edu` / `password123`.

## 2. Standard commands (run from the app folder)

```text
apps/api:  php artisan test            vendor/bin/pint --test        vendor/bin/pint (to fix)
apps/web:  npx tsc --noEmit            npm run lint                  npm run build
```

Every task must end with the relevant commands run and their real output summarized. If a command cannot run, say so and why — never claim it passed.

## 3. Scope

- Implement only the current task (and strictly necessary dependencies).
- Each task lists the finding IDs it closes (e.g. `T-SEC-04`). Close exactly those. Note other issues you discover in the report under "Discovered", do not fix them silently.
- Do not redesign UI in R0–R6 beyond what the task needs. Visual redesign is R7.
- No unrelated refactors, renames, or formatting sweeps.

## 4. Truthfulness rules (most important)

- **No simulation presented as real.** No `setTimeout` fake success, no `Math.random()` data, no hardcoded fallback names/numbers, no "if API fails add a local mock".
- If a backend capability does not exist yet, the UI shows an explicit "Pending integration / غير متاح بعد" state and the tracker marks it `PARTIAL`.
- Never swallow errors into empty data (`.catch(() => [])` is forbidden). Distinguish `empty`, `forbidden (403)`, `unauthenticated (401)`, `error`.
- Status words: `IMPLEMENTED` (code exists), `VERIFIED` (tests proving behavior pass), `DONE` (verified + docs + tracker updated). Never write a stronger status than the evidence supports.

## 5. Security rules

- Backend is the only security boundary. Every new endpoint: authentication + permission (from the catalog after R1) + scope + tenant boundary + module check (after R1).
- Never trust client-supplied tenant IDs, student IDs, or roles for authorization.
- Secrets never in frontend code, `NEXT_PUBLIC_*`, URLs, logs, or test fixtures.
- Every privileged mutation writes an audit entry (`App\Support\Audit\AuditLogger`).

## 6. Tests rules

- Every behavior change gets a Feature test that fails before the change and passes after.
- **After R1-A2, tests must use the permission catalog and the real system roles** — do not create ad-hoc permissions inside tests. This is what allowed the current tests to pass while the product was broken.
- Authorization tests must cover: allowed, forbidden, wrong scope (e.g. other teacher's course), cross-tenant.
- Frontend: from R1-B onward, add Playwright tests for any new guarded route or critical flow (R9 will expand these).

## 7. Architecture rules

- Controllers thin; business logic in `app/Domain/<Domain>/Services`.
- Authorization logic in policies/ABAC rules/scope resolvers — not scattered `if ($user->hasRole(...))`.
- Frontend: feature folders (`apps/web/src/features/<feature>/{api,components,hooks}`); pages compose features; no page file over ~300 lines for new/edited pages.
- Architecture change ⇒ ADR in `docs/decisions/` using `prompts/recovery/templates/ADR.md` before implementation.

## 8. Documentation rules (per task)

1. Update `prompts/recovery/03-PROGRESS-TRACKER.md` (status + evidence link).
2. Update the affected rows in `docs/audit/2026-10-30-system-gap-analysis/04-capability-coverage-matrix.md`.
3. Append to `docs/project-management/changelog.md`.
4. Update `docs/backend/openapi.yaml` for every new/changed endpoint.
5. Write/append the phase report `docs/recovery-reports/<PHASE>.md` using `templates/TASK-REPORT.md`.
6. Do **not** change `current-state.md` "Current Mode" away from `RECOVERY` — only R9 may do that.

## 9. When to stop and ask

Stop and ask the user (do not guess) when:
- A decision is not covered by `01-DECISIONS.md`.
- A task requires external credentials/accounts (Google Cloud project, OAuth consent screen, SMTP).
- A migration would delete or irreversibly transform existing data.
- Tests that passed before your change now fail for reasons you cannot explain.

## 10. Session boundaries

- One phase (or one sub-phase) per session.
- At the end of a session: report, tracker updated, stop.
