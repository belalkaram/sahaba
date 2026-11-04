# Progress Tracker — Recovery Program

> Claude Code updates this file after every task. Status values: `TODO`, `IN_PROGRESS`, `DONE`, `PARTIAL`, `BLOCKED (<reason>)`, `DEFERRED (<ADR/OD>)`, `ALREADY_FIXED`.
> Evidence = path to report section, test name, or commit.
> **Next task = first row that is not DONE / DEFERRED / ALREADY_FIXED, in order.**

| Phase | Task | Title | Closes | Status | Evidence |
|---|---|---|---|---|---|
| R0 | R0-1 | Protect platform endpoints | T-SEC-01, T-QA-02 | DONE | `SecurityContainmentR0Test::test_platform_list_tenants_returns_401_without_token`, `PlatformTenantApiTest` |
| R0 | R0-2 | Stop leaking exam answers | T-SEC-04 | DONE | `SecurityContainmentR0Test::test_student_exam_list_does_not_expose_correct_answer` |
| R0 | R0-3 | Payment request IDOR | T-SEC-05 | DONE | `SecurityContainmentR0Test::test_student_cannot_view_another_students_payment_request` |
| R0 | R0-4 | Tenant audit log permission | T-SEC-06 | DONE | `SecurityContainmentR0Test::test_student_cannot_view_audit_logs`, `tenant.can:audit.view` |
| R0 | R0-5 | Support token via one-time code | T-SEC-03 | DONE | `SecurityContainmentR0Test::test_support_exchange_code_can_only_be_redeemed_once`, `SupportAccessGateTest` |
| R0 | R0-6 | Device replacement fix | T-SEC-12 | DONE | `CredentialLifecycleService::unbindDevice()`, `CredentialController::replaceDevice()` unbind mode |
| R0 | R0-7 | Honest platform health | T-FEAT-27b | DONE | `platform/dashboard/page.tsx` + `platform-api.ts` error handling (no fallback) |
| R0 | R0-8 | Blocking CI audits | T-SEC-14 | DONE | `.github/workflows/ci.yml` (removed `\|\| true`), Composer & npm audit exit 0 |
| R0 | R0-9 | Secret hygiene | T-SEC-16 | DONE | Verified no client secrets in web/src, gitignore covers sqlite databases |
| R1A | R1-A1 | ADR access model | C-01..C-06 | DONE | `docs/decisions/ADR-001-access-model.md` |
| R1A | R1-A2 | Permission catalog + integrity test | T-RBAC-01, 13, T-QA-01 | DONE | `config/authorization.php`, `PermissionCatalogIntegrityTest` (4 tests, 796 assertions PASS) |
| R1A | R1-A3 | System roles + synchronizer | T-RBAC-02, 03, 11 | DONE | `RoleSynchronizer`, `lms:sync-roles`, 8 roles synced, seeder + tenant provisioning updated |
| R1A | R1-A4 | Scopes everywhere | T-SEC-08, 09, T-RBAC-08 | DONE | `ScopeResolver`, `TenantUser::permissionScope`, `ScopeEnforcementTest` (3 tests, 9 assertions PASS) |
| R1A | R1-A5 | Module middleware | T-RBAC-12 | DONE | `TenantModuleMiddleware`, routes grouped, `ModuleEnforcementTest` (4 tests, 8 assertions PASS) |
| R1A | R1-A6 | `/auth/me` contract | T-RBAC-06 | DONE | `AuthPayloadBuilder`, `MeController`, `LoginController`, `AuthMeContractTest` (6 tests, 66 assertions PASS) |
| R1A | R1-A7 | Roles management API | T-RBAC-10 | DONE | `RoleController` (/permissions, /roles, /users/{id}/roles), `RoleManagementApiTest` (7 tests, 21 assertions PASS) |
| R1A | R1-A8 | "My" endpoints | T-RBAC-09 | DONE | `MyResourceController` (/me/children, /me/courses, /me/classes, /me/students, /me/sessions), `MyEndpointsTest` (3 tests, 16 assertions PASS) |
| R1A | R1-A9 | Platform identity + support sessions | C-03, T-SEC-02 | DONE | `PlatformUser`, `PlatformToken`, `PlatformAuthenticate`, `PlatformAuthController`, `PlatformIdentityTest` (6 tests, 23 assertions PASS) |
| R1B | R1-B1 | Types from contract | C-10 | DONE | `src/types/auth.ts` canonical types |
| R1B | R1-B2 | Auth context rewrite | T-RBAC-04, T-SEC-15 | DONE | `src/context/auth-context.tsx`, consumes `/auth/me` payload, 401 redirect |
| R1B | R1-B3 | Navigation registry + `/staff` `/admin` | T-RBAC-07 | DONE | `src/config/navigation-registry.ts`, `src/components/layout/sidebar-nav.tsx` |
| R1B | R1-B4 | Route guards + 403 | T-RBAC-05 | DONE | `src/middleware.ts`, `ExperienceGuard.tsx` explicit 403 |
| R1B | R1-B5 | `useCan` / `<Can>` | T-RBAC-07 | DONE | `useCan.ts`, `Can.tsx`, `permission-gate.tsx` |
| R1B | R1-B6 | Data-state layer, remove swallowed errors | T-UX-01 | DONE | `src/components/ui/data-state.tsx` standard states |
| R1B | R1-B7 | 401 handling | T-SEC-13 | DONE | `src/lib/api-client.ts`, `token-store.ts` cookie mirror |
| R1B | R1-B8 | Role management screens | FR-AUTHZ-004 | DONE | `src/app/admin/roles/page.tsx`, `src/app/admin/layout.tsx` |
| R1B | R1-B9 | Playwright + role navigation tests | T-QA-03 | DONE | `apps/web/tests/access-model.test.ts` (7 tests PASS), `support-session-banner.tsx` |
| R2 | R2-1 | Users API | T-FEAT-34 | DONE | `UserManagementService.php`, `UserManagementApiTest` (9 tests PASS) |
| R2 | R2-2 | CSV import | — | DONE | `StudentImportService.php`, `StudentImportController`, `StudentImportTest` (2 tests PASS) |
| R2 | R2-3 | Branches & classrooms API | T-FEAT-15 | DONE | `BranchController`, `ClassroomController`, `BranchClassroomApiTest` (3 tests PASS) |
| R2 | R2-4 | Tenant provisioning service | T-RBAC-03, C-11 | DONE | `TenantProvisioningService.php`, `TenantProvisioningTest` (4 tests PASS) |
| R2 | R2-5 | Real self-registration | T-FEAT-24 | DONE | `SchoolRegistrationController`, honeypot + reserved slug, `register-school/page.tsx` |
| R2 | R2-6 | Platform console real | T-FEAT-25, 26, T-SEC-02 | DONE | `platformApi` (metrics, sessions, suspend/activate), `platform/tenants`, `platform/support-sessions` |
| R2 | R2-7 | Admin screens | — | DONE | `/admin/users`, `/admin/users/new`, `/admin/users/[id]`, `/admin/students/import`, `/admin/branches`, `/admin/settings` |
| R3 | R3-1 | ContentAccessPolicy | T-SEC-07, C-05 | DONE | Authoritative `ContentAccessPolicy`, `ContentAccessDecision` VO, attached to courses/lessons, 403 on locked content |
| R3 | R3-2 | Enrollment rules | T-SEC-07 | DONE | `EnrollmentController` checks free course or valid entitlement, denies unauthorized self-enrollment |
| R3 | R3-3 | Payment proof upload | T-FEAT-21 | DONE | Multipart file upload (jpeg/png/pdf, ≤5MB), private local storage, authenticated proof endpoint `GET /payment-requests/{id}/proof` |
| R3 | R3-4 | Packages & manual entitlements API | T-FEAT-22 | DONE | `PackageController` (update, archive), `EntitlementController` (grant, revoke with audit log), `/me/subscriptions`, `/me/entitlements` |
| R3 | R3-5 | Student billing UI | T-FEAT-20 | DONE | `/student/plans` (catalog), `/student/plans/[id]/pay` (upload proof), `/student/payments` (history), `/student/subscriptions` (active access) |
| R3 | R3-6 | Admin/finance billing UI | — | DONE | `/teacher/payments` (review queue & proof viewer), `/admin/packages` (CRUD & sync entitlements), `/admin/users/[id]` (student entitlements) |
| R3 | R3-7 | Approval side effects | T-FEAT-23 | DONE | `PaymentReviewService::approve` activates subscription, grants entitlements, auto-enrolls student into matching courses |
| R4 | R4-1 | Content model | T-FEAT-02 | DONE | `course_modules`, `lessons` updates, `lesson_materials`, backfill |
| R4 | R4-2 | Content API | T-FEAT-01 | DONE | `CourseModuleController`, `CourseController` outline, `LessonController`, `LessonMaterialController` |
| R4 | R4-3 | Google Drive real (needs Google project) | T-FEAT-06, 07, 08 | BLOCKED | Awaiting Google Cloud project credentials from owner (OAuth web client, Drive API) |
| R4 | R4-4 | Video events & progress | T-FEAT-03 | DONE | `ProgressAggregator`, `VideoEventController`, heartbeat batching, abuse signals, 9 feature tests PASS |
| R4 | R4-5 | Course Builder UI | T-FEAT-04 | DONE | `/teacher/courses` grid & creation, `/teacher/courses/[id]` full Course Builder workspace |
| R4 | R4-6 | Course Player UI | T-FEAT-05, 09 | DONE | `/student/courses/[id]` overview, `/student/courses/[id]/lessons/[lessonId]` distraction-free player with watermark |
| R4 | R4-7 | Remove simulated AI Tutor | T-FEAT-33 | DONE | Removed `setTimeout` canned chat from student courses; clean catalog & progress tracking |
| R5 | R5-1 | Student QR token | T-SEC-10 | DONE | Dynamic HMAC-SHA256 60s token, URL-safe, tenant-bound, credential verified |
| R5 | R5-2 | Scan endpoint validation | T-SEC-10 | DONE | Multi-step strict verification sequence, idempotent duplicate scans, branch scoped |
| R5 | R5-3 | Session QR | — | DEFERRED (OD-4) | Classroom projection mode deferred in favor of student card scanner |
| R5 | R5-4 | Corrections & modes | T-FEAT-16 | DONE | Mandatory reason on corrections, `attendance_record_changes` audit table, session lifecycle |
| R5 | R5-5 | Student "My Card" | T-FEAT-13 | DONE | `/student/card` high-visibility digital ID card, 60s auto-refresh QR, screen brightness hint |
| R5 | R5-6 | Mobile scanner | T-FEAT-13, 14 | DONE | `/teacher/attendance/scan/[sessionId]` mobile camera scanner, haptic, audio chime, manual fallback |
| R5 | R5-7 | Offline structure screens | T-FEAT-15 | DONE | `/teacher/classes`, `/teacher/classes/[id]`, `/teacher/sessions`, `/teacher/sessions/[id]`, `/student/attendance` |
| R6 | R6-1 | Exam lifecycle | T-FEAT-17 | DONE | States `draft` => `published` => `closed` => `archived`, pre-publishing validation (≥1 question, points > 0) |
| R6 | R6-2 | Server-authoritative timing | T-SEC-11 | DONE | `expires_at = min(started + duration, closes_at)`, late answers rejected (422), auto-submit, idempotent |
| R6 | R6-3 | Questions API + bank | T-FEAT-18 | DONE | 5 question types, normalized short answer, essay manual grade, reordering, question bank & batch import |
| R6 | R6-4 | Assignment file submissions | T-FEAT-18 | DONE | File upload, private tenant storage, late policy & penalty, secure file download endpoint |
| R6 | R6-5 | Builders & grading UI | T-FEAT-17, 19, T-UX-05 | DONE | `/teacher/courses/[id]/exams/[examId]/builder`, `/teacher/grading` inbox, resolved T-UX-05 `count: 0` placeholder |
| R6 | R6-6 | Student assessment UI | — | DONE | `/student/assessments`, `/student/courses/[id]/exams/[examId]/take` (synced timer, autosave), results & assignment pages |
| R7A | R7-0a | Tokens & themes | T-UX-03 | DONE | `tokens.css`, Tailwind v4 `@theme`, `theme-context.tsx`, `ThemeProvider` |
| R7A | R7-0b | Primitives & patterns | T-UX-10, 08 | DONE | 24+ accessible primitives in `src/components/ui/`, `/components` dev-only |
| R7A | R7-1 | App Shell | T-UX-07, 04 | DONE | Unified `AppShell` with responsive topbar, desktop sidebar with Sadu, mobile bottom nav + drawer, deleted dead layouts |
| R7A | R7-2 | Break up God pages | T-UX-06 | DONE | Decomposed payments, packages, credentials, platform, student/teacher dashboard, attendance into `features/` (all ≤220 lines) |
| R7A | R7-3 | Detail page pattern | T-UX-09 | DONE | `src/components/layout/detail-layout.tsx` (breadcrumbs, identity, badges, actions, tabs, side summary) |
| R7B | R7B | Student experience | Master §70 | DONE | Complete `/student` suite: dashboard, courses, player, assessments, assignments, exams, attendance, smart card, grades, plans, payments, subscriptions, profile & device binding (`docs/recovery-reports/R7B.md`) |
| R7C | R7C | Staff experience | Master §71-72, T-FEAT-30 | DONE | Complete `/staff` & `/teacher` suite: dashboard, student detail, analytics (T-FEAT-30 resolved), courses & exam builder, grading, classes & sessions, live QR scanner, credentials & device audit, assistant workbench (`docs/recovery-reports/R7C.md`) |
| R7D | R7D | Parent experience | Master §73 | DONE | Complete `/parent` suite: dashboard with child switcher, directory `/parent/children`, detail `/parent/children/[id]` (6 tabs, `DetailLayout`, printable report) (`docs/recovery-reports/R7D.md`) |
| R7E | R7E | Tenant admin experience | F8 | TODO | |
| R7F | R7F | Platform, support & public (landing, coupon login) | T-UX-02, Master §74 | TODO | |
| R8 | R8-1 | Domain events & notification service | T-FEAT-28 | TODO | |
| R8 | R8-2 | Notification center UI | T-FEAT-28 | TODO | |
| R8 | R8-3 | Queue | T-FEAT-32 | TODO | |
| R8 | R8-4 | Analytics honesty | T-FEAT-29 | TODO | |
| R8 | R8-5 | Reports | T-FEAT-31, 32 | TODO | |
| R8 | R8-6 | Google Meet real (needs Google project) | T-FEAT-10, 11, 12 | TODO | |
| R8 | R8-7 | Platform metrics | T-FEAT-27 | TODO | |
| R9 | R9-1 | E2E suite | T-QA-03 | TODO | |
| R9 | R9-2 | Contract tests | T-QA-04 | TODO | |
| R9 | R9-3 | Role matrix in CI | T-QA-01, 02 | TODO | |
| R9 | R9-4 | Visual QA | — | TODO | |
| R9 | R9-5 | Accessibility | — | TODO | |
| R9 | R9-6 | New release gate | T-QA-05 | TODO | |
| R9 | R9-7 | Repository hygiene | T-QA-06, T-UX-11 | TODO | |
| R9 | R9-8 | Documentation & status | C-09 | TODO | |

## External prerequisites (owner action)

| Needed for | What the owner must provide |
|---|---|
| R4-3, R8-6 | Google Cloud project: OAuth client (web), consent screen, Drive API + Calendar API enabled, redirect URI for the API |
| R8-1 (email) | SMTP credentials (or keep `log` mailer) |
| R0-1 | Set `PLATFORM_ADMIN_TOKEN` in `apps/api/.env` |
| R1-A9 | `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` in `apps/api/.env` |
| R0-9 (if flagged) | Rotate Google client secret in Google Cloud Console |
