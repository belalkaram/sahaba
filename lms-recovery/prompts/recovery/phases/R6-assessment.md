# R6 — Assessment (Exams & Assignments)

> **بالعربي:** دورة حياة امتحان صحيحة، توقيت على السيرفر، منشئ امتحانات وواجبات، تسليم ملفات، صندوق تصحيح، نشر درجات، ومراجعة النتيجة للطالب.
> **Closes:** T-SEC-11, T-FEAT-17, 18, 19
> **Depends on:** R3 (access policy), R4 (lesson types link). **Spec:** Master §33-35, FR-ONLINE-009..011.

## Tasks

### R6-1 — Exam lifecycle
- States: `draft` ⇒ `published` ⇒ `closed` ⇒ `archived`. Fields: `opens_at`, `closes_at`, `duration_minutes`, `max_attempts` (default 1), `shuffle_questions`, `shuffle_options`, `show_results` (`after_publish` default).
- Remove auto `is_published = true` on create (ExamController@store ~line 51). Publishing requires ≥1 question and total points > 0.
- Attempt states per Master §34: `created ⇒ started ⇒ in_progress ⇒ submitted ⇒ graded ⇒ published`; illegal transitions ⇒ 422 `ILLEGAL_TRANSITION`.

### R6-2 — Server-authoritative timing
- Attempt `expires_at = min(started_at + duration, closes_at)`. Answers after `expires_at` ⇒ 422 `ATTEMPT_EXPIRED`. Scheduled job / on-read check auto-submits expired attempts. Concurrent submit is idempotent (lock row).
- `GET /attempts/{id}` returns server `now` and `expires_at` so the UI timer syncs to server time.
- Tests: late answer rejected; auto-submit; double submit.

### R6-3 — Questions API
- `PUT/DELETE /questions/{id}`, `POST /exams/{id}/questions/reorder`, question types: `multiple_choice` (single), `multiple_select`, `true_false`, `short_answer` (auto-grade exact/normalized), `essay` (manual).
- Question bank: `question_banks` per course; import questions into an exam.
- Staff endpoint `GET /exams/{id}/questions?with_answers=1` — `exams.update`, scoped (the only place answers are returned).

### R6-4 — Assignment submissions with files
- Submissions accept text and/or files (private disk, size/mime limits); due date + late policy (`allow_late`, `late_penalty_percent`); resubmission until due if allowed.
- `GET /submissions/{id}/files/{fileId}` signed.

### R6-5 — Builders & grading UI (staff)
- `/staff/courses/[id]/exams/[examId]/edit`: Exam Builder (settings panel, question list with drag reorder, per-type editors, points, preview as student, publish checklist).
- `/staff/courses/[id]/assignments/[id]/edit`: Assignment Builder.
- `/staff/grading`: inbox of submissions/attempts needing manual grading across my courses (filters, keyboard navigation), grading panel with rubric/score/feedback, bulk "publish grades".
- Teacher dashboard "pending grading" count comes from this API (remove the `count: 0` placeholder, T-UX-05).

### R6-6 — Student assessment UI
- `/student/assessments`: upcoming/open/submitted/graded lists with countdowns.
- Exam runner: server-synced timer, autosave each answer, network-loss banner with retry, submit confirmation, prevented double submit.
- Result review after publish (score, per-question feedback per `show_results`).
- Assignment submission page with file upload and status.

## Acceptance criteria (E2E + API)

- [ ] Teacher builds exam with 5 mixed questions ⇒ publishes with window ⇒ student takes it ⇒ auto-graded parts scored ⇒ teacher grades essay ⇒ publishes ⇒ student sees result.
- [ ] Answer after expiry rejected; refresh during exam keeps remaining time from server.
- [ ] No endpoint returns answers to students (regression test from R0 still passes).
- [ ] All standard commands pass.
