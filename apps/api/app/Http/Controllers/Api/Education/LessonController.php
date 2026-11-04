<?php

namespace App\Http\Controllers\Api\Education;

use App\Domain\Billing\Services\ContentAccessPolicy;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LessonController extends Controller
{
    /**
     * Authorize lesson management based on course ownership.
     */
    protected function authorizeLesson(TenantUser $user, Lesson $lesson, string $permission): void
    {
        if (! $user->hasPermissionTo($permission)) {
            throw new AuthorizationException("You do not have permission [$permission] to perform this action.");
        }

        $scope = ScopeResolver::resolveScope($user, $permission);
        if ($scope === 'own') {
            if (! $user->staff || $lesson->course->teacher_staff_id !== $user->staff->id) {
                throw new AuthorizationException('You can only modify lessons in your own courses.');
            }
        }
    }

    /**
     * List lessons of a course.
     */
    public function index(Request $request, string $courseId, ContentAccessPolicy $policy): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        $lessonsWithAccess = $course->lessons()->with(['materials', 'mediaAssets'])->get()->map(function ($lesson) use ($policy, $request) {
            $lessonArray = $lesson->toArray();
            $lessonArray['access'] = $policy->canAccessLesson($request->user(), $lesson)->toArray();

            return $lessonArray;
        });

        return ApiResponse::success(['lessons' => $lessonsWithAccess]);
    }

    /**
     * Create a lesson in a course (optionally inside a module).
     */
    public function store(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('lessons.create')) {
            throw new AuthorizationException('You do not have permission to create lessons.');
        }

        $scope = ScopeResolver::resolveScope($user, 'lessons.create');
        if ($scope === 'own' && (! $user->staff || $course->teacher_staff_id !== $user->staff->id)) {
            throw new AuthorizationException('You can only create lessons in your own courses.');
        }

        $validated = $request->validate([
            'module_id' => 'nullable|uuid|exists:tenant.course_modules,id',
            'title' => 'required|string|max:255',
            'content' => 'nullable|string',
            'type' => 'nullable|string|in:video,document,text,assignment,exam,live',
            'duration_seconds' => 'nullable|integer|min:0',
            'ref_id' => 'nullable|string|max:100',
            'sort_order' => 'nullable|integer',
            'status' => 'nullable|string|in:draft,published',
            'is_free_preview' => 'nullable|boolean',
        ]);

        $maxOrder = $course->lessons()
            ->when(! empty($validated['module_id']), fn ($q) => $q->where('module_id', $validated['module_id']))
            ->max('sort_order') ?? 0;

        $lesson = $course->lessons()->create([
            'module_id' => $validated['module_id'] ?? null,
            'title' => $validated['title'],
            'content' => $validated['content'] ?? null,
            'type' => $validated['type'] ?? 'text',
            'duration_seconds' => $validated['duration_seconds'] ?? null,
            'ref_id' => $validated['ref_id'] ?? null,
            'sort_order' => $validated['sort_order'] ?? ($maxOrder + 1),
            'status' => $validated['status'] ?? 'published',
            'is_free_preview' => $validated['is_free_preview'] ?? false,
            'published_at' => ($validated['status'] ?? 'published') === 'published' ? now() : null,
        ]);

        return ApiResponse::success(['lesson' => $lesson->load(['materials', 'mediaAssets'])], Response::HTTP_CREATED);
    }

    /**
     * Show a specific lesson.
     */
    public function show(Request $request, string $courseId, string $id, ContentAccessPolicy $policy): JsonResponse
    {
        $course = Course::findOrFail($courseId);
        $lesson = $course->lessons()->with(['materials', 'mediaAssets', 'module'])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        $decision = $policy->canAccessLesson($user, $lesson);

        if (! $decision->isAllowed() && $user->student) {
            return ApiResponse::error(
                'ACCESS_REQUIRES_SUBSCRIPTION',
                'Access to this lesson requires an active subscription.',
                Response::HTTP_FORBIDDEN,
                [
                    'access' => $decision->toArray(),
                    'required_package_ids' => $decision->requiredPackageIds,
                    'reason' => $decision->reason,
                ]
            );
        }

        if (! $decision->isAllowed()) {
            throw new AuthorizationException('You are not authorized to view this lesson.');
        }

        $lessonData = $lesson->toArray();
        $lessonData['access'] = $decision->toArray();

        // If student, attach progress
        if ($user->student) {
            $prog = LessonProgress::where('student_id', $user->student->id)
                ->where('lesson_id', $lesson->id)
                ->first();

            $lessonData['progress'] = $prog ? [
                'percent' => $prog->percent,
                'last_position_seconds' => $prog->last_position_seconds,
                'completed_at' => $prog->completed_at?->toIso8601String(),
                'watch_seconds' => $prog->watch_seconds,
            ] : [
                'percent' => 0,
                'last_position_seconds' => 0,
                'completed_at' => null,
                'watch_seconds' => 0,
            ];
        }

        return ApiResponse::success(['lesson' => $lessonData]);
    }

    /**
     * Update an existing lesson.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $lesson = Lesson::with('course')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeLesson($user, $lesson, 'lessons.update');

        $validated = $request->validate([
            'module_id' => 'nullable|uuid|exists:tenant.course_modules,id',
            'title' => 'sometimes|required|string|max:255',
            'content' => 'nullable|string',
            'type' => 'nullable|string|in:video,document,text,assignment,exam,live',
            'duration_seconds' => 'nullable|integer|min:0',
            'ref_id' => 'nullable|string|max:100',
            'sort_order' => 'nullable|integer',
            'status' => 'nullable|string|in:draft,published',
            'is_free_preview' => 'nullable|boolean',
        ]);

        $lesson->update(array_filter($validated, fn ($val) => $val !== null));

        return ApiResponse::success(['lesson' => $lesson->fresh()->load(['materials', 'mediaAssets'])]);
    }

    /**
     * Delete a lesson.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $lesson = Lesson::with('course')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeLesson($user, $lesson, 'lessons.delete');

        $lesson->delete();

        return ApiResponse::success(['message' => 'Lesson deleted successfully.']);
    }

    /**
     * Publish a lesson.
     */
    public function publish(Request $request, string $id): JsonResponse
    {
        $lesson = Lesson::with('course')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeLesson($user, $lesson, 'lessons.update');

        $lesson->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        return ApiResponse::success([
            'message' => 'Lesson published successfully.',
            'lesson' => $lesson->fresh(),
        ]);
    }

    /**
     * Unpublish a lesson (set to draft).
     */
    public function unpublish(Request $request, string $id): JsonResponse
    {
        $lesson = Lesson::with('course')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeLesson($user, $lesson, 'lessons.update');

        $lesson->update([
            'status' => 'draft',
        ]);

        return ApiResponse::success([
            'message' => 'Lesson unpublished successfully.',
            'lesson' => $lesson->fresh(),
        ]);
    }

    /**
     * Reorder lessons within a module.
     */
    public function reorder(Request $request, string $moduleId): JsonResponse
    {
        $module = CourseModule::with('course')->findOrFail($moduleId);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('lessons.reorder')) {
            throw new AuthorizationException('You do not have permission to reorder lessons.');
        }

        $scope = ScopeResolver::resolveScope($user, 'lessons.reorder');
        if ($scope === 'own' && (! $user->staff || $module->course->teacher_staff_id !== $user->staff->id)) {
            throw new AuthorizationException('You can only reorder lessons in your own courses.');
        }

        $validated = $request->validate([
            'lessons' => 'required|array',
            'lessons.*.id' => 'required|uuid|exists:tenant.lessons,id',
            'lessons.*.sort_order' => 'required|integer',
        ]);

        foreach ($validated['lessons'] as $item) {
            Lesson::where('id', $item['id'])
                ->where('module_id', $module->id)
                ->update(['sort_order' => $item['sort_order']]);
        }

        return ApiResponse::success([
            'message' => 'Lessons reordered successfully.',
            'lessons' => $module->lessons()->get(),
        ]);
    }

    /**
     * Student marks non-video or any lesson complete manually.
     */
    public function complete(Request $request, string $id, ContentAccessPolicy $policy): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only student accounts can record lesson completion.',
                Response::HTTP_FORBIDDEN
            );
        }

        $lesson = Lesson::with('course')->findOrFail($id);

        $decision = $policy->canAccessLesson($user, $lesson);
        if (! $decision->isAllowed()) {
            return ApiResponse::error(
                'ACCESS_DENIED',
                'You do not have access to complete this lesson.',
                Response::HTTP_FORBIDDEN
            );
        }

        $progress = LessonProgress::firstOrCreate(
            [
                'student_id' => $user->student->id,
                'lesson_id' => $lesson->id,
            ],
            [
                'percent' => 100,
                'last_position_seconds' => $lesson->duration_seconds ?? 0,
                'completed_at' => now(),
                'watch_seconds' => $lesson->duration_seconds ?? 0,
                'rewatch_count' => 0,
            ]
        );

        if (! $progress->wasRecentlyCreated) {
            $progress->update([
                'percent' => 100,
                'completed_at' => $progress->completed_at ?? now(),
            ]);
        }

        return ApiResponse::success([
            'message' => 'Lesson marked as completed.',
            'progress' => $progress->fresh(),
        ]);
    }
}
