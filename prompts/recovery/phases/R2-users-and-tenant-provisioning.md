# R2 — User Management & Tenant Provisioning

> **بالعربي:** إدارة كل المستخدمين من الواجهة، الفروع والقاعات، تجهيز مؤسسة جديدة كامل، تسجيل ذاتي حقيقي، ولوحة منصة حقيقية مع جلسات دعم.
> **Closes:** T-FEAT-15 (branches/classrooms API), T-FEAT-24, 25, 26, T-FEAT-34, T-RBAC-03 (complete), C-11, C-12, T-SEC-02 (UI part)
> **Depends on:** R1A, R1B. **Spec:** FR-ID-001..006, FR-TEN-001..005, FR-OFFLINE-001/002, FR-ADMIN-001..004, Master §50-53.

## Tasks

### R2-1 — Users API (tenant)
Domain service `App\Domain\Identity\Services\UserManagementService`. Endpoints (permissions from catalog, scoped):
- `GET /users?persona=&role=&status=&branch_id=&search=&page=` — paginated.
- `POST /students` (creates `tenant_users` + `students`, generates `student_code`, optional parent link, optional initial password or invite) — `students.create`.
- `PUT /students/{id}`, `POST /students/{id}/suspend|activate` — `students.update`.
- `POST /staff` (persona staff + `staff_type` + roles + branches + assignments) — `staff.manage`.
- `POST /parents`, `POST /parents/{id}/children {student_id, relation_type}`, `DELETE …` — `parents.manage`.
- `POST /users/{id}/reset-password` (returns one-time temp password or sends email after R8) — `users.update`.
- `POST /staff/{id}/assignments` (classes/courses/students) — `staff.manage`.
- Link `global_identity` for students when phone/email matches (respect Master §13-14; never merge tenant data).
- All mutations audited. Validation: unique phone/email per tenant.
- Tests: CRUD, scopes (branch manager only within branch), duplicate prevention, audit entries.

### R2-2 — CSV import
- `POST /students/import` (multipart CSV) ⇒ queued job (sync in dev) ⇒ `GET /imports/{id}` with per-row results. Columns: name, phone, email, grade_level, parent_name, parent_phone.
- Test with valid + invalid rows.

### R2-3 — Branches & classrooms API
- `GET/POST/PUT/DELETE /branches`, `/branches/{id}/classrooms` — `branches.manage`, `classrooms.manage`, module `offline`.
- Classes get optional `branch_id` (migration).
- Tests including branch scope.

### R2-4 — Tenant provisioning service
- `App\Tenancy\TenantProvisioningService::provision(array $data): Tenant`: create control records ⇒ create/migrate DB ⇒ `RoleSynchronizer` ⇒ create owner user (persona staff, role `owner`) ⇒ enable modules ⇒ default settings ⇒ audit. On any failure: roll back control records and delete the created DB file/database.
- `TenantController@store` uses it; payload adds `owner {name, email, phone, password}` and `modules[]`.
- Test: provision ⇒ owner can log in immediately ⇒ `/auth/me` shows owner permissions; simulated failure ⇒ nothing left behind.

### R2-5 — Self-service school registration
- Public endpoint `POST /public/register-school` (rate-limited, honeypot, slug validation, reserved slugs) ⇒ tenant in `provisioning`/`pending_verification` status per decision: default **active immediately with owner email verification pending** (if email not configured yet, active immediately and note in report).
- `apps/web/src/app/register-school/page.tsx`: call it; real validation errors; on success show login link for the new tenant. Remove `setTimeout`.

### R2-6 — Platform console (real)
- Endpoints (platform auth): `POST /tenants/{id}/suspend|activate`, `PUT /tenants/{id}/modules`, `GET /platform/metrics` (aggregate counts per tenant: students, staff, courses, storage bytes, last activity — counts only, Master §51), `GET /platform/support-sessions`, `POST /platform/support-sessions` (replaces old support endpoint), `POST /platform/support-sessions/{id}/end`.
- Frontend `/platform/*`: platform login; tenants list (real status toggle via API, no local state); tenant detail (modules toggles, branding, domains, metrics); provisioning form calling R2-4 with real progress = request state only (delete the fake step animation and mock fallback); support sessions page (start with reason, list, end).
- Tenant UI during support: persistent top banner "جلسة دعم — تنتهي خلال mm:ss — إنهاء" (FE-SEC-INV-005).

### R2-7 — Admin screens (tenant)
- `/admin/users` (table with filters, search, pagination, persona tabs), `/admin/users/new` (multi-step: persona ⇒ details ⇒ roles/assignments ⇒ review), `/admin/users/[id]` (detail: profile, roles, effective permissions, assignments, children/parents, credentials, activity).
- `/admin/students/import`.
- `/admin/branches`, `/admin/branches/[id]` (classrooms).
- `/admin/settings` (profile, branding with live preview, auth mode, modules read-only view of what platform enabled).
- All with `<StateView>`, `<Can>`, mobile-friendly.

## Acceptance criteria (E2E with Playwright)

- [ ] Platform admin logs in ⇒ creates tenant with owner ⇒ owner logs into new tenant.
- [ ] Owner creates teacher, assistant (assigned to a class), finance, student, parent (linked) ⇒ each logs in and sees the correct experience/navigation.
- [ ] Platform suspends tenant ⇒ tenant users get the inactive-tenant error; activate restores.
- [ ] Support session start ⇒ banner visible ⇒ end ⇒ next request 401.
- [ ] `/register-school` creates a real tenant.
- [ ] All standard commands pass.
