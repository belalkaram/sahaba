# Recovery Phase R7A Report — Design System & App Shell

**Status:** COMPLETE & VERIFIED
**Date:** 2026-11-02
**Domain Owner:** UI/UX Platform & Design System
**Closes:** T-UX-03, T-UX-06, T-UX-07, T-UX-08, T-UX-10, C-14 (Foundation)

---

## 1. Executive Summary

Phase R7A establishes the design system foundation, universal application shell, and modular architecture across the frontend of the LMS platform:

1. **Tokens & Theme Engine (R7-0a):**
   - Created `apps/web/src/styles/tokens.css` with semantic color variables for both Light and Dark themes (`--surface`, `--surface-raised`, `--surface-sunken`, `--surface-overlay`, `--fg`, `--fg-muted`, `--fg-subtle`, `--fg-inverse`, `--border`, `--border-subtle`, `--border-strong`, `--primary`, `--primary-hover`, `--primary-fg`, `--primary-subtle`, `--secondary`, `--accent`, `--success`, `--warning`, `--danger`, `--info`), border radius scale, elevation shadows, motion durations, and focus rings.
   - Integrated semantic tokens into Tailwind v4 `@theme` in `apps/web/src/app/globals.css`.
   - Replaced forced `data-theme="dark"` from `apps/web/src/app/layout.tsx` with a reactive, client-persisted theme engine (`apps/web/src/context/theme-context.tsx`) supporting `'light' | 'dark' | 'system'` modes with SSR anti-flash script.
   - Wrapped root in `ThemeProvider`.

2. **Primitives & Design Patterns (R7-0b):**
   - Created and exported complete set of 24+ accessible, RTL-first UI primitives in `apps/web/src/components/ui/`:
     - Inputs & Controls: `Textarea`, `Checkbox`, `Radio` (+ `RadioGroup`), `Switch`, `Avatar`, `FileUpload` (drag & drop, preview, size validation, progress).
     - Overlays & Feedback: `Tooltip`, `DropdownMenu`, `Toast` (+ `ToastProvider` & `useToast()`), `ConfirmDialog`, `StatusDot`.
     - Data Display & Layout: `DataTable` (sortable columns, selection, sticky headers, mobile fallback cards), `FilterBar`, `SearchInput` (debounced), `Pagination`, `Breadcrumbs`, `PageHeader`, `Timeline`, `ActivityFeed`, `CalendarWeek`, `ProgressBar` (linear + circular ring), `KpiCard` (value, delta, sparkline).
     - State Handling: `Forbidden` (403), `ErrorState`, `StateView` (unified loading/empty/error/data wrapper).
   - Exported all components from `apps/web/src/components/ui/index.ts`.
   - Restricted `/components` component gallery behind `process.env.NODE_ENV !== 'production'`.

3. **Unified App Shell (R7-1):**
   - Created `apps/web/src/components/layout/app-shell.tsx`: a single unified shell supporting every user experience (admin, staff, student, parent, platform).
   - Sidebar generated dynamically from `navigation-registry.ts` filtered by experience + tenant modules + user permissions.
   - Desktop sidebar features authentic Sadu decorative ribbon, authenticated user profile, and active link states.
   - Top Header features tenant branding (logo, name, slug, active badge), global search placeholder, notifications bell slot (R8), theme toggle (Sun/Moon), and authenticated user menu with logout action.
   - Mobile: Responsive bottom navigation bar displaying top 4 primary links + "المزيد" (More) trigger opening a full-featured slide-out navigation drawer.
   - Deleted dead redundant layout files:
     - `apps/web/src/components/layout/teacher-nav-layout.tsx`
     - `apps/web/src/components/layout/student-nav-layout.tsx`
     - `apps/web/src/components/layout/parent-nav-layout.tsx`
     - `apps/web/src/components/layout/platform-nav-layout.tsx`
   - Eliminated all hardcoded identities and fallbacks ("سلطان الغامدي", "معلم رياضيات", "زائر") in favor of canonical authenticated user data from `useAuth()`.

4. **Decomposition of God Pages (R7-2):**
   - Decomposed giant monolithic pages into modular feature folders under `apps/web/src/features/<feature>/components/`:
     - `payments`: `PaymentStats`, `PaymentTable`, `PaymentInspectionDrawer`, `PaymentApprovalModal`, `PaymentRejectionModal`. Page reduced from 791 to 198 lines.
     - `packages`: `PackageStats`, `PackageTable`, `PackageFormModal`. Page reduced from 794 to 219 lines.
     - `credentials`: `CredentialsStats`, `CredentialsStudentSidebar`, `CredentialsTable`, `IssueCredentialModal`, `ReplaceDeviceModal`, `RevokeCredentialModal`. Page reduced from 718 to 216 lines.
     - `platform`: `TenantStats`, `TenantTable`, `CreateTenantModal`, `SupportAccessModal`. Page reduced from 625 to 198 lines.
     - `student-dashboard`: `StudentHeroBanner`, `LinkedAcademiesWidget`, `StudentKpiGrid`, `ContinueLearningCard`, `UpcomingDeadlinesWidget`. Page reduced from 495 to 175 lines.
     - `teacher-dashboard`: `TeacherHeroBanner`, `TeacherKpiGrid`, `TodaySessionsCard`, `PendingTasksCard`, `QuickActionsCard`. Page reduced from 426 to 157 lines.
     - `attendance`: `AttendanceRoster`, `LiveQrScannerModal`. Page reduced from 330 to 175 lines.
   - All touched pages now strictly satisfy the `≤ 300 lines` threshold (all ≤ 220 lines).

5. **Detail Page Pattern (R7-3):**
   - Created `apps/web/src/components/layout/detail-layout.tsx` providing a standard 2-column layout with breadcrumbs, entity title, status badges, primary action buttons, tabs bar, and desktop sticky side summary.

---

## 2. Files Modified & Created

### 2.1 Tokens & Styles
- `apps/web/src/styles/tokens.css` (Created)
- `apps/web/src/app/globals.css` (Updated: `@import "../styles/tokens.css"`, `@theme` token mappings)
- `apps/web/src/app/layout.tsx` (Updated: removed forced dark mode, added SSR anti-flash script)
- `apps/web/src/context/theme-context.tsx` (Created: theme provider & hook)
- `apps/web/src/components/providers.tsx` (Updated: wrapped in `ThemeProvider` & `ToastProvider`)

### 2.2 UI Primitives (`apps/web/src/components/ui/`)
- `textarea.tsx`, `checkbox.tsx`, `radio.tsx`, `switch.tsx`, `avatar.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `toast.tsx`, `confirm-dialog.tsx`, `file-upload.tsx`, `data-table.tsx`, `search-input.tsx`, `filter-bar.tsx`, `pagination.tsx`, `breadcrumbs.tsx`, `page-header.tsx`, `timeline.tsx`, `activity-feed.tsx`, `calendar-week.tsx`, `progress-bar.tsx`, `kpi-card.tsx`, `status-dot.tsx`, `forbidden.tsx`, `error-state.tsx`, `state-view.tsx`
- `apps/web/src/components/ui/empty-state.tsx` (Updated: semantic classes & flexible action slot)
- `apps/web/src/components/ui/index.ts` (Updated: exported all primitives)

### 2.3 Shell & Layouts
- `apps/web/src/components/layout/app-shell.tsx` (Created)
- `apps/web/src/components/layout/detail-layout.tsx` (Created)
- `apps/web/src/components/icons/index.tsx` (Added `SunIcon`, `MoonIcon`, `MenuIcon`, `MoreHorizontalIcon`)
- `apps/web/src/app/admin/layout.tsx` (Updated to use `AppShell`)
- `apps/web/src/app/teacher/layout.tsx` (Updated to use `AppShell`)
- `apps/web/src/app/student/layout.tsx` (Updated to use `AppShell`)
- `apps/web/src/app/parent/layout.tsx` (Updated to use `AppShell`)
- `apps/web/src/app/platform/layout.tsx` (Updated to use `AppShell`)
- Deleted: `parent-nav-layout.tsx`, `platform-nav-layout.tsx`, `student-nav-layout.tsx`, `teacher-nav-layout.tsx`.

### 2.4 Features & Pages Decomposed
- `apps/web/src/features/payments/components/` (`payment-stats.tsx`, `payment-table.tsx`, `payment-inspection-drawer.tsx`, `payment-action-modals.tsx`)
- `apps/web/src/features/packages/components/` (`package-stats.tsx`, `package-table.tsx`, `package-form-modal.tsx`)
- `apps/web/src/features/credentials/components/` (`credentials-stats.tsx`, `credentials-student-sidebar.tsx`, `credentials-table.tsx`, `credentials-modals.tsx`)
- `apps/web/src/features/platform/components/` (`tenant-stats.tsx`, `tenant-table.tsx`, `create-tenant-modal.tsx`, `support-access-modal.tsx`)
- `apps/web/src/features/student-dashboard/components/` (`student-hero-banner.tsx`, `linked-academies-widget.tsx`, `student-kpi-grid.tsx`, `continue-learning-card.tsx`, `upcoming-deadlines-widget.tsx`)
- `apps/web/src/features/teacher-dashboard/components/` (`teacher-hero-banner.tsx`, `teacher-kpi-grid.tsx`, `today-sessions-card.tsx`, `pending-tasks-card.tsx`, `quick-actions-card.tsx`)
- `apps/web/src/features/attendance/components/` (`attendance-roster.tsx`, `live-qr-scanner-modal.tsx`)
- Updated pages:
  - `apps/web/src/app/teacher/payments/page.tsx` (198 lines)
  - `apps/web/src/app/admin/packages/page.tsx` (219 lines)
  - `apps/web/src/app/teacher/credentials/page.tsx` (216 lines)
  - `apps/web/src/app/platform/tenants/page.tsx` (198 lines)
  - `apps/web/src/app/student/dashboard/page.tsx` (175 lines)
  - `apps/web/src/app/teacher/dashboard/page.tsx` (157 lines)
  - `apps/web/src/app/teacher/attendance/page.tsx` (175 lines)
  - `apps/web/src/app/components/page.tsx` (Gated with `notFound()` in production)

---

## 3. Verification Evidence

1. **TypeScript Check:**
   - Ran `apps/web/node_modules/.bin/tsc --noEmit`. Exited with code 0 (0 errors).
2. **Frontend Unit Tests:**
   - Ran `apps/web/npm test -- --run`. All 7 tests passed (NavigationRegistry filtering & AuthSession contract validation).
3. **Backend Tests:**
   - 100% green across all API test suites.
4. **Code Quality:**
   - Strict removal of mock fallbacks and raw hardcoded colors in touched files.
   - All touched pages strictly under the 300-line limit.

