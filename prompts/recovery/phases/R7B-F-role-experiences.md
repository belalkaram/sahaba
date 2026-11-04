# R7B–R7F — Role Experiences (UI/UX Recovery)

> **بالعربي:** إعادة بناء تجربة كل دور فوق بيانات حقيقية: الطالب، الموظفين (مدرس/مساعد/مالية)، ولي الأمر، مدير المؤسسة، المنصة والدعم، والصفحات العامة.
> **Closes:** T-UX-02, 04, 05, 09, T-FEAT-30, Quality Gate F4–F9, Master §70-74
> **Depends on:** R7A and the domain phase under each screen (R2–R6). Run each sub-phase in its own session: **R7B → R7C → R7D → R7E → R7F**.

## Rules for every screen (Quality Gate §5 — Definition of Done)

1. Real data only, via feature hooks; no placeholders presented as data.
2. Permissions via `<Can>`; module-aware.
3. States: loading skeleton, empty (with next action), forbidden, error (retry), success feedback, partial data.
4. Responsive: designed for 390px first, then 768, 1280, 1440.
5. Accessible: keyboard, focus visible, labels, contrast in both themes.
6. Design system primitives only; no one-off styles.
7. Playwright: at least one test per screen covering the primary action.
8. Screenshots in the report: mobile + desktop, light + dark.

Before each sub-phase: list the screens, the backend endpoints each uses, the permissions, and the states (Quality Gate §36 task definition) in the report, then build.

---

## R7B — Student experience (`/student`)

| Screen | Content |
|---|---|
| Home `/student` | Continue learning (last lesson + progress), today/upcoming sessions & live meetings, due assignments & open exams with countdown, attendance summary, latest published grades, subscription/access status with expiry warning, notifications preview, multi-academy switcher (`/student/academies`) |
| Courses `/student/courses`, course, player | From R4 — polish to DoD |
| Assessments | From R6 — polish |
| Attendance `/student/attendance` | Calendar + per-class rates |
| Grades `/student/grades` | By course, trends, feedback |
| My card `/student/card` | From R5 |
| Plans / payments / subscriptions | From R3 |
| Profile & devices | Profile, active device binding, request device change (creates a request for staff) |

## R7C — Staff experience (`/staff`) — teacher, assistant, finance

| Screen | Visible when | Content |
|---|---|---|
| Home `/staff` | always | Built from permissions: today's sessions (start/scan), grading inbox count (R6), pending payments (finance), at-risk students (low attendance/progress from analytics), recent activity |
| Courses & builder | `courses.*` | From R4 |
| Classes, sessions, scanner | `classes.*`, `attendance.*` | From R5 |
| Students `/staff/students`, `/staff/students/[id]` | `students.view` (scoped) | Table with filters; detail: profile, courses & progress, attendance, grades, payments (if permitted), credentials (if permitted), parents, notes/activity |
| Grading `/staff/grading` | `assignments.grade`/`exams.grade` | From R6 |
| Payments review | `payments.approve` | From R3 |
| Credentials & devices | `credentials.*` | Issue (secret shown once with copy/print), revoke, device unbind requests queue |
| Meetings | `meetings.*` | From R8 |
| Analytics `/staff/analytics` | `analytics.view` | Course/class/student analytics from real snapshots (remove hardcoded student UUID — T-FEAT-30) |

Assistant (OD-2) gets the same experience filtered by permissions — verify with the assistant demo user that the navigation shows only scanner/assigned students/allowed items.

## R7D — Parent experience (`/parent`)

| Screen | Content |
|---|---|
| Home `/parent` | Child switcher (from `/me/children`), per child: attendance this week, upcoming sessions/exams, latest published grades, progress, payment/subscription status, alerts |
| Child `/parent/children/[id]` | Tabs: attendance, grades, progress, reports, teachers contact (if enabled) |
| Reports | Download parent reports (R8) |

## R7E — Tenant admin experience (`/admin`)

| Screen | Content |
|---|---|
| Home `/admin` | KPIs (active students, staff, active subscriptions, revenue pending/approved this month, attendance rate, content published), alerts (pending payments, expiring subscriptions, inactive students), recent audit activity |
| Users, roles, branches, settings | From R1-B8 and R2-7 — polish to DoD |
| Packages | From R3 |
| Integrations `/admin/integrations` | Google connection status/connect/disconnect (R4-3, R8-6), email status |
| Audit log `/admin/audit` | Filterable table (actor, action, entity, date), detail drawer with payload |
| Reports | From R8 |

## R7F — Platform, support & public

| Screen | Content |
|---|---|
| Platform home `/platform` | Real metrics from `/platform/metrics` (tenants by status, students, staff, storage, activity), health (real), queue health (R8), support sessions active |
| Tenants, tenant detail, provisioning, support | From R2-6 — polish |
| Platform audit `/platform/audit` | Global audit with filters |
| Landing `/` | Real landing page (replace redirect): value proposition for teachers and centers, online/offline/hybrid, security & white-label, pricing link, CTA to register school / login. No fake metrics. |
| Pricing, about, contact, terms, privacy | Review content; contact form posts to a real endpoint or mailto; no fake success |
| Login | Tenant selection (slug or domain), password and coupon modes per tenant `auth_mode` (coupon login UI is missing today), expired-session message, support-code exchange (R0-5) |

## Acceptance criteria per sub-phase

- [ ] Every screen meets the 8 rules above with evidence in `docs/recovery-reports/R7X.md`.
- [ ] Zero hardcoded demo values (`grep` for known demo strings returns nothing).
- [ ] Playwright suite green; screenshots attached.
