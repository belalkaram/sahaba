# R3 — Billing → Access

> **بالعربي:** الاشتراك يتحكم في الوصول للمحتوى فعلًا، الطالب يطلب الدفع من الواجهة ويرفع الإثبات، والإدارة تدير الباقات.
> **Closes:** T-SEC-07, T-FEAT-20, 21, 22, 23 (credential part; notification part in R8), C-05
> **Depends on:** R2. **Decisions:** OD-11, OD-15, OD-7. **Spec:** Master §36-41, FR-SUB-*, FR-BILL-*.

## Tasks

### R3-1 — ContentAccessPolicy
- `App\Domain\Billing\Services\ContentAccessPolicy` with `canAccessCourse`, `canAccessLesson`, `canAccessMedia`, `canAttemptExam`, `canJoinMeeting` returning a decision object `{allowed, reason: 'not_enrolled'|'no_entitlement'|'expired'|'draft'|'ok', required_package_ids}`.
- Rules: staff with scope ⇒ allowed; student ⇒ content `published` AND (lesson `is_free_preview` OR (active enrollment AND active entitlement covering the course/module type per package entitlements)).
- Define entitlement keys clearly (document in ADR): e.g. `course:{id}`, `package_type:online|offline|hybrid`, `all_courses`. Update `PackageEntitlement` usage accordingly.
- Apply in Course/Lesson/Media(embed)/Exam(start)/Meeting(join) controllers. Listing endpoints return items with `access: {allowed, reason}` so the UI can show locks instead of hiding.
- Error code `ACCESS_REQUIRES_SUBSCRIPTION` (403) with `required_package_ids`.
- Tests: unpaid student ⇒ locked; approved payment ⇒ unlocked; expired entitlement ⇒ locked; free preview ⇒ allowed.

### R3-2 — Enrollment rules (OD-15)
- Remove open self-enroll. Add `courses.is_free` (migration). Self-enroll only if `is_free`. Payment approval creates enrollments for entitled courses. Staff enrollment via `enrollments.create` (scoped).

### R3-3 — Payment proof upload
- `POST /payment-requests` accepts multipart `proof` (image/pdf, ≤5MB, mime-checked) stored on private disk (OD-11) under tenant path; `GET /payment-requests/{id}/proof` returns a temporary signed URL (≤5 min) after authorization.
- Remove `proof_url` free text (keep column for legacy, unused).

### R3-4 — Packages & manual entitlements API
- `PUT /packages/{id}`, `POST /packages/{id}/archive`, packages include entitlements editor payload — `packages.manage`.
- `POST /students/{id}/entitlements` (grant with reason/expiry), `POST /entitlements/{id}/revoke` (reason) — `entitlements.grant/revoke`, audited.
- `GET /me/subscriptions`, `GET /me/entitlements` for students.

### R3-5 — Student billing UI
- `/student/plans`: packages with what they unlock.
- `/student/plans/[id]/pay`: form (method InstaPay/cash/bank transfer, sender phone, reference, proof upload with preview), submit, success state.
- `/student/payments`: my requests with status timeline (submitted ⇒ under review ⇒ approved/rejected with reason).
- `/student/subscriptions`: active subscriptions, expiry, what is unlocked.
- Locked content anywhere shows a lock + "اشترك للوصول" linking to the right package.

### R3-6 — Admin/finance billing UI
- `/staff/payments` (finance/permitted): review queue with filters, detail split view (proof preview via signed URL, student info, package, history), approve/reject with reason presets, confirmation dialog, audit trail.
- `/admin/packages`: CRUD + entitlements editor + archive.
- Student detail page (R2) gets a "Subscriptions & access" tab with grant/revoke.

### R3-7 — Approval side effects
- On approval (inside `PaymentReviewService`, transactional): subscription + entitlements + enrollments + optional credential issuance if tenant setting `auto_issue_credential_on_approval` is on; dispatch domain event `PaymentApproved` (consumed in R8 for notifications).

## Acceptance criteria (E2E)

- [ ] Unpaid student sees locked course and cannot open lesson/video by URL or API.
- [ ] Student submits payment with proof ⇒ finance approves ⇒ student content unlocks without re-login.
- [ ] Rejection shows reason to the student.
- [ ] Proof file inaccessible without authorization (direct URL test).
- [ ] All standard commands pass.
