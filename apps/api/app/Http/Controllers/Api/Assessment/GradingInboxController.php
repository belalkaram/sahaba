<?php

namespace App\Http\Controllers\Api\Assessment;

use App\Domain\Communication\NotificationService;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Grade;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GradingInboxController extends Controller
{
    /**
     * Get pending items needing grading across courses.
     */
    public function pending(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        // Scope to teacher's courses if user is a teacher staff
        $courseIds = null;
        if ($user->staff && $user->staff->staff_type === 'teacher') {
            $courseIds = Course::where('teacher_staff_id', $user->staff->id)->pluck('id');
        }

        // 1. Pending Assignment Submissions (submitted but not graded)
        $submissionsQuery = AssignmentSubmission::with(['assignment.course', 'student.user'])
            ->where('status', 'submitted')
            ->whereNull('score');

        if ($courseIds !== null) {
            $submissionsQuery->whereHas('assignment', function ($q) use ($courseIds) {
                $q->whereIn('course_id', $courseIds);
            });
        }

        $pendingSubmissions = $submissionsQuery->latest('submitted_at')->get();

        // 2. Pending Exam Attempts (submitted but with ungraded essay questions or not finalized)
        $attemptsQuery = ExamAttempt::with(['exam.course', 'student.user', 'answers.question'])
            ->where('status', 'submitted')
            ->where(function ($q) {
                $q->whereNull('score')
                    ->orWhereHas('answers', function ($aq) {
                        $aq->whereNull('awarded_points')
                            ->whereHas('question', function ($qq) {
                                $qq->where('question_type', 'essay');
                            });
                    });
            });

        if ($courseIds !== null) {
            $attemptsQuery->whereHas('exam', function ($q) use ($courseIds) {
                $q->whereIn('course_id', $courseIds);
            });
        }

        $pendingAttempts = $attemptsQuery->latest('submitted_at')->get();

        $totalPending = $pendingSubmissions->count() + $pendingAttempts->count();

        return ApiResponse::success([
            'count' => $totalPending,
            'submissions' => $pendingSubmissions,
            'attempts' => $pendingAttempts,
        ]);
    }

    /**
     * Bulk publish grades for exams and/or assignments.
     */
    public function bulkPublish(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'exam_ids' => 'nullable|array',
            'exam_ids.*' => 'uuid|exists:tenant.exams,id',
            'assignment_ids' => 'nullable|array',
            'assignment_ids.*' => 'uuid|exists:tenant.assignments,id',
        ]);

        $publishedCount = 0;

        if (! empty($validated['exam_ids'])) {
            Exam::whereIn('id', $validated['exam_ids'])->update(['is_grades_published' => true]);
            $this->notifyPublished('exam', Exam::whereIn('id', $validated['exam_ids'])->pluck('title', 'id'));
            Grade::where('gradable_type', 'exam')
                ->whereIn('gradable_id', $validated['exam_ids'])
                ->update(['is_published' => true]);
            $publishedCount += count($validated['exam_ids']);
        }

        if (! empty($validated['assignment_ids'])) {
            AssignmentSubmission::whereIn('assignment_id', $validated['assignment_ids'])
                ->update(['is_grade_published' => true]);
            $this->notifyPublished('assignment', Assignment::whereIn('id', $validated['assignment_ids'])->pluck('title', 'id'));
            Grade::where('gradable_type', 'assignment')
                ->whereIn('gradable_id', $validated['assignment_ids'])
                ->update(['is_published' => true]);
            $publishedCount += count($validated['assignment_ids']);
        }

        return ApiResponse::success([
            'message' => "Published grades for {$publishedCount} assessments successfully.",
            'published_count' => $publishedCount,
        ]);
    }

    /**
     * Notify students whose grade is about to become published.
     *
     * @param  iterable<string, string>  $titles  gradable id => title
     */
    private function notifyPublished(string $type, iterable $titles): void
    {
        foreach ($titles as $id => $title) {
            $studentIds = Grade::where('gradable_type', $type)
                ->where('gradable_id', $id)
                ->where('is_published', false)
                ->pluck('student_id');

            app(NotificationService::class)->gradesPublished($studentIds, $title);
        }
    }
}
