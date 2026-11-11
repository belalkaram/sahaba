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
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
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

        // 1. Pending Assignment Submissions (submitted but not graded)
        $pendingSubmissions = AssignmentSubmission::with(['assignment.course', 'student.user'])
            ->pendingGrading()
            ->whereHas('assignment', fn ($q) => $q->whereIn('course_id', $this->gradableCourses($user, 'assignments.grade')))
            ->latest('submitted_at')
            ->get();

        // 2. Pending Exam Attempts (submitted but with ungraded essay questions or not finalized)
        $pendingAttempts = ExamAttempt::with(['exam.course', 'student.user', 'answers.question'])
            ->pendingGrading()
            ->whereHas('exam', fn ($q) => $q->whereIn('course_id', $this->gradableCourses($user, 'exams.grade')))
            ->latest('submitted_at')
            ->get();

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

        /** @var TenantUser $user */
        $user = $request->user();

        // Checked before any write: one item outside the caller's scope rejects the whole request.
        $this->assertGradable($user, 'exams.grade', Exam::query(), $validated['exam_ids'] ?? []);
        $this->assertGradable($user, 'assignments.grade', Assignment::query(), $validated['assignment_ids'] ?? []);

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

    /** Courses whose work the caller may grade under this permission's role scope. */
    private function gradableCourses(TenantUser $user, string $permission): Builder
    {
        return ScopeResolver::scopeCourses(Course::query(), $user, $permission)->select('courses.id');
    }

    /**
     * @param  Builder  $items  exams or assignments
     * @param  array<int, string>  $ids
     */
    private function assertGradable(TenantUser $user, string $permission, Builder $items, array $ids): void
    {
        $ids = array_unique($ids);
        if ($ids === []) {
            return;
        }

        $allowed = $items->whereIn('id', $ids)->whereIn('course_id', $this->gradableCourses($user, $permission))->count();

        if ($allowed !== count($ids)) {
            throw new AuthorizationException('You can only publish grades for courses within your scope.');
        }
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
