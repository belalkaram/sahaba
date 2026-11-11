# Assessment v2 — images, assignment questions, split-session exams, model answers

Status: **IMPLEMENTED** (backend tests pass on sqlite; migration applied to Supabase; UI typechecks).
Not `VERIFIED` end-to-end in a browser against real data, not `PRODUCTION_READY`.

## What the business asked for

1. A question (exam *or* assignment) may carry an optional image.
2. Assignments can contain questions exactly like exams (multiple choice, true/false, short answer, essay);
   the student answers inside the platform.
3. Typed answers must be written inside the page: no paste/drop/cut/copy on the answer field.
4. After the student finished and the teacher graded, the teacher can release the model answer to one student,
   a class, or everyone, from the teacher dashboard.
5. An exam has a window (e.g. 4 days) and a total duration (e.g. 30 min) that the student may spread over
   several sittings; the sum of active time must equal the duration.

## Design decisions (recorded because they shape the user experience)

| Topic | Decision | Why |
|---|---|---|
| Split-session clock | Counts only while the exam page is open: heartbeat every 15 s; each beat charges the gap since the previous one, capped at 45 s. First beat of a new sitting (`resume=true`) charges at most 20 s. | Closing the tab / losing the network costs seconds, never the whole gap; a client cannot slow the clock by skipping beats. Opening the briefing page (`active-attempt`) is a free peek. |
| End of a split exam | Budget used up **or** `closes_at` passed (whichever first), submitted by the server. | `expires_at` is only the end of the current sitting for split exams. |
| Single-session exams | Unchanged (`expires_at = min(start + duration, closes_at)`). | No regression. |
| Model-answer access | Student must have **finished**, grades **published**, and the model answer **released** (student / class / all) — or auto-release is on and the window (`closes_at` / `due_at`) is over. Fail closed. | Matches "after the exams and homework are corrected". |
| Assignment grading | MC / true-false / short answer auto-graded on submit; essays graded per answer by the teacher; submission becomes `graded` when nothing is pending. Publishing grades still uses the existing flow. | Reuses `QuestionAutoGrader` shared with exams. |
| Images | Private disk, per-tenant folder, served only by authorised endpoints (`image` = student with an attempt / published assignment; `model_answer` image = same rule as model answer). Paths never appear in JSON; clients get `has_image`. | Same pattern as profile images. |
| Template provisioning | New tenant migration is applied to the clone template automatically (see changelog). | Registration stays fast. |

## API (all under `/api/v1/courses/{courseId}`)

- `POST exams/{id}/attempts/{attemptId}/heartbeat` `{resume?: bool}` → `{expired, remaining_seconds, status}`
- `GET|POST|PUT|DELETE assignments/{id}/questions[/{qid}]`, `GET assignments/{id}/submissions/{sid}/answers`,
  `POST assignments/{id}/submissions/{sid}/answers/{aid}/grade`
- `POST|DELETE|GET {exams|assignments}/{id}/questions/{qid}/image?variant=question|model_answer`
- `GET {exams|assignments}/{id}/model-answers` (student), `.../model-answers/status|release|revoke|auto-release` (teacher)
- `POST assignments/{id}/submit` now also accepts `answers: [{question_id, answer_text, selected_options}]`.
- Exam create/update accept `allow_split_sessions`, `auto_release_model_answers`; questions accept `model_answer`.

## Known limitations / things to decide next

1. **Questions are visible across days on split exams.** A student can open the exam on day 1, read the questions and
   share them with classmates who sit on day 3. Mitigations if it matters: shuffle (already supported, stable per
   attempt), drawing questions randomly from a question bank per student (not built), shorter windows.
2. **Retakes vs. model answers.** If `max_attempts > 1` and the teacher releases the model answer while a student still
   has attempts left, they can read the solution first. Not blocked today.
3. **Copy/paste blocking is a deterrent**, not security: a student can retype from a second device. Attempts are logged
   (`paste_attempt` integrity event) in exams; assignments only show the warning.
4. **Late penalty on assignments is stored (`late_penalty_percent`) but never applied** to the score (pre-existing).
5. Bank questions can carry images/model answers in the database but the bank UI does not edit them yet; importing
   from a bank copies the model-answer **text** (not the images).
6. Image uploads are limited to 3 MB each, JPG/PNG/WebP; no per-tenant storage quota.
7. Window times are stored in UTC; the teacher form uses the browser's local time zone.
8. Not covered by automated UI tests (no browser test of the exam runner / solver / release panel yet).
