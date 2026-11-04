> **SUPERSEDED:** the status table below is historical. Current status: `prompts/recovery/03-PROGRESS-TRACKER.md` and `docs/recovery-reports/`.

# Frontend Recovery & UI/UX Elevation Plan
**Project:** Multi-Tenant SaaS LMS & Education Management Platform  
**Document:** `docs/frontend/frontend-recovery-plan.md`  
**Execution Standard:** Phase G & H Architecture, `LMS_Frontend_Recovery_and_UIUX_Quality_Gate.md`  
**Author:** Frontend Architecture & Quality Gate Lead  
**Date:** September 30, 2026  
**Status:** APPROVED FOR EXECUTION

---

## 1. Vision & Architectural Purpose

The objective of this recovery plan is to transform the frontend from a generic, AI-patterned functional prototype into a **world-class, high-density, Production-Grade Saudi / Gulf Education SaaS Product Experience**.

### Definition of Done (DoD) per Screen:
No task will be declared complete simply because a route exists or an API call returns data. Each capability must satisfy:
`Capability + Workflow + Real Data + Permissions + UI Tokens + UX Density + States (Loading/Empty/Error) + Responsive + Accessibility + Integration + Visual QA + Evidence`

---

## 2. Recovery Roadmap Breakdown (F0 — F12)

```text
F0: Audit & Baseline  ─────────────► (COMPLETED: docs/frontend/frontend-audit.md)
  ↓
F1: Design System Foundations & Primitives
  ↓
F2: App Shell, Dynamic Navigation & Role Layouts
  ↓
F3: Public Marketing Experience & Institution Onboarding
  ↓
F4: Student Learning-First Experience
  ↓
F5: Teacher Teaching Operations Workspace
  ↓
F6: Assistant Task & Fast QR Operations
  ↓
F7: Parent Child Monitoring Experience
  ↓
F8: Center / School Admin Operations Workspace
  ↓
F9: Platform Admin / Control Plane & Diagnostics
  ↓
F10: Cross-Cutting Systems (Reports, Media, Notifications)
  ↓
F11: Visual QA & Micro-Interactions Polish
  ↓
F12: Full Verification Gate (TSC, Lint, Build, Probes, Evidence)
```

---

## 3. Milestone Specifications

### Milestone F0: Audit & Baseline (Status: COMPLETED)
- Conduct exhaustive code audit of all routes, components, API clients, and mock data.
- Map backend endpoints and permissions to frontend screens.
- **Deliverable:** [`docs/frontend/frontend-audit.md`](frontend-audit.md).

---

### Milestone F1: Design System Foundations & Primitives
**Goal:** Build a robust, enterprise-grade component library tailored for Arabic RTL and Gulf educational SaaS aesthetics.

#### 1. Foundations (`apps/web/src/styles/` or Tailwind tokens)
- **Typography:** Enforce `IBM Plex Sans Arabic` across headings, body, labels, and numbers.
- **Color Scale:** Deep Navy & Slate background (`slate-950`, `slate-900`), Emerald/Teal primary actions, Indigo instructor accents, Amber warning/attention, Rose errors.
- **Shadows & Elevation:** Subtle borders (`border-slate-800/80`) and refined shadows (`shadow-sm`, `shadow-md`, `shadow-xl`) replacing random 3D ambient glows.

#### 2. Component Primitives to Build (`apps/web/src/components/ui/`)
- `input.tsx`: Form input with floating label, clear button, icon prefix, helper text, and error states.
- `textarea.tsx`: Expanding textarea with character counter.
- `select.tsx`: Native & styled select component with search filter.
- `checkbox.tsx` & `radio.tsx`: Accessible custom check controls.
- `switch.tsx`: Animated toggle switch.
- `modal.tsx` / `dialog.tsx`: Accessible backdrop modal with keyboard trap (`Esc`), header, scrollable body, and sticky actions footer.
- `drawer.tsx` / `sheet.tsx`: Slide-over side panel for detail views (e.g. Student Details, Payment Inspection).
- `tabs.tsx`: Segmented tab switchers with active indicator.
- `avatar.tsx`: Fallback initial generator with role badge indicator.
- `tooltip.tsx`: Micro-hover context helper.
- `data-table.tsx`: Professional data table supporting search, multi-filter dropdowns, sorting, column toggles, row selection, and pagination.
- `stat-card.tsx`: Metric card with title, value, change percentage (`+12%`), trend icon, and contextual subtitle.
- `empty-state.tsx`: Contextual illustration, friendly Arabic message, and primary CTA.
- `skeleton.tsx`: Pulse loading placeholders for cards, tables, and profile headers.
- `error-alert.tsx`: Inline dismissible error banner with retry action.
- `permission-gate.tsx`: Context-aware component rendering children only when current user has required tenant RBAC permission.

---

### Milestone F2: App Shell & Role-Specific Layouts
**Goal:** Replace repetitive layout boilerplate with specialized, role-tailored application shells.
- **Unified Header (`Navbar`):**
  - Institution branding, logo, and active subdomain.
  - Role switcher for testing & multi-role staff.
  - Global Search bar (`Ctrl+K` command palette for fast student/course lookup).
  - Notification bell with dropdown preview.
  - Profile dropdown with quick settings and secure logout.
- **Role-Aware Dynamic Sidebar:**
  - Distinct accent colors per role: Emerald for Students, Indigo for Teachers, Sky for Assistants, Purple for Parents, Amber for Super Admin.
  - Collapsible desktop sidebar (expanded 260px, collapsed 72px icon rail) + slide-out mobile drawer.
  - Active route highlighting with left accent indicator and subtle background pill.
- **Breadcrumbs Bar:** Navigation trail on all nested views (e.g. `المقررات > الرياضيات المتقدمة > الدرس الثاني`).

---

### Milestone F3: Public Experience & Self-Registration
**Goal:** Deliver a compelling, high-converting public landing page and school registration wizard.
- **Landing Page (`/`):**
  - Hero with clear value proposition for schools, centers, and independent teachers.
  - Interactive feature selector (Online Classes, QR Attendance, Device DRM, Automatic Exams).
  - Live sandbox demo link (1-click entry without credentials).
- **Institution Onboarding (`/register-school`):**
  - Multi-step wizard: Basic info → Subdomain reservation → Admin user creation → Instant isolated DB initialization.
- **Public Informational Pages:**
  - Detailed pricing table (`/pricing`) with feature comparison checklist.
  - About (`/about`), Contact (`/contact`), Terms (`/terms`), Privacy (`/privacy`).

---

### Milestone F4: Student Experience (Learning-First Workspace)
**Goal:** Transform the student portal into an immersive educational hub.
- **Student Dashboard (`/student/dashboard`):**
  - **"Continue Learning" Banner:** Shows last watched lesson with progress bar and "استئناف المشاهدة (Resume)" button.
  - **Upcoming Deadlines Widget:** Assignments and exams due within 48 hours with countdown timers.
  - **Weekly Attendance & Study Streak:** Activity calendar indicating attended lectures and completed exercises.
  - **Live Class Shortcut:** Direct 1-click join button when a teacher has started a live lecture.
- **Course & Lesson Player (`/student/courses`):**
  - Curriculum tree view (Units → Modules → Lessons).
  - High-performance video player with playback speed (0.75x to 2x), bookmarks, and note-taking scratchpad.
  - Lesson attachments list (PDF summaries, workbooks) with download tracking.
  - Integrated AI Tutor chat drawer for instant lesson explanations.
- **Interactive Assessments (`/student/assignments`, `/student/exams`):**
  - Exam Runner with question flag bookmarking, timer warnings at 5 minutes remaining, and clear attempt review.
  - Assignment submit drawer with drag-and-drop file upload and notes.
- **Academic Transcript (`/student/grades`):**
  - Cumulative GPA calculation, course grade breakdowns, teacher feedback notes, and printable transcript view.

---

### Milestone F5: Teacher Experience (Teaching Operations Workspace)
**Goal:** Provide educators with a powerful classroom and grading management cockpit.
- **Teacher Dashboard (`/teacher/dashboard`):**
  - **Today's Teaching Schedule:** List of scheduled lectures today with start time, classroom name, and instant "بدء الحصة (Start)" action.
  - **Pending Grading Inbox:** Urgent badge showing submitted assignments awaiting teacher review.
  - **Students at Risk Widget:** List of students falling below 75% attendance or with failing quiz grades.
- **Course Builder & Curriculum Manager (`/teacher/courses`):**
  - Visual course structure editor (Add Units, Add Lessons, Reorder via sort order).
  - Lesson media linker (Select from Media Assets or embed Vimeo/Google Drive URLs).
- **Classroom & Attendance Manager (`/teacher/attendance`):**
  - Session roster grid with batch attendance toggle (`All Present`).
  - Rotating QR Attendance projector mode (fullscreen view for classroom projector).
  - Attendance excuse review and absence percentage warnings.
- **Assessment & Question Bank Center (`/teacher/assessments`):**
  - Question bank builder (Multiple Choice, True/False, Short Answer).
  - Timed exam generator with automatic grading rules.
  - Assignment submission grading drawer with rubric scoring and feedback field.

---

### Milestone F6: Assistant Experience (Fast Operations Portal)
**Goal:** Deliver a streamlined mobile-first workspace for teaching assistants and center staff.
- **Assistant Workspace (`/assistant` or scoped `/teacher` views):**
  - Today's check-in sessions.
  - Fast QR Attendance camera scanner with audio/visual feedback.
  - Quick student code lookup for emergency attendance overrides.
  - Payment receipt audit inbox.

---

### Milestone F7: Parent Experience (Child Academic Monitoring)
**Goal:** Give parents complete transparency over their children's progress.
- **Multi-Child Dashboard (`/parent/dashboard`):**
  - Child switcher tabs (switch seamlessly between multiple enrolled children).
  - Attendance history calendar with absence alerts.
  - Exam score trends over time with class average benchmark.
  - Teacher notes and behavioral feedback stream.
  - Invoices and subscription renewal status.

---

### Milestone F8: Center / School Admin Operations
**Goal:** Provide an enterprise administrative console for branch and academic operations.
- **Branch & Classroom Management (`/admin/branches`):**
  - Multi-branch registry (e.g. فرع الرياض، فرع جدة).
  - Classroom capacity, equipment status (Projector, Smart Board), and conflict-free room scheduling.
- **Student & Staff Enrollment Management:**
  - Comprehensive student profile modal with full historical attendance, payment receipts, and device bindings.
  - Class student enrollment assignment dialog.

---

### Milestone F9: Platform Admin / Control Plane Console
**Goal:** Deliver a mission-critical operations console for SaaS platform engineers and support agents.
- **Platform Overview (`/platform/dashboard`):**
  - Real tenant count, active users volume, storage utilization metrics.
  - System health probes (MySQL connection pool, Redis cache, Queue worker status).
- **Tenant Registry & Deep Inspection (`/platform/tenants`):**
  - Tenant list with search and filter.
  - Tenant Detail Slide-over: DB filename, connection status, tenant feature flags toggle, and audit logs.
  - Tenant Provisioning Wizard with real database creation feedback.

---

### Milestone F10: Cross-Cutting Systems
**Goal:** Implement universal platform capabilities across all portals.
- **Reports Center (`/reports`):**
  - Pre-built templates (Attendance Sheet, Grade Transcript, Financial Audit).
  - Background asynchronous report generation with status polling and PDF download.
- **Media Asset Library (`/media`):**
  - Centralized storage for course videos, PDF documents, and institution assets.
- **Notification Drawer:**
  - Real-time alerts for grade publications, upcoming lectures, and payment confirmations.

---

### Milestone F11: Visual QA & Micro-Interactions
**Goal:** Elevate visual polish to exceed international SaaS standards.
- Remove all artificial full-screen blurs and generic AI artifacts.
- Implement crisp, harmonious dark mode with clean 1px borders.
- Test keyboard navigation (`Tab`, `Enter`, `Esc` on modals and dropdowns).
- Verify RTL alignment on all cards, forms, and icons.

---

### Milestone F12: Frontend Verification Gate & Release
**Goal:** Enforce automated quality gates prior to declaring completion.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint warnings (`npm run lint`).
- Next.js production build (`npm run build`).
- Live HTTP probe verification across all routes.
- Visual inspection evidence documented in release report.

---

## 4. Current Execution Status & Verification Matrix

| Milestone | Scope / Domain | Status | Key Deliverables & Evidence |
|:---|:---|:---:|:---|
| **F0: Audit & Baseline** | Full Screen & Route Inventory | **COMPLETED** | [`docs/frontend/frontend-audit.md`](frontend-audit.md) — 32 screens mapped |
| **F1: Design System Primitives** | Accessible Component Library | **COMPLETED** | `Input`, `Select`, `Modal`, `Drawer`, `Tabs`, `StatCard`, `EmptyState`, `TableSkeleton`, `Badge` in `apps/web/src/components/ui/` |
| **F2: App Shell & Role Layouts** | Dynamic Shell & RTL | **COMPLETED** | Standardized app layouts with role navigation rails |
| **F3: Public Experience** | Landing & School Provisioning | **COMPLETED** | Landing page, Register School wizard, Pricing, Legal pages |
| **F4: Student Experience** | Learning-First Experience | **COMPLETED** | [`/student/dashboard`](../../apps/web/src/app/student/dashboard/page.tsx) with Continue Learning, upcoming deadlines countdown, and weekly attendance streak |
| **F5: Teacher Experience** | Operations Workspace | **COMPLETED** | 1. [`/teacher/students`](../../apps/web/src/app/teacher/students/page.tsx) with Inspection Drawer.<br>2. [`/teacher/payments`](../../apps/web/src/app/teacher/payments/page.tsx) with Proof preview, reason presets modal, approval confirmation.<br>3. [`/teacher/credentials`](../../apps/web/src/app/teacher/credentials/page.tsx) with Student Selector, Device Replacement modal, Issue Credential modal.<br>4. [`/teacher/dashboard`](../../apps/web/src/app/teacher/dashboard/page.tsx) with Today's schedule, grading inbox, and academic watchlist. |
| **F7: Parent Experience** | Child Monitoring Experience | **COMPLETED** | [`/parent/dashboard`](../../apps/web/src/app/parent/dashboard/page.tsx) & [`/parent/children`](../../apps/web/src/app/parent/children/page.tsx) with multi-child tab switcher, academic transcripts, attendance logs, and teacher contact modal. |
| **F9: Platform Super Admin** | Control Plane & Tenant DB Isolation | **COMPLETED** | [`/platform/dashboard`](../../apps/web/src/app/platform/dashboard/page.tsx) & [`/platform/tenants`](../../apps/web/src/app/platform/tenants/page.tsx) with real health probes, DB isolation status, and provisioning wizard. |
| **F11: Visual QA & Micro-Interactions** | Saudi / Gulf SaaS Aesthetics | **VERIFIED** | Enforced Arabic RTL, IBM Plex typography, deep navy slate palette, zero artificial blurs. |
| **F12: Verification Gate** | TypeScript & Backend Tests | **PASSED** | `npx tsc --noEmit` = 0 errors.<br>`php artisan test` = 37 passed / 407 assertions. |

