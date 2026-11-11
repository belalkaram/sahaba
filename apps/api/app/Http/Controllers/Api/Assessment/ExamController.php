<?php

namespace App\Http\Controllers\Api\Assessment;

use App\Domain\Assessment\Services\ExamTimeBudget;
use App\Domain\Assessment\Services\QuestionAutoGrader;
use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\Grade;
use App\Models\Question;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class ExamController extends Controller
{
    /** Integrity events tolerated before the attempt is submitted automatically. */
    public const MAX_VIOLATIONS = 5;

    public const INTEGRITY_EVENT_TYPES = [
        'tab_hidden', 'window_blur', 'fullscreen_exit', 'copy_attempt', 'paste_attempt', 'context_menu', 'blocked_shortcut', 'devtools_suspected',
    ];

    /** Leaving the exam counts toward the limit; blocked copy/paste/shortcut attempts are only logged for the teacher. */
    public const COUNTED_EVENT_TYPES = ['tab_hidden', 'window_blur', 'fullscreen_exit', 'devtools_suspected'];

    /**
     * List exams of a course.
     *
     * R0-2: For students (or non-staff), only return question count.
     * Staff with exams.create or exams.grade see questions and settings.
     */
    public function index(Request $request, string $courseId): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $course = Course::findOrFail($courseId);

        $isStaff = $user?->hasPermissionTo('exams.create') || $user?->hasPermissionTo('exams.grade');

        if ($isStaff) {
            $exams = $course->exams()->withCount('questions')->latest()->get();
        } else {
            // Students only see published exams
            $exams = $course->exams()
                ->where(function ($q) {
                    $q->where('status', 'published')->orWhere('is_published', true);
                })
                ->withCount('questions')
                ->latest()
                ->get();
        }

        return ApiResponse::success(['exams' => $exams]);
    }

    /**
     * Show a single exam.
     */
    public function show(Request $request, string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->withCount('questions')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $isStaff = $user?->hasPermissionTo('exams.create') || $user?->hasPermissionTo('exams.grade');

        $data = ['exam' => $exam];

        if ($user?->student) {
            $attempts = ExamAttempt::where('exam_id', $exam->id)
                ->where('student_id', $user->student->id)
                ->latest()
                ->get();
            $data['student_attempts'] = $attempts;
            $data['can_attempt'] = $exam->isOpen() && ($attempts->count() < $exam->max_attempts);
        }

        return ApiResponse::success($data);
    }

    /**
     * Create an exam.
     *
     * R6-1: Default status is 'draft' and is_published = false.
     * Publishing requires at least 1 question and total points > 0.
     */
    public function store(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'opens_at' => 'nullable|date',
            'closes_at' => 'nullable|date|after_or_equal:opens_at',
            'duration_minutes' => 'nullable|integer|min:1',
            'max_attempts' => 'nullable|integer|min:1',
            'shuffle_questions' => 'nullable|boolean',
            'shuffle_options' => 'nullable|boolean',
            'show_results' => 'nullable|string|in:after_submit,after_publish,never',
            'total_points' => 'nullable|numeric|min:0',
            'passing_score' => 'nullable|numeric|min:0',
            'allow_split_sessions' => 'nullable|boolean',
            'auto_release_model_answers' => 'nullable|boolean',
            'status' => 'nullable|string|in:draft,published,closed,archived',
        ]);

        $status = $validated['status'] ?? 'draft';
        $isPublished = false;

        // If explicitly requested to be published on store, verify canBePublished
        if ($status === 'published') {
            // Brand new exams have 0 questions, so cannot be published immediately
            $status = 'draft';
        }

        $exam = $course->exams()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'opens_at' => $validated['opens_at'] ?? null,
            'closes_at' => $validated['closes_at'] ?? null,
            'duration_minutes' => $validated['duration_minutes'] ?? 60,
            'max_attempts' => $validated['max_attempts'] ?? 1,
            'shuffle_questions' => $validated['shuffle_questions'] ?? false,
            'shuffle_options' => $validated['shuffle_options'] ?? false,
            'show_results' => $validated['show_results'] ?? 'after_publish',
            'total_points' => $validated['total_points'] ?? 0.00,
            'passing_score' => $validated['passing_score'] ?? null,
            'allow_split_sessions' => $validated['allow_split_sessions'] ?? false,
            'auto_release_model_answers' => $validated['auto_release_model_answers'] ?? false,
            'is_published' => $isPublished,
            'is_grades_published' => false,
            'status' => $status,
        ]);

        return ApiResponse::success(['exam' => $exam], Response::HTTP_CREATED);
    }

    /**
     * Update an exam.
     */
    public function update(Request $request, string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'opens_at' => 'nullable|date',
            'closes_at' => 'nullable|date|after_or_equal:opens_at',
            'duration_minutes' => 'nullable|integer|min:1',
            'max_attempts' => 'nullable|integer|min:1',
            'shuffle_questions' => 'nullable|boolean',
            'shuffle_options' => 'nullable|boolean',
            'show_results' => 'nullable|string|in:after_submit,after_publish,never',
            'total_points' => 'nullable|numeric|min:0',
            'passing_score' => 'nullable|numeric|min:0',
            'allow_split_sessions' => 'nullable|boolean',
            'auto_release_model_answers' => 'nullable|boolean',
            'status' => 'nullable|string|in:draft,published,closed,archived',
        ]);

        if (isset($validated['status']) && $validated['status'] === 'published') {
            $check = $exam->canBePublished();
            if (! $check['can']) {
                return ApiResponse::error('UNPUBLISHABLE_EXAM', $check['reason'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $validated['is_published'] = true;
        } elseif (isset($validated['status'])) {
            $validated['is_published'] = false;
        }

        $exam->update($validated);

        return ApiResponse::success(['exam' => $exam->fresh()]);
    }

    /**
     * Delete an exam.
     */
    public function destroy(string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $exam->delete();

        return ApiResponse::success(['message' => 'Exam deleted successfully.']);
    }

    /**
     * Publish an exam.
     *
     * R6-1: Requires >= 1 question and total points > 0.
     */
    public function publish(string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        $check = $exam->canBePublished();
        if (! $check['can']) {
            return ApiResponse::error('UNPUBLISHABLE_EXAM', $check['reason'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $exam->update([
            'status' => 'published',
            'is_published' => true,
        ]);

        $notifier = app(NotificationService::class);
        $students = Enrollment::with('student.user')->where('course_id', $courseId)->where('status', 'active')->get();
        $notifier->send(
            NotificationCatalog::EXAM_OPENED,
            $students->map(fn ($enrollment) => $enrollment->student?->user),
            ['title' => $exam->title],
            '/student/exams'
        );

        return ApiResponse::success([
            'message' => 'Exam published successfully.',
            'exam' => $exam->fresh(),
        ]);
    }

    /**
     * Close an exam.
     */
    public function close(string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        $exam->update([
            'status' => 'closed',
            'is_published' => false,
        ]);

        return ApiResponse::success([
            'message' => 'Exam closed successfully.',
            'exam' => $exam->fresh(),
        ]);
    }

    /**
     * Archive an exam.
     */
    public function archive(string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        $exam->update([
            'status' => 'archived',
            'is_published' => false,
        ]);

        return ApiResponse::success([
            'message' => 'Exam archived successfully.',
            'exam' => $exam->fresh(),
        ]);
    }

    /**
     * List questions for an exam.
     *
     * R6-3: Staff endpoint GET /exams/{id}/questions?with_answers=1 is the ONLY place answers are returned.
     */
    public function questions(Request $request, string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $isStaff = $user?->hasPermissionTo('exams.create') || $user?->hasPermissionTo('exams.grade');
        $withAnswers = $request->boolean('with_answers');

        $questions = $exam->questions()->get();

        if ($isStaff && $withAnswers) {
            $questions->each(function ($q) {
                $q->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer']);
            });
        }

        return ApiResponse::success(['questions' => $questions]);
    }

    /**
     * Add question to exam.
     */
    public function addQuestion(Request $request, string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        $validated = $request->validate([
            'question_text' => 'required|string',
            'question_type' => 'nullable|string|in:multiple_choice,multiple_select,true_false,short_answer,essay',
            'points' => 'nullable|numeric|min:0',
            'options' => 'nullable|array',
            'correct_answer' => 'nullable|string',
            'acceptable_answers' => 'nullable|array',
            'explanation' => 'nullable|string',
            'model_answer' => 'nullable|string',
            'sort_order' => 'nullable|integer',
        ]);

        $sortOrder = $validated['sort_order'] ?? (($exam->questions()->max('sort_order') ?? 0) + 1);

        $question = $exam->questions()->create([
            'question_text' => $validated['question_text'],
            'question_type' => $validated['question_type'] ?? 'multiple_choice',
            'points' => $validated['points'] ?? 10.00,
            'options' => $validated['options'] ?? null,
            'correct_answer' => $validated['correct_answer'] ?? null,
            'acceptable_answers' => $validated['acceptable_answers'] ?? null,
            'explanation' => $validated['explanation'] ?? null,
            'model_answer' => $validated['model_answer'] ?? null,
            'sort_order' => $sortOrder,
        ]);

        // Only auto-update total_points if not explicitly set
        if ($exam->total_points <= 0) {
            $exam->update(['total_points' => $exam->questions()->sum('points')]);
        }

        $question->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer']);

        return ApiResponse::success(['question' => $question], Response::HTTP_CREATED);
    }

    /**
     * Update an exam question.
     */
    public function updateQuestion(Request $request, string $courseId, string $id, string $questionId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $question = Question::where('exam_id', $exam->id)->findOrFail($questionId);

        $validated = $request->validate([
            'question_text' => 'sometimes|required|string',
            'question_type' => 'nullable|string|in:multiple_choice,multiple_select,true_false,short_answer,essay',
            'points' => 'nullable|numeric|min:0',
            'options' => 'nullable|array',
            'correct_answer' => 'nullable|string',
            'acceptable_answers' => 'nullable|array',
            'explanation' => 'nullable|string',
            'model_answer' => 'nullable|string',
            'sort_order' => 'nullable|integer',
        ]);

        $question->update($validated);

        // Recalculate total points
        $exam->update(['total_points' => $exam->questions()->sum('points')]);

        $question->makeVisible(['correct_answer', 'acceptable_answers', 'model_answer']);

        return ApiResponse::success(['question' => $question]);
    }

    /**
     * Delete an exam question.
     */
    public function deleteQuestion(string $courseId, string $id, string $questionId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $question = Question::where('exam_id', $exam->id)->findOrFail($questionId);
        $question->delete();

        // Recalculate total points
        $exam->update(['total_points' => $exam->questions()->sum('points')]);

        return ApiResponse::success(['message' => 'Question deleted successfully.']);
    }

    /**
     * Reorder questions in an exam.
     */
    public function reorderQuestions(Request $request, string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|uuid|exists:tenant.questions,id',
            'items.*.sort_order' => 'required|integer',
        ]);

        foreach ($validated['items'] as $item) {
            Question::where('exam_id', $exam->id)
                ->where('id', $item['id'])
                ->update(['sort_order' => $item['sort_order']]);
        }

        return ApiResponse::success(['message' => 'Questions reordered successfully.']);
    }

    /**
     * Start exam as a student.
     *
     * R6-2: Server-authoritative timing.
     * Attempt expires_at = min(started_at + duration, closes_at).
     */
    public function start(Request $request, string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only authenticated students can attempt exams.',
                Response::HTTP_FORBIDDEN
            );
        }

        $studentId = $user->student->id;

        // Check if exam is open
        if (! $exam->isOpen()) {
            return ApiResponse::error(
                'EXAM_NOT_AVAILABLE',
                'This exam is not open for attempts.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // Check active in_progress or completed attempt against max_attempts
        $activeAttempt = ExamAttempt::where('exam_id', $exam->id)
            ->where('student_id', $studentId)
            ->where('status', 'in_progress')
            ->first();

        if ($activeAttempt) {
            if ($activeAttempt->isExpired()) {
                $this->autoSubmitExpiredAttempt($activeAttempt);
            } else {
                return ApiResponse::error(
                    'DUPLICATE_ATTEMPT',
                    'An exam attempt has already been created or completed for this student.',
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }
        }

        // Count existing attempts
        $attemptsCount = ExamAttempt::where('exam_id', $exam->id)
            ->where('student_id', $studentId)
            ->count();

        if ($attemptsCount >= $exam->max_attempts) {
            return ApiResponse::error(
                'DUPLICATE_ATTEMPT',
                'An exam attempt has already been created or completed for this student.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // Server-authoritative timing calculation
        $now = now();
        $durationMinutes = $exam->duration_minutes ?: 60;
        $expiresAt = $now->copy()->addMinutes($durationMinutes);

        if ($exam->closes_at !== null && $exam->closes_at->lessThan($expiresAt)) {
            $expiresAt = $exam->closes_at;
        }

        $attempt = ExamAttempt::create([
            'exam_id' => $exam->id,
            'student_id' => $studentId,
            'attempt_number' => $attemptsCount + 1,
            'started_at' => $now,
            'expires_at' => $expiresAt,
            'last_seen_at' => $exam->allow_split_sessions ? $now : null,
            'status' => 'in_progress',
        ]);

        // Seeded by the attempt id so the order seen now is the order seen on every resume.
        $questions = $this->prepareQuestionsForAttempt($exam, $attempt->id);

        return ApiResponse::success([
            'attempt' => $attempt,
            'server_now' => $now->toIso8601String(),
            'remaining_seconds' => max(0, now()->diffInSeconds($expiresAt, false)),
            'max_violations' => self::MAX_VIOLATIONS,
            'questions' => $questions,
        ], Response::HTTP_CREATED);
    }

    /**
     * Resume: the student's in-progress, non-expired attempt (reload / reconnect during an exam).
     * Returns the same question order every time and the answers saved so far.
     */
    public function activeAttempt(Request $request, string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $studentId = $user->student?->id;
        if (! $studentId) {
            return ApiResponse::error('NOT_A_STUDENT', 'Only authenticated students can attempt exams.', Response::HTTP_FORBIDDEN);
        }

        $attempt = ExamAttempt::where('exam_id', $exam->id)
            ->where('student_id', $studentId)
            ->where('status', 'in_progress')
            ->with('answers')
            ->first();

        if ($attempt && $attempt->isExpired()) {
            $this->autoSubmitExpiredAttempt($attempt);
            $attempt = null;
        }

        if (! $attempt) {
            return ApiResponse::error('NO_ACTIVE_ATTEMPT', 'There is no active attempt to resume.', Response::HTTP_NOT_FOUND);
        }

        $now = now();

        if ($exam->allow_split_sessions) {
            // Read-only peek (the briefing page calls this): opening the page must not cost exam time.
            // The sitting actually starts with the first heartbeat sent with resume=true.
            $remaining = ExamTimeBudget::remainingSeconds($attempt, $exam, $now);
        } else {
            $remaining = max(0, $now->diffInSeconds($attempt->expires_at, false));
        }

        return ApiResponse::success([
            'attempt' => $attempt,
            'server_now' => $now->toIso8601String(),
            'remaining_seconds' => $remaining,
            'split_sessions' => (bool) $exam->allow_split_sessions,
            'window_closes_at' => $exam->closes_at?->toIso8601String(),
            'max_violations' => self::MAX_VIOLATIONS,
            'questions' => $this->prepareQuestionsForAttempt($exam, $attempt->id),
        ]);
    }

    /**
     * Heartbeat from the open exam page (every ~15 s). Charges the active time of a split-session exam and
     * returns the authoritative remaining time; when the budget or the window is used up the attempt is
     * submitted here and the client is told to show the result screen.
     */
    public function heartbeat(Request $request, string $courseId, string $id, string $attemptId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $attempt = ExamAttempt::where('exam_id', $exam->id)->findOrFail($attemptId);

        /** @var TenantUser $user */
        $user = $request->user();
        if ($attempt->student_id !== $user->student?->id) {
            return ApiResponse::error('UNAUTHORIZED_ATTEMPT', 'You do not own this attempt.', Response::HTTP_FORBIDDEN);
        }

        $now = now();

        if ($attempt->status === 'in_progress') {
            // resume=true marks the first beat of a new sitting: the time away is charged only a short grace.
            $remaining = $exam->allow_split_sessions
                ? ExamTimeBudget::tick($attempt, $exam, $now, $request->boolean('resume') ? ExamTimeBudget::RESUME_CHARGE_SECONDS : ExamTimeBudget::HEARTBEAT_GRACE_SECONDS)
                : max(0, $now->diffInSeconds($attempt->expires_at, false));

            if ($attempt->isExpired()) {
                $this->autoSubmitExpiredAttempt($attempt);
                $attempt->refresh();
                $remaining = 0;
            }
        } else {
            $remaining = 0;
        }

        return ApiResponse::success([
            'status' => $attempt->status,
            'expired' => $attempt->status !== 'in_progress',
            'remaining_seconds' => $remaining,
            'server_now' => $now->toIso8601String(),
        ]);
    }

    /**
     * Record a client-detected integrity event (tab switch, fullscreen exit, ...). These are signals for the
     * teacher, not proof: browsers cannot be fully locked down. At MAX_VIOLATIONS the attempt is submitted.
     */
    public function recordIntegrityEvent(Request $request, string $courseId, string $id, string $attemptId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $validated = $request->validate([
            'type' => 'required|string|in:'.implode(',', self::INTEGRITY_EVENT_TYPES),
        ]);

        /** @var TenantUser $user */
        $user = $request->user();

        return DB::transaction(function () use ($exam, $attemptId, $user, $validated) {
            $attempt = ExamAttempt::where('exam_id', $exam->id)->lockForUpdate()->findOrFail($attemptId);

            if ($attempt->student_id !== $user->student?->id) {
                return ApiResponse::error('UNAUTHORIZED_ATTEMPT', 'You do not own this attempt.', Response::HTTP_FORBIDDEN);
            }
            if ($attempt->status !== 'in_progress') {
                return ApiResponse::error('ATTEMPT_NOT_ACTIVE', 'Exam attempt is not active.', Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $events = $attempt->integrity_events ?? [];
            if (count($events) < 200) {
                $events[] = ['type' => $validated['type'], 'at' => now()->toIso8601String()];
            }
            $count = $attempt->violation_count + (in_array($validated['type'], self::COUNTED_EVENT_TYPES, true) ? 1 : 0);
            $attempt->update(['violation_count' => $count, 'integrity_events' => $events]);

            $autoSubmitted = false;
            if ($count >= self::MAX_VIOLATIONS) {
                $attempt->update([
                    'submitted_at' => now(),
                    'score' => $attempt->answers()->whereNotNull('awarded_points')->sum('awarded_points'),
                    'status' => 'submitted',
                ]);
                $autoSubmitted = true;
            }

            return ApiResponse::success([
                'violation_count' => $count,
                'max_violations' => self::MAX_VIOLATIONS,
                'auto_submitted' => $autoSubmitted,
            ]);
        });
    }

    /**
     * Get attempt details with server-synchronized timing.
     */
    public function getAttempt(Request $request, string $courseId, string $id, string $attemptId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $attempt = ExamAttempt::where('exam_id', $exam->id)->with('answers')->findOrFail($attemptId);

        /** @var TenantUser $user */
        $user = $request->user();
        $isStaff = $user?->hasPermissionTo('exams.grade') || $user?->hasPermissionTo('exams.create');

        if (! $isStaff && $attempt->student_id !== $user->student?->id) {
            return ApiResponse::error('UNAUTHORIZED_ATTEMPT', 'You do not own this attempt.', Response::HTTP_FORBIDDEN);
        }

        // Auto-submit if expired
        if ($attempt->status === 'in_progress' && $attempt->isExpired()) {
            $this->autoSubmitExpiredAttempt($attempt);
            $attempt->refresh();
        }

        $now = now();
        $remainingSeconds = $exam->allow_split_sessions
            ? ExamTimeBudget::remainingSeconds($attempt, $exam, $now)
            : ($attempt->expires_at ? max(0, $now->diffInSeconds($attempt->expires_at, false)) : 0);

        return ApiResponse::success([
            'attempt' => $attempt,
            'server_now' => $now->toIso8601String(),
            'expires_at' => $attempt->expires_at?->toIso8601String(),
            'remaining_seconds' => $remainingSeconds,
        ]);
    }

    /**
     * Submit an answer to a question during exam attempt.
     *
     * R6-2: Reject answer if attempt is expired.
     */
    public function submitAnswer(Request $request, string $courseId, string $id, string $attemptId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $attempt = ExamAttempt::where('exam_id', $exam->id)->findOrFail($attemptId);

        /** @var TenantUser $user */
        $user = $request->user();

        if ($attempt->student_id !== $user->student?->id) {
            return ApiResponse::error('UNAUTHORIZED_ATTEMPT', 'You do not own this attempt.', Response::HTTP_FORBIDDEN);
        }

        if ($attempt->status !== 'in_progress') {
            return ApiResponse::error('ATTEMPT_NOT_ACTIVE', 'Exam attempt is already submitted or closed.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($exam->allow_split_sessions) {
            ExamTimeBudget::tick($attempt, $exam);
        }

        // Enforce server-authoritative expiration
        if ($attempt->isExpired()) {
            $this->autoSubmitExpiredAttempt($attempt);

            return ApiResponse::error('ATTEMPT_EXPIRED', 'Exam time has expired. Your attempt has been automatically submitted.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validated = $request->validate([
            'question_id' => 'required|uuid|exists:tenant.questions,id',
            'answer_text' => 'nullable|string',
            'selected_options' => 'nullable|array',
        ]);

        $question = Question::where('exam_id', $exam->id)->findOrFail($validated['question_id']);

        $answerText = $validated['answer_text'] ?? '';
        $selectedOptions = $validated['selected_options'] ?? null;

        $graded = app(QuestionAutoGrader::class)->grade($question, $answerText, $selectedOptions);
        $isCorrect = $graded['is_correct'];
        $awardedPoints = $graded['awarded_points'];

        $answer = ExamAnswer::updateOrCreate(
            [
                'attempt_id' => $attempt->id,
                'question_id' => $question->id,
            ],
            [
                'answer_text' => $answerText,
                'selected_options' => $selectedOptions,
                'is_correct' => $isCorrect,
                'awarded_points' => $awardedPoints,
            ]
        );

        return ApiResponse::success(['answer' => $answer]);
    }

    /**
     * Submit exam attempt for evaluation.
     *
     * R6-2: Idempotent and thread-safe submit.
     */
    public function submit(Request $request, string $courseId, string $id, string $attemptId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        return DB::transaction(function () use ($exam, $attemptId, $user) {
            /** @var ExamAttempt $attempt */
            $attempt = ExamAttempt::where('exam_id', $exam->id)
                ->lockForUpdate()
                ->findOrFail($attemptId);

            if ($attempt->student_id !== $user->student?->id) {
                return ApiResponse::error('UNAUTHORIZED_ATTEMPT', 'You do not own this attempt.', Response::HTTP_FORBIDDEN);
            }

            // Idempotent submit handling
            if (in_array($attempt->status, ['submitted', 'graded', 'published'], true)) {
                return ApiResponse::success([
                    'already_submitted' => true,
                    'attempt' => $attempt->fresh('answers'),
                    'message' => 'Exam attempt has already been submitted.',
                ]);
            }

            if ($attempt->status !== 'in_progress') {
                return ApiResponse::error('ATTEMPT_NOT_ACTIVE', 'Exam attempt cannot be submitted in its current state.', Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            // Calculate auto-graded score
            $autoScore = $attempt->answers()->whereNotNull('awarded_points')->sum('awarded_points');

            $attempt->update([
                'submitted_at' => now(),
                'score' => $autoScore,
                'status' => 'submitted',
            ]);

            return ApiResponse::success([
                'attempt' => $attempt->fresh('answers'),
                'message' => 'Exam submitted successfully.',
            ]);
        });
    }

    /**
     * Grade an exam attempt (Teacher/Staff).
     */
    public function grade(Request $request, string $courseId, string $id, string $attemptId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $attempt = ExamAttempt::where('exam_id', $exam->id)->findOrFail($attemptId);

        /** @var TenantUser $user */
        $user = $request->user();

        $maxAllowed = max((float) $exam->total_points, (float) $exam->questions()->sum('points'), 100.00);

        $validated = $request->validate([
            'score' => 'required|numeric|min:0|max:'.$maxAllowed,
            'feedback' => 'nullable|string',
            'answers_scores' => 'nullable|array',
            'answers_scores.*.question_id' => 'required|uuid',
            'answers_scores.*.awarded_points' => 'required|numeric|min:0',
            'answers_scores.*.feedback' => 'nullable|string',
        ]);

        if (! empty($validated['answers_scores'])) {
            foreach ($validated['answers_scores'] as $as) {
                ExamAnswer::where('attempt_id', $attempt->id)
                    ->where('question_id', $as['question_id'])
                    ->update([
                        'awarded_points' => $as['awarded_points'],
                        'feedback' => $as['feedback'] ?? null,
                    ]);
            }
        }

        $attempt->update([
            'score' => $validated['score'],
            'feedback' => $validated['feedback'] ?? null,
            'graded_by_user_id' => $user->id,
            'graded_at' => now(),
            'status' => 'graded',
        ]);

        $maxScore = $exam->total_points > 0 ? $exam->total_points : 100.00;
        $percentage = round(($validated['score'] / $maxScore) * 100, 2);

        Grade::updateOrCreate(
            [
                'student_id' => $attempt->student_id,
                'gradable_type' => 'exam',
                'gradable_id' => $exam->id,
            ],
            [
                'score' => $validated['score'],
                'max_score' => $maxScore,
                'percentage' => $percentage,
                'is_published' => $exam->is_grades_published,
                'graded_at' => now(),
            ]
        );

        return ApiResponse::success(['attempt' => $attempt->fresh(['answers', 'gradedBy'])]);
    }

    /**
     * Publish grades for an exam.
     */
    public function publishGrades(string $courseId, string $id): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);

        $exam->update(['is_grades_published' => true]);

        $newlyPublished = Grade::where('gradable_type', 'exam')
            ->where('gradable_id', $exam->id)
            ->where('is_published', false)
            ->pluck('student_id');

        Grade::where('gradable_type', 'exam')
            ->where('gradable_id', $exam->id)
            ->update(['is_published' => true]);

        app(NotificationService::class)->gradesPublished($newlyPublished, $exam->title);

        return ApiResponse::success([
            'message' => 'Grades published successfully for exam.',
        ]);
    }

    /**
     * Student review results of their attempt.
     */
    public function results(Request $request, string $courseId, string $id, string $attemptId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($id);
        $attempt = ExamAttempt::where('exam_id', $exam->id)->with('answers.question')->findOrFail($attemptId);

        /** @var TenantUser $user */
        $user = $request->user();

        if ($attempt->student_id !== $user->student?->id && ! $user->hasPermissionTo('exams.grade')) {
            return ApiResponse::error('UNAUTHORIZED', 'Access denied to these exam results.', Response::HTTP_FORBIDDEN);
        }

        $showResults = $exam->show_results;

        // Policy check
        if ($showResults === 'never') {
            return ApiResponse::success([
                'exam_title' => $exam->title,
                'status' => $attempt->status,
                'score' => $exam->is_grades_published ? $attempt->score : null,
                'total_points' => $exam->total_points,
                'details_hidden' => true,
            ]);
        }

        if ($showResults === 'after_publish' && ! $exam->is_grades_published) {
            return ApiResponse::success([
                'exam_title' => $exam->title,
                'status' => $attempt->status,
                'message' => 'النتائج ستظهر بعد اعتماد ونشر الدرجات من قبل المعلم.',
                'details_hidden' => true,
            ]);
        }

        // Full detailed breakdown
        $answersDetails = $attempt->answers->map(function ($ans) {
            $q = $ans->question;
            $q?->makeVisible(['correct_answer', 'acceptable_answers']);

            return [
                'question_id' => $ans->question_id,
                'question_text' => $q?->question_text,
                'question_type' => $q?->question_type,
                'points' => $q?->points,
                'student_answer' => $ans->answer_text,
                'selected_options' => $ans->selected_options,
                'is_correct' => $ans->is_correct,
                'awarded_points' => $ans->awarded_points,
                'correct_answer' => $q?->getRawOriginal('correct_answer'),
                'explanation' => $q?->explanation,
                'feedback' => $ans->feedback,
            ];
        });

        return ApiResponse::success([
            'attempt' => [
                'id' => $attempt->id,
                'score' => $attempt->score,
                'total_points' => $exam->total_points,
                'feedback' => $attempt->feedback,
                'submitted_at' => $attempt->submitted_at,
                'status' => $attempt->status,
            ],
            'answers' => $answersDetails,
        ]);
    }

    /**
     * Auto-submit an expired attempt.
     */
    protected function autoSubmitExpiredAttempt(ExamAttempt $attempt): void
    {
        $autoScore = $attempt->answers()->whereNotNull('awarded_points')->sum('awarded_points');

        $attempt->update([
            'submitted_at' => $attempt->exam?->allow_split_sessions
                ? ($attempt->last_seen_at ?? now())
                : ($attempt->expires_at ?? now()),
            'score' => $autoScore,
            'status' => 'submitted',
        ]);
    }

    /**
     * Prepare questions for attempt, stripping answers and shuffling if enabled.
     */
    protected function prepareQuestionsForAttempt(Exam $exam, ?string $seed = null): array
    {
        $query = $exam->questions();

        if ($exam->shuffle_questions && $seed === null) {
            $query->inRandomOrder();
        } else {
            $query->orderBy('sort_order', 'asc');
        }

        $questions = $query->get(['id', 'question_text', 'question_type', 'points', 'options', 'sort_order']);

        // With a seed (resume after reload) the shuffle is stable, so the student sees the same order.
        if ($exam->shuffle_questions && $seed !== null) {
            $questions = $questions->sortBy(fn ($q) => md5($seed.$q->id))->values();
        }

        if ($exam->shuffle_options) {
            $questions->transform(function ($q) use ($seed) {
                if (is_array($q->options)) {
                    $opts = $q->options;
                    if ($seed !== null) {
                        usort($opts, fn ($a, $b) => strcmp(md5($seed.$q->id.$a), md5($seed.$q->id.$b)));
                    } else {
                        shuffle($opts);
                    }
                    $q->options = $opts;
                }

                return $q;
            });
        }

        return $questions->toArray();
    }
}
