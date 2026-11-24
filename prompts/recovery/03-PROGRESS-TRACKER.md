# Progress Tracker â€” Recovery Program

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
| R1B | R1-B6 | Data-state layer, remove swallowed errors | T-UX-01 | DONE | `src/components/ui/data-state.tsx`; 2026-11-24: the 7 swallowed-error sites fixed (admin/capacity, platform/payments, student/assignments, student/plans/[id]/pay, staff scan, student/card, teacher/classes/[id]); tsc + lint:design pass, ESLint 0 errors; not checked in the browser. Remaining outside the list: `notifications/page.tsx` mark-as-read `.catch(() => undefined)`; ~15 `catch {}` that set a message are not swallowing |
| R1B | R1-B7 | 401 handling | T-SEC-13 | DONE | `src/lib/api-client.ts`, `token-store.ts` cookie mirror |
| R1B | R1-B8 | Role management screens | FR-AUTHZ-004 | DONE | `src/app/admin/roles/page.tsx`, `src/app/admin/layout.tsx` |
| R1B | R1-B9 | Playwright + role navigation tests | T-QA-03 | DONE | `apps/web/tests/access-model.test.ts` (7 tests PASS), `support-session-banner.tsx` |
| R2 | R2-1 | Users API | T-FEAT-34 | DONE | `UserManagementApiTest` |
| R2 | R2-2 | CSV import | â€” | DONE | `StudentImportTest` |
| R2 | R2-3 | Branches & classrooms API | T-FEAT-15 | DONE | `BranchClassroomApiTest` |
| R2 | R2-4 | Tenant provisioning service | T-RBAC-03, C-11 | DONE | `TenantProvisioningTest` |
| R2 | R2-5 | Real self-registration | T-FEAT-24 | DONE | `SchoolRegistrationController`, `TenantProvisioningTest` |
| R2 | R2-6 | Platform console real | T-FEAT-25, 26, T-SEC-02 | PARTIAL | `PlatformTenantApiTest`, `PlatformIdentityTest`, `PlatformSettingsAndContactTest`; platform login UI added 2026-11-04; no E2E |
| R2 | R2-7 | Admin screens | â€” | PARTIAL | `/admin/users`, `/admin/branches`, `/admin/students/import` exist; no E2E |
| R3 | R3-1 | ContentAccessPolicy | T-SEC-07, C-05 | DONE | `ContentAccessPolicyTest` |
| R3 | R3-2 | Enrollment rules | T-SEC-07 | DONE | `ContentAccessPolicyTest::test_student_cannot_self_enroll_in_paid_course_without_entitlement` |
| R3 | R3-3 | Payment proof upload | T-FEAT-21 | DONE | `ContentAccessPolicyTest::test_payment_proof_upload_and_authorized_access` |
| R3 | R3-4 | Packages & manual entitlements API | T-FEAT-22 | DONE | `ContentAccessPolicyTest::test_manual_entitlement_grant_and_revoke_with_audit`, `BillingGateTest` |
| R3 | R3-5 | Student billing UI | T-FEAT-20 | PARTIAL | `/student/plans`, `/student/payments`, `/student/subscriptions` exist; no E2E |
| R3 | R3-6 | Admin/finance billing UI | â€” | PARTIAL | `/teacher/payments`, `/admin/packages` exist; no E2E |
| R3 | R3-7 | Approval side effects | T-FEAT-23 | DONE | `ContentAccessPolicyTest::test_approved_payment_unlocks_content_and_auto_enrolls_student` |
| R4 | R4-1 | Content model | T-FEAT-02 | DONE | `course_modules`, `lessons` updates, `lesson_materials`, backfill |
| R4 | R4-2 | Content API | T-FEAT-01 | DONE | `CourseModuleController`, `CourseController` outline, `LessonController`, `LessonMaterialController` |
| R4 | R4-3 | Google Drive real (needs Google project) | T-FEAT-06, 07, 08 | BLOCKED | Awaiting Google Cloud project credentials from owner (OAuth web client, Drive API) |
| R4 | R4-4 | Video events & progress | T-FEAT-03 | DONE | `ProgressAggregator`, `VideoEventController`, heartbeat batching, abuse signals, 9 feature tests PASS |
| R4 | R4-5 | Course Builder UI | T-FEAT-04 | DONE | `/teacher/courses` grid & creation, `/teacher/courses/[id]` full Course Builder workspace |
| R4 | R4-6 | Course Player UI | T-FEAT-05, 09 | DONE | `/student/courses/[id]` overview, `/student/courses/[id]/lessons/[lessonId]` distraction-free player with watermark |
| R4 | R4-7 | Remove simulated AI Tutor | T-FEAT-33 | DONE | Removed `setTimeout` canned chat from student courses; clean catalog & progress tracking |
| R5 | R5-1 | Student QR token | T-SEC-10 | DONE | `SecureAttendanceQrAndLifecycleTest` |
| R5 | R5-2 | Scan endpoint validation | T-SEC-10 | DONE | `SecureAttendanceQrAndLifecycleTest` |
| R5 | R5-3 | Session QR | â€” | DEFERRED (OD-4) | |
| R5 | R5-4 | Corrections & modes | T-FEAT-16 | DONE | `SecureAttendanceQrAndLifecycleTest::test_attendance_correction_requires_reason_and_audit_history` |
| R5 | R5-5 | Student "My Card" | T-FEAT-13 | PARTIAL | `/student/card` exists; no E2E |
| R5 | R5-6 | Mobile scanner | T-FEAT-13, 14 | DONE | `/staff/attendance/scan/[sessionId]`, `CameraAttendanceScanTest`, `useQrScanner` |
| R5 | R5-7 | Offline structure screens | T-FEAT-15 | PARTIAL | `/admin/branches`, `/teacher/classes`, `/teacher/sessions` exist; no E2E |
| R6 | R6-1 | Exam lifecycle | T-FEAT-17 | DONE | `AssessmentLifecycleAndServerTimingTest` |
| R6 | R6-2 | Server-authoritative timing | T-SEC-11 | DONE | `AssessmentLifecycleAndServerTimingTest` |
| R6 | R6-3 | Questions API + bank | T-FEAT-18 | DONE | `AssessmentLifecycleAndServerTimingTest::test_question_bank_crud_and_import_to_exam` |
| R6 | R6-4 | Assignment file submissions | T-FEAT-18 | DONE | `AssessmentLifecycleAndServerTimingTest::test_assignment_file_submission_and_secure_download` |
| R6 | R6-5 | Builders & grading UI | T-FEAT-17, 19, T-UX-05 | PARTIAL | exam builder and `/teacher/grading` exist; no E2E |
| R6 | R6-6 | Student assessment UI | â€” | PARTIAL | `/student/exams`, exam take/results exist; no E2E |
| R7A | R7-0a | Tokens & themes | T-UX-03 | PARTIAL | `styles/tokens.css`, `lint:design` guard, light/dark checked on sample pages; no Playwright screenshots, no axe |
| R7A | R7-0b | Primitives & patterns | T-UX-10, 08 | PARTIAL | `components/ui/*`, dev-only `/components`; keyboard/axe not audited |
| R7A | R7-1 | App Shell | T-UX-07, 04 | PARTIAL | `components/layout/app-shell.tsx`, checked 1280 and 390 on sample pages; no E2E |
| R7A | R7-2 | Break up God pages | T-UX-06 | PARTIAL | `features/*` for some pages; 39 `.tsx` files still > 300 lines (largest: exam builder 1162, `admin/users` 1043, `teacher/courses/[id]` 969, `staff/sessions/[id]` 890) - 2026-11-16 |
| R7A | R7-3 | Detail page pattern | T-UX-09 | PARTIAL | `components/layout/detail-layout.tsx`; not used on every detail page |
| R7B | R7B | Student experience | Master Â§70 | PARTIAL | codemod + sample visual check only; `docs/recovery-reports/R7B.md` |
| R7C | R7C | Staff experience | Master Â§71-72, T-FEAT-30 | PARTIAL | codemod + nav links added 2026-11-04; `docs/recovery-reports/R7C.md` |
| R7D | R7D | Parent experience | Master Â§73 | PARTIAL | codemod only; `docs/recovery-reports/R7D.md` |
| R7E | R7E | Tenant admin experience | F8 | PARTIAL | `/admin`, `/admin/audit` checked in browser; `/admin/integrations` shows "not available" (no status endpoint); `docs/recovery-reports/R7E-R7F.md` |
| R7F | R7F | Platform, support & public (landing, coupon login) | T-UX-02, Master Â§74 | PARTIAL | Landing, login + access code, contact, platform login/audit/settings; `PlatformSettingsAndContactTest`; `docs/recovery-reports/R7E-R7F.md` |
| R7G | UX-R7G | Dark theme, logo, chrome, secure exam, images, public academy pages | owner request (outside audit IDs) | PARTIAL | `PublicAcademyAndImagesTest` (8 tests); tsc/build/lint:design pass; real fullscreen + tab-switch not verified; `docs/recovery-reports/UX-R7G.md` |
| REG | REG-1 | Student self-registration (Saudi) | owner request | PARTIAL | `StudentRegistrationTest` (10 tests); UI checked to step 2 only, no end-to-end browser run (local API pointed at remote DB); `docs/recovery-reports/REG-1.md` |
| R8 | R8-1 | Domain events & notification service | T-FEAT-28 | DONE | `NotificationEventsTest` |
| R8 | R8-2 | Notification center UI | T-FEAT-28 | PARTIAL | Bell, `/notifications`, preferences; no E2E; `docs/recovery-reports/R8.md` |
| R8 | R8-3 | Queue | T-FEAT-32 | PARTIAL | Jobs + real worker run; CSV import still synchronous; scheduler not run in Docker |
| R8 | R8-4 | Analytics honesty | T-FEAT-29 | PARTIAL | `ReportsAnalyticsMeetingsR8Test`; course/class analytics API only; no metrics definitions UI |
| R8 | R8-5 | Reports | T-FEAT-31, 32 | PARTIAL | `ReportsAnalyticsMeetingsR8Test`; CSV + print verified; PDF pending library approval |
| R8 | R8-6 | Google Meet real (needs Google project) | T-FEAT-10, 11, 12 | BLOCKED (Google credentials) | Manual links + join enforcement tested in `ReportsAnalyticsMeetingsR8Test`; real Google events not done |
| R8 | R8-7 | Platform metrics | T-FEAT-27 | DONE | `ReportsAnalyticsMeetingsR8Test::test_platform_metrics_come_from_snapshots_and_include_queue_health` |
| R9 | R9-1 | E2E suite | T-QA-03 | PARTIAL | `apps/web/e2e/flows.spec.ts` (16 flows: sign-in per role, payment->access, QR attendance, exam, provisioning, course build/watch/resume, proof upload, access code, support session), `lms:seed-e2e`, CI job `e2e`; not run in the 2026-11-16 review; no notifications/R5 mobile-scanner E2E |
| R9 | R9-2 | Contract tests | T-QA-04 | PARTIAL | `OpenApiCoverageTest` PASS (route coverage); no response-shape tests vs OpenAPI; no TS types generated from OpenAPI in CI |
| R9 | R9-3 | Role matrix in CI | T-QA-01, 02 | PARTIAL | `RoleMatrixTest` runs inside `php artisan test` and CI `backend` job (346/346 PASS 2026-11-16); matrix fixture not asserted against `config/authorization.php` for every endpoint |
| R9 | R9-4 | Visual QA | â€” | PARTIAL | `apps/web/e2e/route-matrix.spec.ts` screenshots per route x theme x width; 422 files under `docs/recovery-reports/visual/` (2026-11-04/05); not re-run since; Quality Gate 38 checklist not filled |
| R9 | R9-5 | Accessibility | â€” | PARTIAL | axe (critical/serious) in `route-matrix.spec.ts` + L7 landing run clean on 4 pages x 2 themes x 2 widths; full-route run not repeated since 2026-11-05 |
| R9 | R9-6 | New release gate | T-QA-05 | PARTIAL | `scripts/release-gate.mjs` (+ .ps1/.sh wrappers) with pint, phpunit, audits, tsc, lint, build, E2E, coverage-matrix and landing-sample checks; `release-evidence.json` still the stale 2026-10-30 PRODUCTION_READY file until the gate is re-run; gate currently fails on matrix 63 (God Files) and `sample: true` (14) |
| R9 | R9-7 | Repository hygiene | T-QA-06, T-UX-11 | PARTIAL | tenant test DBs not in git (0 tracked); `offline.html` is in the service-worker precache; one `file:///` link remains in `06-status-and-docs-corrections.md`; duplicate-spec note in `docs/00-INDEX.md` not verified |
| R9 | R9-8 | Documentation & status | C-09 | PARTIAL | coverage matrix refreshed 2026-11-16; `current-state.md` still lists M14 as PRODUCTION_READY; `docs/recovery-reports/R9.md` not written |
| DB | DB-1 | PostgreSQL (Neon) enablement, provider portability, DB audit | — | PARTIAL | ADR-002, `docs/audit/2026-11-05-database-audit/README.md`; verified on local Postgres 16 (SQLite 200/200; Postgres 199/200 then fix re-verified); Neon deployment NOT VERIFIED (network blocked) |

### Program 2026-11-05 (plan: `docs/plans/2026-11-05-platform-console-tenancy-venues-qr-plan.md`, order = plan Â§3)

| Phase | Task | Title | Closes | Status | Evidence |
|---|---|---|---|---|---|
| PS | PS-1 | Platform create-tenant form: no default password, send domain, owner name | F-5 | DONE | PlatformTenantProvisioningSecurityTest (7 tests PASS), create-tenant-modal.tsx, page.tsx |
| PS | PS-2 | Teacher photo and public profile on `/a/{slug}` and `/`, cache-busting, branding refresh | F-1..F-4 | DONE | `PublicDirectoryAndBrandingTest` (4 tests PASS), `PublicAcademyAndImagesTest` (8 tests PASS), landing `PublicTeachersSection`, `refreshSession` |
| P1 | P1 | Tenant types, simple teacher UI, service selection (ADR-002) | OD-23, 24, 31, F-6 | DONE | `ADR-002`, `TenantTypeProfileTest` (7 tests PASS), `apps/web/tests/access-model.test.ts` (11 tests PASS), `TenantModulesModal`, `convertToOrganization` |
| P6 | P6 | Camera QR attendance on all browsers | OD-29, R5-6 | DONE | `CameraAttendanceScanTest` (6 tests PASS), `useQrScanner` (BarcodeDetector + ZXing lazy fallback), `/staff/attendance/scan`, 30s undo, auto-absent |
| P8 | P8 | Offline service: student mode, assistant workspace, homework checks, paper scores | OD-32 | DONE | `OfflineServiceTest` (8 tests PASS), `apps/web/tests/access-model.test.ts` (13 tests PASS), `/staff/sessions/[id]`, `offline_homework_checks`, `offline_assessments`, printable card |
| P9 | P9 | Mandatory parent link, notification routing, WhatsApp adapter | OD-33, F-10 | DONE | ParentLinkRequiredTest (7 tests PASS), NotificationRoutingTest (7 tests PASS), WhatsAppChannelTest (7 tests PASS), admin users/new & /admin/users unlinked view |
| P4 | P4 | Student 10 SAR/month manual payment reviewed by the super admin (ADR-004) | OD-27, F-17 | DONE | `ADR-004`, `PlatformPaymentReviewTest` (6 tests PASS), `BillingGateTest` (1 test PASS), `/platform/payments` review inbox, `/pricing` updated, read-only teacher payments |
| P2 | P2 | Leads inbox; organization sign-up reviewed first | OD-26 | TODO | |
| P3 | P3 | Full platform console incl. student PII with audit (ADR-005), +PS-4 | OD-28, F-11, F-12 | TODO | |
| P5 | P5 | Places, external centers, halls, recurring schedule, conflicts | OD-30 | TODO | |
| PS | PS-3 | Exam creation UI and question-bank management | F-7..F-9 | PARTIAL | Exam creation UI added 2026-11-06 (`features/assessment/create-exam-form.tsx`), checked in the browser as teacher: create, add question, publish; no E2E test; question-bank management not reviewed |
| P7 | P7 | Global staff identity and workspace switcher (ADR-003) | OD-25 | TODO | |
| AS | AS-1 | Separate exams and assignments pages with counters, filters, grading links | owner request (outside audit IDs) | PARTIAL | `AssessmentOverviewTest`; checked in the browser as teacher on seeded data (filter, submissions dialog, grading, grading deep link, phone width); not checked with large data, as admin, or on Postgres; no E2E test |
| PS | PS-5 | Analytics UI, credential activation, live landing numbers | F-13, F-15, F-18 | TODO | |
| PS | PS-6 | CI guard: unused API methods and routes | â€” | TODO | |
| LANDING-V2 | L0 | Landing foundation: server page + ISR, proxy redirect, no-flash motion island, FAQ, env | owner request (`docs/design/LANDING-REDESIGN-PLAN.md`) | DONE | `docs/recovery-reports/LANDING-V2.md` (Playwright checks, production build) |
| LANDING-V2 | L1 | Public directory API: academies, teacher paging/filters, public stats | same | DONE | `PublicShowcaseDirectoryTest` (8 tests), `PublicDirectoryAndBrandingTest`, `docs/recovery-reports/LANDING-V2.md` |
| LANDING-V2 | L2 | Hero, trust strip, header | same | DONE | `docs/recovery-reports/LANDING-V2.md` (production build: LCP 0.46s/1.1s, CLS 0, no frame > 32ms) |
| LANDING-V2 | L3 | Story sections (problem/solution, online/offline, roles, security, analytics) | same | DONE | `docs/recovery-reports/LANDING-V2.md` |
| LANDING-V2 | L4 | Academies and teachers sections + `/academies`, `/teachers` | same | DONE | `docs/recovery-reports/LANDING-V2.md`; both pages build static with 5m revalidate |
| LANDING-V2 | L5 | `/a/[slug]` pages upgrade + view transitions | same | PARTIAL | Page rebuilt + `GET /public/academy/profile`; view transitions not added (see report) |
| LANDING-V2 | L6 | Pricing, FAQ, CTA, footer | same | DONE | `docs/recovery-reports/LANDING-V2.md` |
| LANDING-V2 | L7 | Verification: Playwright matrix, axe, Lighthouse, performance trace | same | PARTIAL | axe clean on 4 pages x 2 themes x 2 widths, LCP/CLS/scroll measured on a production build; Lighthouse itself not run |
| AUD | UX-AUDIT-1 | User-journey & UI/UX audit for all six roles (static) | owner request | DONE | `docs/audit/2026-11-12-user-journey-ux-audit/README.md` (15 findings J-01..J-15, 2 x P0; fixes not started) |
| AUD | UX-FIX-1 | P0 journey fixes: mobile login field, academy code + login link after registration, request-status page | J-01, J-02 | DONE | Browser E2E on local sqlite 2026-11-12: `/register` 6 steps -> done screen shows academy code + reference -> `/register/status` pending -> staff approve (API) -> approved + login link -> `/login?tenant=` with mobile in Arabic-Indic digits -> `/student/dashboard`; status page checked at 375 px; tsc, eslint (0 errors), lint:design pass; no automated E2E test |
| AUD | ATT-1 | Per-academy minimum attendance rate (setting, backend exam gate, parent/student UI) | OD-35, J-03 | DONE | `ExamAttendanceGateTest` (4 tests PASS); `/admin/academic-settings` switch + value; parent pages show only the academy's rule (invented 75% text removed); overall rate used because classes have no course link (J-16); not checked in the browser |
| AUD | ANN-1 | Academy announcements: exact audience, once/persistent, bell/banner/modal, seen/closed receipts | OD-37 | DONE | `AnnouncementTest` (7 tests PASS); `/teacher/announcements` (compose with live audience count + preview, list with seen %, recipients drawer, withdraw); `AnnouncementHost` in AppShell; browser 2026-11-12 on local sqlite: admin published a modal to one student -> student saw it, Escape/backdrop did not close it, × closed it, seen+dismiss receipts recorded, `once` did not return; banner/persistent covered by tests only; no E2E |
| AUD | CAP-1 | Seat quota (student = code), capacity requests, super-admin grant | OD-38, OD-39, ADR-006 | DONE | `CapacityTest` (6 tests PASS), full suite 320/321 then OpenAPI regenerated (`OpenApiCoverageTest` PASS); `/admin/capacity`, `/platform/capacity`; browser 2026-11-12 on local sqlite: quota initialised to usage (2/2) -> request 20 seats with proof -> super admin granted 15 -> 2/17; no E2E; PLAT-FEE-1 still open |
| AUD | PLAT-FEE-1 | Retire the student 10 SAR platform-fee flow | OD-39, ADR-006 | DONE | `PlatformPaymentReviewTest::test_package_less_platform_fee_payment_is_refused` + updated pricing test; full suite 322/322 (sqlite); `/pricing` rewritten for seats (checked in browser); package payments unchanged, still reviewed by the super admin (OD-34 open question) |
| AUD | PAY-REV-1 | Academy reviews its own package payments; platform console refuses them | OD-34 | DONE | full suite green on sqlite (346/346 on 2026-11-16); NO dedicated test for the platform 403 yet; academy review page `/teacher/payments` existed |
| AUD | PAY-UX-1 | Student UI labels each payment as academy package or platform fee; nav/KPI wording per ADR-004 | OD-34, J-06, J-07 | TODO | |
| TL | TL-0 | Tenant landing: ADR-007 accepted, OD-41..OD-46 decided | owner request (`docs/design/TENANT-LANDING-THEMES-PLAN.md`) | DONE | Plan + ADR-007 accepted 2026-11-13; OD-41..OD-46 decided |
| TL | TL-1 | Backend: `tenant_landing_settings`, `TenantLandingService`, admin + public routes, `tenant.branding` granted, OpenAPI | ADR-007 | PARTIAL | migration + model + service + controller + 5 routes + 15 tests pass (346/346 on 2026-11-16) - code is UNTRACKED in git (not committed) |
| TL | TL-2 | Theme engine: `deriveTenantTheme` (AA enforced, dark derived), server-injected tokens, `/a/[slug]` layout to Server + ISR tag | ADR-007 | PARTIAL | `lib/theme/derive-tenant-theme.ts` tests pass (37/37), layout is a Server Component with ISR tag - code UNTRACKED in git |
| TL | TL-3 | Template system (manifests, registry), current design moved to `oasis`, fixed `PoweredByFooter` | ADR-007, OD-46 | PARTIAL | templates registry, manifests, `PoweredByFooter` - code UNTRACKED in git; `tsc` clean 2026-11-16 |
| TL | TL-4 | Templates `beacon`, `breeze`, `atlas`, `horizon` | ADR-007 | PARTIAL | beacon/breeze/atlas/horizon headers; 2026-11-19 per-template heroes + `templates.css` style the whole page (cards, titles, panels, bands), checked in the browser at 1280px - code UNTRACKED in git; `tsc` clean |
| TL | TL-5 | Editor `/admin/landing`: template picker, 4 colours + presets, live preview (draft token), publish | ADR-007, OD-44 | PARTIAL | editor `/admin/landing` - code UNTRACKED in git; 2026-11-19 preview fixed (draft via LandingShell, LAN-IP server fetch, auto-refresh) and checked in the browser; publish flow not exercised |
| TL | TL-6 | Content sections: cover, about, opt-in contact, FAQ | OD-43 | PARTIAL | About/FAQ/Contact editors; 2026-11-19 sections rendered on `/a/{slug}` and contact fields filtered per opt-in flag (test 16/16) - code UNTRACKED in git; cover image not rendered |
| TL | TL-7 | Verification: 5 templates × light/dark × 390/768/1440, axe, Lighthouse, attribution check, report | ADR-007 | PARTIAL | tsc exit 0, 37/37 node tests, 15/15 PHPUnit, report `docs/recovery-reports/TENANT-LANDING.md`; Playwright 5 templates x light/dark x 390/768/1440, axe and Lighthouse were DEFERRED (not run); commit 85a3a81 holds docs only |

### Recovery review 2026-11-16 (gaps found; none started)

> Priority order for the next sessions: (1) commit the untracked TL code, (2) re-run the full release gate incl. Playwright and write `docs/recovery-reports/R9.md`, (3) close the rows below, (4) resume P2, P3, P5, P7.

| Phase | Task | Title | Closes | Status | Evidence |
|---|---|---|---|---|---|
| REV | REV-1 | Commit the untracked Tenant Landing code (TL-1..TL-6) in logical commits | TL-1..6 | TODO | `git status` shows migration, model, service, controller, `features/tenant-landing`, `lib/theme`, tests as `??` |
| REV | REV-2 | Remove remaining swallowed errors (7 sites) and use `data-state` | T-UX-01 | DONE | 2026-11-24, see R1-B6 row and `docs/recovery-reports/R1B.md` |
| REV | REV-3 | Break up pages > 300 lines (39 files); unblocks the coverage-matrix gate row Master 63 | T-UX-06 | TODO | R7-2 row |
| REV | REV-4 | Student dashboard sessions for every class, not only the first | J-11 | PARTIAL | 2026-11-24: `student/dashboard/page.tsx` loads the sessions of every class (concurrency 4, de-duplicated by id) instead of `classList[0]`; tsc + lint:design pass, ESLint 0 errors. NOT verified: no test with a student in 2 classes, not checked in the browser; still N requests (a single upcoming-sessions endpoint is J-13/P2) |
| REV | REV-5 | Assistant landing/dashboard: use `GET /grading/pending`, gate the assistant nav item by permission | J-04, J-05 | PARTIAL | 2026-11-24: `teacher/assistant/page.tsx` takes the pending count from `GET /grading/pending` (one request, same scope as `/teacher/grading`; "—" when the user lacks `exams.grade` or the call fails) and filters today's sessions from the full list; nav item `admin-assistant` now needs `attendance.scan` / `exams.grade` / `assignments.grade`; test `access-model.test.ts` (38/38 PASS), tsc, lint:design, ESLint clean. NOT done: a landing path by `staff_type` (assistant still lands on `/teacher/dashboard`; teachers with grading permission still see the item); not checked in the browser |
| REV | REV-6 | Replace native `alert()`/`confirm()` with `ConfirmDialog` and toast | J-09 | TODO | same audit |
| REV | REV-7 | Guard `/staff/*` with `ExperienceGuard` and AppShell | J-10 | TODO | same audit |
| REV | REV-8 | Remove the duplicate `/student/assessments`; no full reload from the grades page | J-12 | TODO | same audit |
| REV | REV-9 | Paginated summary endpoint for the admin dashboard | J-13 | TODO | same audit |
| REV | REV-10 | Class to course link or an explicit attendance-by-course decision | J-16 | TODO | same audit |
| REV | REV-11 | Contract tests: response shapes vs OpenAPI and TS types generated in CI | T-QA-04 | TODO | R9-2 row |
| REV | REV-12 | Test for the PAY-REV-1 platform 403 | OD-34 | TODO | PAY-REV-1 row |
| REV | REV-13 | Move `/teacher/*` to `/staff/*` with redirects (OD-8) | OD-8 | TODO | `apps/web/src/app/teacher` has 20 folders, `staff` has 3 |
| REV | REV-14 | Operations phase: deploy, backups and restore drill, monitoring, S3 storage (OD-11), Redis queue (OD-12), SMTP, PDPL notice (OD-28) | release | TODO | no tracker row existed |
| REV | REV-15 | Docs hygiene: duplicate ADR-002 numbering, missing ADR-003/005 files, `file:///` link, mojibake in this file, stale `current-state.md` and `release-evidence.json` | C-09 | TODO | `docs/decisions/` |

## External prerequisites (owner action)

| Needed for | What the owner must provide |
|---|---|
| R4-3, R8-6 | Google Cloud project: OAuth client (web), consent screen, Drive API + Calendar API enabled, redirect URI for the API |
| R8-1 (email) | SMTP credentials (or keep `log` mailer) |
| R0-1 | Set `PLATFORM_ADMIN_TOKEN` in `apps/api/.env` |
| R1-A9 | `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` in `apps/api/.env` |
| P9 (WhatsApp) | Meta WhatsApp Business account: phone number ID, access token, approved message templates |
| P4 | Receiving bank account(s) / IBAN shown to students for the 10 SAR transfer |
| R0-9 (if flagged) | Rotate Google client secret in Google Cloud Console |
