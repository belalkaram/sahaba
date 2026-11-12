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
| R1B | R1-B6 | Data-state layer, remove swallowed errors | T-UX-01 | DONE | `src/components/ui/data-state.tsx` standard states |
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
| R7A | R7-2 | Break up God pages | T-UX-06 | PARTIAL | `features/*` for some pages; several pages still > 300 lines (builder 1110, `teacher/courses/[id]` 914) |
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
| R9 | R9-1 | E2E suite | T-QA-03 | TODO | |
| R9 | R9-2 | Contract tests | T-QA-04 | TODO | |
| R9 | R9-3 | Role matrix in CI | T-QA-01, 02 | TODO | |
| R9 | R9-4 | Visual QA | â€” | TODO | |
| R9 | R9-5 | Accessibility | â€” | TODO | |
| R9 | R9-6 | New release gate | T-QA-05 | TODO | |
| R9 | R9-7 | Repository hygiene | T-QA-06, T-UX-11 | TODO | |
| R9 | R9-8 | Documentation & status | C-09 | TODO | |
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
| AUD | UX-AUDIT-1 | User-journey & UI/UX audit for all six roles (static) | owner request | DONE | `docs/audit/2026-11-12-user-journey-ux-audit/README.md` (15 findings J-01..J-15, 2 x P0; fixes not started) |
| AUD | UX-FIX-1 | P0 journey fixes: mobile login field, academy code + login link after registration, request-status page | J-01, J-02 | DONE | Browser E2E on local sqlite 2026-11-12: `/register` 6 steps -> done screen shows academy code + reference -> `/register/status` pending -> staff approve (API) -> approved + login link -> `/login?tenant=` with mobile in Arabic-Indic digits -> `/student/dashboard`; status page checked at 375 px; tsc, eslint (0 errors), lint:design pass; no automated E2E test |
| AUD | ATT-1 | Per-academy minimum attendance rate (setting, backend exam gate, parent/student UI) | OD-35, J-03 | DONE | `ExamAttendanceGateTest` (4 tests PASS); `/admin/academic-settings` switch + value; parent pages show only the academy's rule (invented 75% text removed); overall rate used because classes have no course link (J-16); not checked in the browser |
| AUD | ANN-1 | Academy announcements: exact audience, once/persistent, bell/banner/modal, seen/closed receipts | OD-37 | DONE | `AnnouncementTest` (7 tests PASS); `/teacher/announcements` (compose with live audience count + preview, list with seen %, recipients drawer, withdraw); `AnnouncementHost` in AppShell; browser 2026-11-12 on local sqlite: admin published a modal to one student -> student saw it, Escape/backdrop did not close it, × closed it, seen+dismiss receipts recorded, `once` did not return; banner/persistent covered by tests only; no E2E |
| AUD | CAP-1 | Seat quota (student = code), capacity requests, super-admin grant | OD-38, OD-39, ADR-006 | DONE | `CapacityTest` (6 tests PASS), full suite 320/321 then OpenAPI regenerated (`OpenApiCoverageTest` PASS); `/admin/capacity`, `/platform/capacity`; browser 2026-11-12 on local sqlite: quota initialised to usage (2/2) -> request 20 seats with proof -> super admin granted 15 -> 2/17; no E2E; PLAT-FEE-1 still open |
| AUD | PLAT-FEE-1 | Retire the student 10 SAR platform-fee flow | OD-39, ADR-006 | DONE | `PlatformPaymentReviewTest::test_package_less_platform_fee_payment_is_refused` + updated pricing test; full suite 322/322 (sqlite); `/pricing` rewritten for seats (checked in browser); package payments unchanged, still reviewed by the super admin (OD-34 open question) |
| AUD | PAY-REV-1 | Academy reviews its own package payments; platform console refuses them | OD-34 | DONE | full suite 322/322 on sqlite (no dedicated test for the 403 yet); academy review page `/teacher/payments` already existed |
| AUD | PAY-UX-1 | Student UI labels each payment as academy package or platform fee; nav/KPI wording per ADR-004 | OD-34, J-06, J-07 | TODO | |

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
