# R1B — Access Model (Frontend)

> **بالعربي:** حماية كل الصفحات، قائمة تنقل مبنية على الصلاحيات والأقسام، أزرار حسب الصلاحية، حالات واضحة بدل الصفحات الفارغة، وشاشات إدارة الأدوار.
> **Closes:** T-RBAC-04, 05, 06, 07, 09 (frontend), T-SEC-13, T-SEC-15, T-UX-01, C-10 (frontend part)
> **Depends on:** R1A. **Decisions:** OD-2, OD-8, OD-14.

**Before coding:** read `apps/web/AGENTS.md` and the Next.js 16 docs in `apps/web/node_modules/next/dist/docs/` for route interception (middleware/proxy), layouts, and client/server components. Do not assume older Next.js APIs.

## Tasks

### R1-B1 — Types & API contract
- Generate TS types from `docs/backend/openapi.yaml` (e.g. `openapi-typescript`) into `apps/web/src/types/api.d.ts`, or if OpenAPI is incomplete, hand-write types matching R1-A6 exactly and add a TODO tracked in the tracker for R9-2.
- Replace `TenantUser.roles?: Role[]` usage everywhere with the new `Me` type.

### R1-B2 — Auth & tenant context
- Rewrite `apps/web/src/context/auth-context.tsx`: state = `me` payload; derived `experience`, `can(permission)`, `scopeOf(permission)`, `hasModule(key)`.
- Delete `resolveRole`, `switchRole`, `UserRole` 4-value union.
- Login redirects to `/${experience}` home (`/student`, `/parent`, `/staff`, `/admin`), platform login separate at `/platform/login`.
- Platform session uses separate context/storage from tenant session.

### R1-B3 — Navigation registry
- `apps/web/src/config/navigation.ts`: array of `{ id, href, label, icon, experience, module?, anyOf?: string[], allOf?: string[] }` covering every existing page.
- Route move per OD-2/OD-8: `/teacher/*` ⇒ `/staff/*` (move files; keep redirects from old paths). Create `/admin` experience with at least: dashboard placeholder that states "قيد الإنشاء — R2/R7" honestly, users (R2), roles (R1-B8), settings (R2).
- One sidebar component reads the registry and filters by experience + module + permissions. Delete the four duplicated layout implementations (`components/layout/*-nav-layout.tsx` are dead; per-route `layout.tsx` should use the shared shell).

### R1-B4 — Route guards + 403 page
- Global guard (Next 16 routing middleware/proxy as documented) that redirects unauthenticated users to `/login` (token presence only — it is not the security boundary).
- Client guard in each experience layout: wrong experience ⇒ redirect to own home; missing module/permission for the current route (lookup in registry by path prefix) ⇒ render `<Forbidden />`.
- `apps/web/src/app/forbidden` page/component with clear Arabic copy and a link home.

### R1-B5 — `useCan` / `<Can>`
- `useCan('payments.approve')` ⇒ boolean; `<Can anyOf={[...]} fallback={...}>`.
- Replace the unused `PermissionGate` with these; wrap every mutating button in existing pages (approve/reject payment, issue/revoke credential, create course/lesson/assignment, record attendance, create meeting, upload media, grade).

### R1-B6 — Data-state layer
- `apps/web/src/lib/query.ts` (or adopt TanStack Query if acceptable — record decision in report): `useApi(fn)` ⇒ `{status:'loading'|'success'|'empty'|'forbidden'|'unauthenticated'|'error', data, error, retry}`.
- `api-client.ts`: throw typed `ApiError` with `status` and `code`.
- Shared components: `<StateView>` rendering skeleton / `EmptyState` / `Forbidden` / `ErrorState(retry)`.
- Remove **all** `.catch(() => [])` and `.catch(() => null)` in `apps/web/src/app` (35 occurrences at audit time). Grep must return 0.
- Replace student-page logic that depends on `user.student.id` with `me.profiles.student.id`.
- Parent pages use `/me/children` instead of `/students`.
- Teacher/staff pages use `/me/students`, `/me/courses`, `/me/classes`.
- `teacher/analytics` page: remove hardcoded UUID; select a student from `/me/students`.

### R1-B7 — 401 handling
- On 401 from any tenant call: clear session, redirect to `/login?expired=1`, show message. Platform equivalent for platform calls.

### R1-B8 — Role management screens (admin experience)
- `/admin/roles`: list system + custom roles, user counts.
- `/admin/roles/[id]`: editor grouped by module; each permission toggle + scope select (only scopes allowed by catalog); system roles read-only except label.
- `/admin/users/[id]/roles` (or a section in the user detail page from R2): assign roles; show effective permissions table.
- Use `<Can>` for actions; all states via `<StateView>`.

### R1-B9 — Playwright setup + role navigation tests
- Add Playwright to `apps/web` (dev dependency, config, `npm run test:e2e`). Tests run against local API with seeded demo tenant.
- For each demo user (owner/admin, teacher, assistant, finance, student, parent): login ⇒ sidebar contains exactly the expected items ⇒ visiting a forbidden URL shows the 403 view ⇒ no page shows an empty list where the API returned 403.

## Acceptance criteria

- [ ] `grep -R "catch(() =>" apps/web/src/app` ⇒ 0.
- [ ] No `resolveRole` / `switchRole`.
- [ ] Demo admin lands on `/admin`, not `/platform`.
- [ ] Each role sees only its navigation; forbidden URL ⇒ 403 view (Playwright).
- [ ] Admin can create a custom role and assign it; the user's navigation changes accordingly after re-login (Playwright).
- [ ] Student grades and dashboard load real data using `profiles.student.id`.
- [ ] `tsc`, `lint`, `build`, Playwright pass.
