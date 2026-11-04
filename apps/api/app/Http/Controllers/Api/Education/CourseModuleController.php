<?php

namespace App\Http\Controllers\Api\Education;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CourseModuleController extends Controller
{
    /**
     * Check if user is authorized to manage the given course.
     */
    protected function authorizeCourseManagement(TenantUser $user, Course $course, string $permission = 'courses.update'): void
    {
        if (! $user->hasPermissionTo($permission)) {
            throw new AuthorizationException('You do not have permission to manage this course.');
        }

        // Check scope
        $scope = ScopeResolver::resolveScope($user, $permission);
        if ($scope === 'own') {
            if (! $user->staff || $course->teacher_staff_id !== $user->staff->id) {
                throw new AuthorizationException('You can only manage your own courses.');
            }
        }
    }

    /**
     * List modules for a course.
     */
    public function index(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);
        $modules = $course->modules()->with(['lessons.materials', 'lessons.mediaAssets'])->get();

        return ApiResponse::success(['modules' => $modules]);
    }

    /**
     * Create a module in a course.
     */
    public function store(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeCourseManagement($user, $course, 'courses.update');

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'status' => 'nullable|string|in:draft,published',
        ]);

        $maxOrder = $course->modules()->max('sort_order') ?? 0;

        $module = $course->modules()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'sort_order' => $validated['sort_order'] ?? ($maxOrder + 1),
            'status' => $validated['status'] ?? 'published',
        ]);

        return ApiResponse::success(['module' => $module], Response::HTTP_CREATED);
    }

    /**
     * Update an existing module.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $module = CourseModule::with('course')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeCourseManagement($user, $module->course, 'courses.update');

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'status' => 'nullable|string|in:draft,published',
        ]);

        $module->update(array_filter($validated, fn ($val) => $val !== null));

        return ApiResponse::success(['module' => $module->fresh()]);
    }

    /**
     * Delete a module.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $module = CourseModule::with('course')->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeCourseManagement($user, $module->course, 'courses.delete');

        $module->delete();

        return ApiResponse::success(['message' => 'Module deleted successfully.']);
    }

    /**
     * Reorder modules within a course.
     */
    public function reorder(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeCourseManagement($user, $course, 'lessons.reorder');

        $validated = $request->validate([
            'modules' => 'required|array',
            'modules.*.id' => 'required|uuid|exists:tenant.course_modules,id',
            'modules.*.sort_order' => 'required|integer',
        ]);

        foreach ($validated['modules'] as $item) {
            $course->modules()->where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return ApiResponse::success([
            'message' => 'Modules reordered successfully.',
            'modules' => $course->modules()->get(),
        ]);
    }
}
