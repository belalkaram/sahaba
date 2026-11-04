<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ClassController extends Controller
{
    /**
     * List classes with scoping.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $query = SchoolClass::with(['teacher.user', 'students', 'branch']);
        $query = ScopeResolver::scopeClasses($query, $user, 'classes.view');

        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->query('branch_id'));
        }

        $classes = $query->orderBy('name')->get();

        return ApiResponse::success(['classes' => $classes]);
    }

    /**
     * Create a class.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'branch_id' => 'nullable|uuid|exists:tenant.branches,id',
            'teacher_staff_id' => 'nullable|uuid|exists:tenant.staff,id',
            'status' => 'nullable|string|in:active,archived',
        ]);

        /** @var TenantUser $user */
        $user = $request->user();

        $class = SchoolClass::create([
            'teacher_staff_id' => $validated['teacher_staff_id'] ?? $user->staff?->id,
            'branch_id' => $validated['branch_id'] ?? null,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'status' => $validated['status'] ?? 'active',
        ]);

        return ApiResponse::success(['class' => $class->load(['teacher.user', 'branch'])], Response::HTTP_CREATED);
    }

    /**
     * Show class details.
     */
    public function show(string $id): JsonResponse
    {
        $class = SchoolClass::with([
            'teacher.user',
            'students.user',
            'branch',
            'sessions' => fn ($q) => $q->orderBy('starts_at', 'desc')->with('classroom'),
        ])->findOrFail($id);

        return ApiResponse::success(['class' => $class]);
    }

    /**
     * Update a class.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $class = SchoolClass::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:50',
            'branch_id' => 'nullable|uuid|exists:tenant.branches,id',
            'teacher_staff_id' => 'nullable|uuid|exists:tenant.staff,id',
            'status' => 'nullable|string|in:active,archived',
        ]);

        $class->update($validated);

        return ApiResponse::success(['class' => $class->fresh()->load(['teacher.user', 'branch'])]);
    }

    /**
     * Delete a class.
     */
    public function destroy(string $id): JsonResponse
    {
        $class = SchoolClass::findOrFail($id);
        $class->delete();

        return ApiResponse::success(['message' => 'Class deleted successfully.']);
    }

    /**
     * Enroll student into class.
     */
    public function enrollStudent(Request $request, string $id): JsonResponse
    {
        $class = SchoolClass::findOrFail($id);

        $validated = $request->validate([
            'student_id' => 'required|uuid|exists:tenant.students,id',
        ]);

        $class->students()->syncWithoutDetaching([
            $validated['student_id'] => [
                'id' => (string) Str::uuid(),
                'status' => 'active',
                'enrolled_at' => now(),
            ],
        ]);

        return ApiResponse::success(['message' => 'Student enrolled into class successfully.'], Response::HTTP_CREATED);
    }

    /**
     * Remove student from class roster.
     */
    public function removeStudent(string $id, string $studentId): JsonResponse
    {
        $class = SchoolClass::findOrFail($id);
        $class->students()->detach($studentId);

        return ApiResponse::success(['message' => 'Student removed from class successfully.']);
    }
}
