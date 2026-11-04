# Recovery Phase R7C Report — Staff & Teacher Experience (`/staff` & `/teacher`)

**Status:** COMPLETE & VERIFIED  
**Date:** 2026-11-02  
**Domain Owner:** Staff & Teacher Learning Operations  
**Closes:** T-UX-03, T-UX-08, T-FEAT-30, OD-2, Master §71-72  
**Depends on:** R7A (Design System & App Shell), R2 (Identity & Devices), R4 (Learning Content & Progress), R5 (Attendance & Secure QR), R6 (Assessment, Exams & Grading).

---

## 1. Executive Summary

Phase R7C completes the full implementation, cleanup, and verification of the Staff and Teacher Experience (`/staff` and `/teacher`):
1. **Source of Truth & Real Data:** All screens bind strictly to real backend APIs (`educationApi`, `assessmentApi`, `attendanceApi`, `credentialsApi`, `analyticsApi`, `adminApi`, and `useAuth()`). Zero mock personas, zero hardcoded demo data, zero mock UUIDs.
2. **Resolution of T-FEAT-30:** Eliminated hardcoded student UUID (`01a0ef9d-5232-7086-9129-5989e81a7dd9`) and hardcoded demo name ("عمر أحمد فاروق") from the teacher analytics dashboard (`/teacher/analytics`). Implemented a real dynamic student selector powered by `educationApi.getStudents()`, enabling teachers to inspect any student's metrics, filter by search query, and trigger instant metric refreshes.
3. **Teaching Assistant Role & Permissions (OD-2 / Master §71-72):** Solidified the Teaching Assistant experience within `/teacher/assistant` and the staff navigation registry. Uses `useCan('attendance.scan')` to conditionally grant scanner access and displays explicit role permission boundaries (assistants have access to attendance scanning and grading, but cannot delete courses or alter billing).
4. **Hardware Device Audit & Protection (Master §64):** Connected the new student detail page (`/teacher/students/[id]`) and the credentials desk (`/teacher/credentials`) with real hardware binding data (`device_fingerprint`, `device_name`, `last_used_at`), enabling staff to inspect device locks and process replacement requests.
5. **Design System & Semantic Tokens:** Replaced legacy ad-hoc utility classes (`text-white`, `text-turquoise`, `bg-turquoise`, `bg-slate-900`, `var(--pri)`) across all teacher screens with semantic tokens (`text-fg`, `text-fg-muted`, `text-primary-fg`, `bg-surface`, `bg-primary`, `bg-success`, `bg-warning`, `bg-danger`, `border-border`). High-contrast light and dark themes render cleanly with zero unreadable text.

---

## 2. Screen-by-Screen Implementation & Inventory

| Route | Backend Endpoints | Key Features & States | Architecture & Design Tokens |
|---|---|---|---|
| `/staff` (Redirect) | — | 307 redirect to `/teacher/dashboard`. Added to protected routes in `middleware.ts`. | Next.js Server Redirect |
| `/teacher/dashboard` | `GET /courses`, `GET /classes`, `GET /students`, `GET /teacher/kpis` | Staff overview dashboard: dynamic KPI metrics, upcoming class sessions, quick action bar, pending grading submissions alert, active courses breakdown. | Modular feature cards, `PageHeader`, `StatCard`, `SkeletonCard`. |
| `/teacher/analytics` | `GET /students`, `GET /analytics/students/{id}/dashboard`, `POST /analytics/students/{id}/refresh` | **Resolved T-FEAT-30**: dynamic student selector dropdown with real search filter, fast metric switching, KPI overview cards, radar progress bars, refresh button. | `PageHeader`, `Card`, `ProgressBar`, `Select`, `EmptyState`. |
| `/teacher/students` | `GET /students` | Student directory: search by name/code, filter by academic grade level, student badges, direct action button to inspect complete student profile. | `PageHeader`, `Card`, `Badge`, `EmptyState`. |
| `/teacher/students/[id]` | `GET /students/{id}`, `GET /analytics/students/{id}/dashboard`, `GET /students/{id}/credentials` | Comprehensive student profile: 4 rich tabs (`overview`, `courses`, `credentials` with hardware fingerprint audit per §64, `parents` with contact details), and side summary progress bars. | `DetailLayout`, `Tabs`, `ProgressBar`, `Badge`, `Card`. |
| `/teacher/courses` | `GET /courses`, `PATCH /courses/{id}` | Course management grid: level filters, modules/lessons count, draft vs published badges, free vs paid badges, one-click publish/unpublish toggle, link to Course Builder. | `PageHeader`, `Card`, `Badge`, `EmptyState`. |
| `/teacher/courses/[id]` | `GET /courses/{id}/outline`, `POST /courses/{id}/modules`, `POST /modules/{id}/lessons`, `POST /lessons/{id}/materials`, `PUT /courses/{id}` | Full Course Builder: modules hierarchy, lesson creation (video, document, text), free preview toggle, materials/attachments uploader, course settings editor, student completion progress table. | `Tabs`, `Modal`, `Input`, `Select`, `ProgressBar`, `Card`. |
| `/teacher/courses/[id]/exams/[examId]/builder` | `GET /courses/{id}/exams/{id}`, `POST /exams/{id}/questions`, `GET /question-banks`, `POST /exams/{id}/import-bank`, `PATCH /exams/{id}` | Interactive Exam Builder: question creation (multiple choice, true/false, short essay), question bank importer modal, student preview mode toggle, publish readiness checklist, publish/close actions. | `PageHeader`, `Card`, `Modal`, `Badge`, semantic tokens. |
| `/teacher/assessments` | `GET /courses`, `GET /courses/{id}/assignments`, `GET /courses/{id}/exams`, `POST .../grade` | Assessments & Submissions management: filter by course, filter by type (assignment/exam), grading modal with score input and feedback notes. | `PageHeader`, `Card`, `Modal`, `Badge`, `EmptyState`. |
| `/teacher/grading` | `GET /grading/pending`, `POST /grading/bulk-publish` | Grading desk: pending student submissions and exam attempts needing manual evaluation, type filter tabs (all, assignments, exams), course filter dropdown, bulk publish grades action. | `PageHeader`, `Card`, `Tabs`, `Badge`, `EmptyState`. |
| `/teacher/classes` & `.../[id]` | `GET /classes`, `POST /classes`, `GET /classes/{id}`, `POST /classes/{id}/students`, `POST /classes/{id}/sessions` | Class groups management: branch and center assignment, student roster management, session scheduler modal, attendance statistics. | `PageHeader`, `Card`, `Modal`, `Badge`, `EmptyState`. |
| `/teacher/sessions` & `.../[id]` | `GET /sessions`, `GET /sessions/{id}`, `POST /sessions/{id}/attendance` | Live session roster: scheduled time, location/branch, student roster with fast-action attendance toggles (`حاضر`, `متأخر`, `غائب`, `معذور`), summary attendance rate. | `PageHeader`, `Card`, `StatCard`, `Badge`. |
| `/teacher/attendance/scan/[sessionId]` | `GET /sessions/{id}`, `POST /attendance/scan` | Secure QR attendance scanner HUD: dynamic viewfinder overlay with scanning beam animation, front/back camera switch, torch toggle, audio/visual scan result feedback. | Viewfinder canvas/DOM overlay, hardware camera controls, semantic tokens. |
| `/teacher/assistant` | `GET /courses`, `GET /sessions`, `GET /grading/pending`, `useCan('attendance.scan')` | Teaching assistant workbench: role permission boundaries per OD-2, dynamic metrics, today's sessions list with direct QR scanner links, grading tasks counter. | `PageHeader`, `StatCard`, `Card`, `Badge`, `EmptyState`. |
| `/teacher/credentials` | `GET /students`, `GET /students/{id}/credentials`, `POST /credentials`, `POST /credentials/{id}/replace-device`, `POST /credentials/{id}/revoke` | Hardware devices & credentials desk: student selector sidebar, active credentials table, device fingerprint inspection, unbind/replace device modal, revoke modal, issue new credential modal. | `PageHeader`, `Card`, `Modal`, `Badge`, `EmptyState`. |
| `/teacher/media` | `GET /media` | Tenant media library: video, document, audio assets management, upload modal with file type validation, embed snippet generator. | `PageHeader`, `Card`, `Modal`, `EmptyState`. |
| `/teacher/meetings` | `GET /meetings`, `POST /meetings` | Live lecture scheduler: meeting list, live meeting start action, creation modal with date/time, duration, and course assignment. | `PageHeader`, `Card`, `Modal`, `EmptyState`. |

---

## 3. Specific Issues Resolved

### 3.1 T-FEAT-30: Hardcoded Student UUID in Teacher Analytics
- **Issue:** `apps/web/src/app/teacher/analytics/page.tsx` had a hardcoded student UUID (`01a0ef9d-5232-7086-9129-5989e81a7dd9`) and hardcoded demo name ("عمر أحمد فاروق").
- **Fix:** Refactored the page to load real students from `educationApi.getStudents()`. Added a searchable dropdown selector to choose any student. When selected, the page fetches real metrics from `analyticsApi.getStudentDashboard(studentId)` and allows instant refresh via `analyticsApi.refreshStudentDashboard(studentId)`.

### 3.2 OD-2 / Master §71-72: Assistant Experience & Permission Invariants
- **Clarification:** The assistant role does not require a separate app route; assistants share the `/teacher` experience, filtered dynamically by permissions in `navigation-registry.ts` and UI `<PermissionGate>` / `useCan()`.
- **Implementation:**
  - Added `useCan('attendance.scan')` to determine QR scanner authorization.
  - Added an educational permission boundary widget in `/teacher/assistant` explaining allowed vs restricted operations.

### 3.3 Semantic Token Migration
- Replaced all lingering occurrences of `text-white`, `text-turquoise`, `bg-turquoise`, and `var(--pri)` in:
  - `apps/web/src/app/teacher/courses/[id]/page.tsx`
  - `apps/web/src/app/teacher/courses/[id]/exams/[examId]/builder/page.tsx`
  - `apps/web/src/app/teacher/grading/page.tsx`
  - `apps/web/src/app/teacher/attendance/scan/[sessionId]/page.tsx`
  - `apps/web/src/app/teacher/courses/page.tsx`
  - `apps/web/src/app/teacher/classes/page.tsx`
  - `apps/web/src/app/teacher/classes/[id]/page.tsx`

---

## 4. Verification Evidence

### 4.1 TypeScript Verification
```powershell
cd apps/web; .\node_modules\.bin\tsc.cmd --noEmit
# Result: 0 errors (PASS)
```

### 4.2 Frontend Unit Tests
```powershell
cd apps/web; npm test -- --run
# Result: 7/7 PASS (100% green)
```

### 4.3 Backend PHPUnit Verification
```powershell
cd apps/api; php vendor/bin/phpunit
# Result: 160/160 tests PASS, 1,774 assertions (100% green)
```

---

## 5. Status Sign-Off

Phase R7C is **COMPLETE & VERIFIED**. All staff and teacher interfaces strictly adhere to architectural boundaries, design system tokens, and real multi-tenant data contracts.
