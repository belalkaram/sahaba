<?php

namespace App\Http\Controllers\Api\Education;

use App\Domain\Billing\Services\ContentAccessPolicy;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\LessonProgress;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\AbacEngine;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CourseController extends Controller
{
    /**
     * Authorize action on a course based on role scope.
     */
    protected function authorizeCourse(TenantUser $user, Course $course, string $permission): void
    {
        if (! $user->hasPermissionTo($permission)) {
            throw new AuthorizationException("You do not have permission [$permission] to perform this action.");
        }

        $abacEngine = app(AbacEngine::class);
        if (! $abacEngine->authorize($user, $permission, $course)) {
            throw new AuthorizationException('Forbidden. Denied by ABAC policy.');
        }

        $scope = ScopeResolver::resolveScope($user, $permission);
        if ($scope === 'own') {
            if (! $user->staff || $course->teacher_staff_id !== $user->staff->id) {
                throw new AuthorizationException('You can only modify courses that belong to you.');
            }
        }
    }

    /**
     * List courses accessible to the authenticated user.
     */
    public function index(Request $request, ContentAccessPolicy $policy): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if ($user->hasPermissionTo('courses.view')) {
            $query = Course::query()->with(['teacher.user', 'lessons']);
            $query = ScopeResolver::scopeCourses($query, $user, 'courses.view');
            $courses = $query->get();

            $policy->preloadForCourses($user, $courses);
            $coursesWithAccess = $courses->map(function ($course) use ($policy, $user) {
                $courseArray = $course->toArray();
                $courseArray['access'] = $policy->canAccessCourse($user, $course)->toArray();

                return $courseArray;
            });

            return ApiResponse::success(['courses' => $coursesWithAccess]);
        }

        // For student, show enrolled courses and published courses
        if ($user->student) {
            $studentId = $user->student->id;
            $courses = Course::with(['teacher.user', 'lessons'])
                ->where('status', 'published')
                ->orWhereHas('enrollments', function ($query) use ($studentId) {
                    $query->where('student_id', $studentId)->where('status', 'active');
                })
                ->get();

            $policy->preloadForCourses($user, $courses);
            $coursesWithAccess = $courses->map(function ($course) use ($policy, $user) {
                $courseArray = $course->toArray();
                $courseArray['access'] = $policy->canAccessCourse($user, $course)->toArray();

                return $courseArray;
            });

            return ApiResponse::success(['courses' => $coursesWithAccess]);
        }

        return ApiResponse::success(['courses' => []]);
    }

    /**
     * Create a new course.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('courses.create')) {
            throw new AuthorizationException('You do not have permission to create courses.');
        }

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'level' => 'nullable|string|in:beginner,intermediate,advanced',
            'status' => 'nullable|string|in:draft,published,archived',
            'is_free' => 'nullable|boolean',
        ]);

        $course = Course::create([
            'teacher_staff_id' => $user->staff?->id,
            'title' => $validated['title'] ?? 'New Course',
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'level' => $validated['level'] ?? null,
            'status' => $validated['status'] ?? 'draft',
            'is_free' => $validated['is_free'] ?? false,
            'published_at' => ($validated['status'] ?? 'draft') === 'published' ? now() : null,
        ]);

        return ApiResponse::success([
            'message' => 'Course created successfully.',
            'course' => $course->load(['teacher.user']),
        ]);
    }

    /**
     * Show a course.
     */
    public function show(Request $request, string $id, ContentAccessPolicy $policy): JsonResponse
    {
        $course = Course::with(['teacher.user', 'modules.lessons'])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        $decision = $policy->canAccessCourse($user, $course);

        if (! $decision->isAllowed() && $user->student) {
            return ApiResponse::error(
                'ACCESS_REQUIRES_SUBSCRIPTION',
                'Access to this course requires an active subscription.',
                Response::HTTP_FORBIDDEN,
                [
                    'access' => $decision->toArray(),
                    'required_package_ids' => $decision->requiredPackageIds,
                    'reason' => $decision->reason,
                ]
            );
        }

        if (! $decision->isAllowed()) {
            throw new AuthorizationException('You are not authorized to view this course.');
        }

        $courseData = $course->toArray();
        $courseData['access'] = $decision->toArray();

        return ApiResponse::success(['course' => $courseData]);
    }

    /**
     * Get hierarchical course outline with modules, lessons, materials, access, and progress.
     */
    public function outline(Request $request, string $id, ContentAccessPolicy $policy): JsonResponse
    {
        $course = Course::with([
            'teacher.user',
            'modules' => fn ($q) => $q->orderBy('sort_order', 'asc'),
            'modules.lessons' => fn ($q) => $q->orderBy('sort_order', 'asc'),
            'modules.lessons.materials' => fn ($q) => $q->orderBy('sort_order', 'asc'),
            'modules.lessons.mediaAssets',
        ])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $isStudent = (bool) $user->student;

        // Fetch student progress if student
        $progressMap = [];
        if ($isStudent) {
            $lessonIds = $course->modules->flatMap->lessons->pluck('id');
            $progressMap = LessonProgress::where('student_id', $user->student->id)
                ->whereIn('lesson_id', $lessonIds)
                ->get()
                ->keyBy('lesson_id');
        }

        $courseDecision = $policy->canAccessCourse($user, $course);

        $modulesData = $course->modules->map(function ($module) use ($policy, $user, $isStudent, $progressMap) {
            $moduleArray = $module->toArray();
            $moduleArray['lessons'] = $module->lessons->map(function ($lesson) use ($policy, $user, $isStudent, $progressMap) {
                $lessonArray = $lesson->toArray();
                if ($isStudent) {
                    $lessonArray['access'] = $policy->canAccessLesson($user, $lesson)->toArray();
                    $prog = $progressMap->get($lesson->id);
                    $lessonArray['progress'] = $prog ? [
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

                return $lessonArray;
            });

            return $moduleArray;
        });

        return ApiResponse::success([
            'course' => [
                'id' => $course->id,
                'title' => $course->title,
                'code' => $course->code,
                'description' => $course->description,
                'has_cover' => (bool) $course->cover_path,
                'level' => $course->level,
                'status' => $course->status,
                'is_free' => (bool) $course->is_free,
                'is_public' => (bool) $course->is_public,
                'teacher' => $course->teacher,
                'access' => $courseDecision->toArray(),
                'modules' => $modulesData,
            ],
        ]);
    }

    /**
     * Update an existing course with ownership boundary.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeCourse($user, $course, 'courses.update');

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'level' => 'nullable|string|in:beginner,intermediate,advanced',
            'status' => 'nullable|string|in:draft,published,archived',
            'is_free' => 'nullable|boolean',
            'is_public' => 'nullable|boolean',
        ]);

        if (isset($validated['status']) && $validated['status'] === 'published' && ! $course->published_at) {
            $validated['published_at'] = now();
        }

        $course->update(array_filter($validated, fn ($val) => $val !== null));

        return ApiResponse::success([
            'message' => 'Course updated successfully.',
            'course' => $course->fresh()->load('teacher.user'),
        ]);
    }

    /**
     * Publish course.
     */
    public function publish(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeCourse($user, $course, 'courses.publish');

        $course->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        return ApiResponse::success([
            'message' => 'Course published successfully.',
            'course' => $course->fresh(),
        ]);
    }

    /**
     * Unpublish course (set to draft).
     */
    public function unpublish(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeCourse($user, $course, 'courses.publish');

        $course->update([
            'status' => 'draft',
        ]);

        return ApiResponse::success([
            'message' => 'Course unpublished successfully.',
            'course' => $course->fresh(),
        ]);
    }

    /**
     * Delete a course.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeCourse($user, $course, 'courses.delete');

        $course->delete();

        return ApiResponse::success([
            'message' => 'Course deleted successfully.',
        ]);
    }
}
