# R1A — Access Model (Backend)

> **بالعربي:** كتالوج صلاحيات واحد، 8 أدوار نظامية، نطاقات (scopes)، أقسام، `/auth/me` جديد، API لإدارة الأدوار، وهوية للمنصة.
> **Closes:** C-01..C-06 (backend side), T-RBAC-01, 02, 03 (partially — provisioning finished in R2), 08, 10, 11, 12, 13, T-SEC-02 (identity part), T-SEC-08, T-SEC-09, T-QA-01
> **Depends on:** R0. **Decisions:** OD-1, OD-2, OD-7, OD-9.
> **Design source:** `docs/audit/2026-10-30-system-gap-analysis/03-target-access-model.md` — follow it.

## Tasks

### R1-A1 — ADR
Write `docs/decisions/ADR-0xx-access-model.md` (template `prompts/recovery/templates/ADR.md`) capturing: planes, experiences, system roles, permission catalog format, scopes, modules, `/auth/me` contract, platform identity. Status `Accepted` (decisions already approved in `01-DECISIONS.md`).

### R1-A2 — Permission catalog (single source of truth)
- New `apps/api/config/authorization.php`:
  - `permissions`: `'<name>' => ['module' => '<module>', 'label' => '<Arabic label>', 'scopes' => [...]]` — use the catalog in `03-target-access-model.md` §4. Keep existing names that are already used in routes where reasonable; where the spec name differs (e.g. `credentials.issue` vs `credentials.create`) pick the spec name and migrate routes.
  - `roles`: system role ⇒ `[permission => scope]` per the matrix in §5 of the access model.
  - `modules`: list with Arabic labels.
- New `App\Support\Authorization\PermissionCatalog` service (read config, list, validate).
- New test `PermissionCatalogIntegrityTest`: scan `routes/` for `tenant.can:` and `app/` for `hasPermissionTo('…')`/`authorize($user, '…'` and assert every name exists in the catalog. This test must fail on the current code (7 missing names) before you fix it.

### R1-A3 — System roles & sync
- `App\Domain\Authorization\Services\RoleSynchronizer`: idempotently upserts all catalog permissions and system roles (with `is_system = true`) into the current tenant DB; does not touch custom roles.
- Migration (tenant): add `scope` column (string, default `tenant`) to `role_permission`.
- Artisan command `lms:sync-roles {--tenant=}` (all tenants if omitted).
- `DatabaseSeeder` and `DemoDataSeeder` use `RoleSynchronizer` instead of hardcoded lists; assign demo users: admin ⇒ `owner`, teacher ⇒ `teacher`, add an `assistant@almustaqbal.edu` (assistant, assigned to the demo class) and `finance@almustaqbal.edu` (finance).
- `TenantController@store` calls `RoleSynchronizer` after migrating (full provisioning service in R2-4).

### R1-A4 — Scopes
- Scope values: `self`, `linked` (parent→children), `own` (resources the staff member owns: `courses.teacher_staff_id`, `classes.teacher_staff_id`), `assigned` (new assignment tables), `branch`, `tenant`.
- Tenant migration: `staff_assignments` (`staff_id`, `assignable_type` in [`class`,`course`,`student`], `assignable_id`), `staff_branches` (`staff_id`, `branch_id`).
- `TenantUser::permissionScope(string $permission): ?string` — highest scope across the user's roles (`tenant` > `branch` > `assigned` > `own` > `linked` > `self`).
- `App\Support\Authorization\ScopeResolver` with query helpers, e.g. `scopeStudents(Builder $q, TenantUser $u, string $perm)`, `scopeCourses`, `scopeClasses`, `scopeSessions`, `scopePaymentRequests`, and `canAccess(TenantUser $u, string $perm, Model $resource): bool`.
- Apply to every listing/show/mutation in: Student, Enrollment, Course, Lesson, Class, Session, Attendance, Assignment, Exam, Grade, PaymentRequest, Subscription, Entitlement, Credential, Meeting, Media, Dashboard, Report controllers. Replace the single `TeacherCourseRule` with scope checks (keep the ABAC engine; register rules that delegate to `ScopeResolver`).
- Fix `DashboardController` parent check (`$user->parent` ⇒ `parentProfile`, via `linked` scope) — T-RBAC-08.
- Tests (`ScopeEnforcementTest`): teacher A cannot read/modify teacher B's course, lessons, exams, sessions, attendance; assistant sees only assigned class students; parent sees only linked children; student sees only self.

### R1-A5 — Modules
- Middleware `tenant.module:<key>` (alias in `bootstrap/app.php`) using `Tenant::hasFeature()`; 403 with code `MODULE_DISABLED`.
- Apply to route groups: online (courses, lessons, media, meetings), offline (classes, sessions, attendance, branches), assessment, billing, credentials, analytics/reports, parents.
- Seed demo tenant with all modules enabled; ensure `tenant_features` keys match `config/authorization.php` modules.
- Test: disable `offline` ⇒ `/classes` returns 403 `MODULE_DISABLED`.

### R1-A6 — `/auth/me` and `/auth/login` contract
- Implement the JSON contract in access model §7 exactly (user, persona, profiles with IDs, roles `[{name,label}]`, `permissions` map name⇒scope, tenant {id, slug, name, modules, auth_mode, branding}, `experience`, `support_session`).
- `experience` resolution (backend): `student` if student profile; `parent` if parent profile; `admin` if any permission in module `core` with admin-level names (`users.*`, `roles.*`, `tenant.settings`); else `staff`. A user with both admin and teaching permissions gets `admin` with access to staff screens via navigation (document this in the ADR).
- `/auth/login` returns the same `me` payload under `user`.
- Update `docs/backend/openapi.yaml`.
- Test: snapshot of the payload shape for each demo user.

### R1-A7 — Roles & permissions management API
- `GET /permissions` (catalog grouped by module) — `roles.view`
- `GET /roles`, `POST /roles`, `PUT /roles/{id}`, `DELETE /roles/{id}` (custom only) — `roles.manage`; payload `{name,label,permissions:{name:scope}}`; reject unknown permissions/scopes.
- `GET /users/{id}/roles`, `PUT /users/{id}/roles` — `roles.manage`; cannot remove the last `owner`.
- `GET /users/{id}/effective-permissions` — `roles.view`.
- Every mutation ⇒ `AuditLogger`.
- Tests for each, including privilege-escalation guard: a `center_admin` cannot grant a permission they do not hold.

### R1-A8 — "My" endpoints
- `GET /me/children` (parent), `GET /me/courses` (student enrolled+entitled / staff own-assigned), `GET /me/classes`, `GET /me/students` (staff, scoped), `GET /me/sessions?from&to`.
- Frontend will use these in R1B/R7 instead of listing everything.

### R1-A9 — Platform identity
- Control DB migrations: `platform_users` (id, name, email, password, status), `platform_roles`, `platform_user_roles`, `platform_tokens`.
- `POST /platform/auth/login`, `GET /platform/auth/me`, `POST /platform/auth/logout`.
- Replace R0 interim `platform.auth` (static token) with real platform tokens + permissions `platform.tenants.view|manage`, `platform.support.start`, `platform.audit.view`.
- `support_access_logs` gets `platform_user_id` from the authenticated platform user; add `ended_at`, `revoked_at`, `status`; endpoints `POST /platform/support-sessions/{id}/end`. Tenant token for support links to the session; ending/expiry invalidates it (check in `TenantAuthenticate`).
- Support tenant user gets a `support` system role with read-only permissions by default.
- Seeder: one platform super admin from env (`PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`).
- Tests: tenant token cannot call platform routes; platform token cannot call tenant routes; ended support session ⇒ 401 on next request.

## Acceptance criteria

- [ ] `PermissionCatalogIntegrityTest` passes; no permission string exists outside the catalog.
- [ ] All tests use catalog roles (refactor existing gate tests that created ad-hoc permissions).
- [ ] Role matrix test: for each system role × each endpoint ⇒ expected 200/403 using the real seeder data.
- [ ] Demo admin sees students, payments, credentials (non-empty) via API.
- [ ] Demo student can list meetings/media for enrolled courses only.
- [ ] Demo parent can read only their child's dashboard and grades.
- [ ] Disabled module ⇒ 403 `MODULE_DISABLED`.
- [ ] Platform has real accounts; support sessions end and expire.
- [ ] All standard commands pass.
