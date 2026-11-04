<?php

namespace App\Http\Controllers\Api\Education;

use App\Domain\Billing\Services\ContentAccessPolicy;
use App\Domain\Education\Services\ProgressAggregator;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VideoEventController extends Controller
{
    /**
     * Submit a batch of playback events for a lesson.
     */
    public function store(
        Request $request,
        string $id,
        ContentAccessPolicy $policy,
        ProgressAggregator $aggregator
    ): JsonResponse {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only student accounts can record playback events.',
                Response::HTTP_FORBIDDEN
            );
        }

        $lesson = Lesson::with('course')->findOrFail($id);

        $decision = $policy->canAccessLesson($user, $lesson);
        if (! $decision->isAllowed()) {
            return ApiResponse::error(
                'ACCESS_DENIED',
                'You do not have access to stream this lesson.',
                Response::HTTP_FORBIDDEN
            );
        }

        $validated = $request->validate([
            'events' => 'required|array|min:1|max:50',
            'events.*.type' => 'required|string|in:start,heartbeat,seek,pause,end',
            'events.*.position_seconds' => 'required|numeric|min:0',
            'events.*.client_ts' => 'nullable|integer',
        ]);

        $progress = $aggregator->processBatch($user->student, $lesson, $validated['events']);

        return ApiResponse::success([
            'progress' => [
                'percent' => $progress->percent,
                'last_position_seconds' => $progress->last_position_seconds,
                'completed_at' => $progress->completed_at?->toIso8601String(),
                'watch_seconds' => $progress->watch_seconds,
            ],
        ]);
    }

    /**
     * Student checks their own progress across courses or for a specific course.
     */
    public function myProgress(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only students have learning progress.',
                Response::HTTP_FORBIDDEN
            );
        }

        $query = LessonProgress::with('lesson')
            ->where('student_id', $user->student->id);

        if ($request->filled('course_id')) {
            $courseId = $request->query('course_id');
            $query->whereHas('lesson', fn ($q) => $q->where('course_id', $courseId));
        }

        $records = $query->get();

        return ApiResponse::success(['progress' => $records]);
    }

    /**
     * Staff overview of course completion progress across enrolled students.
     */
    public function courseProgress(Request $request, string $courseId): JsonResponse
    {
        $course = Course::with(['lessons', 'students.user'])->findOrFail($courseId);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('courses.view')) {
            throw new AuthorizationException('You do not have permission to view course progress.');
        }

        $scope = ScopeResolver::resolveScope($user, 'courses.view');
        if ($scope === 'own' && (! $user->staff || $course->teacher_staff_id !== $user->staff->id)) {
            throw new AuthorizationException('You can only view progress for your own courses.');
        }

        $totalLessons = $course->lessons->count();
        $lessonIds = $course->lessons->pluck('id');

        $studentsProgress = $course->students->map(function ($student) use ($lessonIds, $totalLessons) {
            $progressRecords = LessonProgress::where('student_id', $student->id)
                ->whereIn('lesson_id', $lessonIds)
                ->get();

            $completedCount = $progressRecords->whereNotNull('completed_at')->count();
            $avgPercent = $progressRecords->isEmpty()
                ? 0
                : (int) round($progressRecords->avg('percent'));

            return [
                'student_id' => $student->id,
                'name' => $student->user?->name,
                'student_code' => $student->student_code,
                'lessons_completed' => $completedCount,
                'total_lessons' => $totalLessons,
                'completion_percent' => $avgPercent,
                'last_active' => $progressRecords->max('updated_at'),
            ];
        });

        return ApiResponse::success([
            'course_id' => $course->id,
            'total_students' => $studentsProgress->count(),
            'students' => $studentsProgress,
        ]);
    }
}
