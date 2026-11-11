<?php

namespace App\Http\Controllers\Api\Education;

use App\Domain\Identity\Services\UserManagementService;
use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class StudentController extends Controller
{
    public function __construct(
        protected UserManagementService $userService
    ) {}

    /**
     * List all students in the tenant.
     * Requires 'students.view' permission.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('students.view')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view student data.');
        }

        $query = ScopeResolver::scopeStudents(Student::with(['user', 'parents.user', 'enrollments.course']), $user, 'students.view');

        if ($request->filled('grade_level')) {
            $query->where('grade_level', $request->grade_level);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->boolean('without_parent')) {
            $query->doesntHave('parents');
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('student_code', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        // Progressive loading: with `page` / `per_page` the list is paged (max 100 per page) and the response keeps the
        // same `data.students` shape plus `meta.pagination`. Without them the legacy full list is returned.
        if ($request->filled('page') || $request->filled('per_page')) {
            $perPage = max(1, min(100, (int) $request->input('per_page', 20)));
            $page = $query->orderBy('created_at')->orderBy('id')->paginate($perPage);
            $students = $page->getCollection();
            $this->attachAnalytics($request, $user, $students);

            return ApiResponse::success(['students' => $students], 200, [
                'pagination' => [
                    'total' => $page->total(),
                    'page' => $page->currentPage(),
                    'per_page' => $page->perPage(),
                    'last_page' => $page->lastPage(),
                ],
            ]);
        }

        $students = $query->get();
        $this->attachAnalytics($request, $user, $students);

        return ApiResponse::success(['students' => $students]);
    }

    /**
     * `include=analytics`: attach each student's pre-computed overall snapshot in ONE query (instead of one dashboard
     * request per student). Only for students the caller may see analytics for (same scope rule as the dashboard).
     *
     * @param  \Illuminate\Support\Collection<int, Student>  $students
     */
    private function attachAnalytics(Request $request, TenantUser $user, $students): void
    {
        if ($request->input('include') !== 'analytics' || $students->isEmpty() || ! $user->hasPermissionTo('analytics.view')) {
            return;
        }

        $ids = $students->pluck('id')->all();
        $allowed = ScopeResolver::scopeStudents(Student::query()->whereIn('id', $ids), $user, 'analytics.view')->pluck('id')->flip();
        $snapshots = \App\Models\StudentAnalyticsSnapshot::whereIn('student_id', $allowed->keys()->all())->whereNull('course_id')->get()->keyBy('student_id');

        foreach ($students as $student) {
            $student->setAttribute('analytics', $allowed->has($student->id) ? $snapshots->get($student->id) : null);
        }
    }

    /**
     * Show student profile and details.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $student = Student::with(['user', 'parents.user', 'enrollments.course'])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        $isSelf = $user->student && $user->student->id === $student->id;

        if (! $isSelf && ! ScopeResolver::canAccess($user, 'students.view', $student)) {
            throw new AuthorizationException('Forbidden. You do not have permission to view student data.');
        }

        return ApiResponse::success(['student' => $student]);
    }

    /**
     * Create a new student.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('students.create')) {
            throw new AuthorizationException('Forbidden. You do not have permission to create students.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:30',
            'password' => 'nullable|string|min:6',
            'grade_level' => 'nullable|string|max:50',
            'student_code' => 'nullable|string|max:50',
            'parent_id' => 'nullable|string',
            'parent_name' => 'nullable|string|max:255',
            'parent_phone' => 'nullable|string|max:30',
            'relation_type' => 'nullable|string|in:father,mother,guardian',
        ]);

        if (empty($validated['parent_id']) && (empty($validated['parent_name']) || empty($validated['parent_phone']))) {
            throw ValidationException::withMessages([
                'parent' => ['بيانات ولي الأمر إلزامية (يرجى اختيار ولي أمر موجود، أو إدخال اسم ورقم هاتف ولي الأمر).'],
            ]);
        }

        $student = $this->userService->createStudent($validated, $user);

        return ApiResponse::success(['student' => $student], Response::HTTP_CREATED);
    }

    /**
     * Update an existing student.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('students.update')) {
            throw new AuthorizationException('Forbidden. You do not have permission to update students.');
        }

        $student = Student::with('user')->findOrFail($id);
        $this->assertInScope($user, $student);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:30',
            'grade_level' => 'nullable|string|max:50',
            'status' => 'sometimes|string|in:active,suspended',
        ]);

        $updated = $this->userService->updateStudent($student, $validated, $user);

        return ApiResponse::success(['student' => $updated]);
    }

    /**
     * Suspend a student.
     */
    public function suspend(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('students.update') && ! $user->hasPermissionTo('users.suspend')) {
            throw new AuthorizationException('Forbidden. You do not have permission to suspend students.');
        }

        $student = Student::with('user')->findOrFail($id);
        $this->assertInScope($user, $student);
        $updated = $this->userService->setStudentStatus($student, 'suspended', $user);

        return ApiResponse::success(['student' => $updated, 'message' => 'Student suspended successfully.']);
    }

    /**
     * Activate a student.
     */
    public function activate(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('students.update') && ! $user->hasPermissionTo('users.suspend')) {
            throw new AuthorizationException('Forbidden. You do not have permission to activate students.');
        }

        $student = Student::with('user')->findOrFail($id);
        $this->assertInScope($user, $student);
        $updated = $this->userService->setStudentStatus($student, 'active', $user);

        return ApiResponse::success(['student' => $updated, 'message' => 'Student activated successfully.']);
    }

    /**
     * Holding an update permission is not enough: the student must be inside the holder's scope.
     */
    private function assertInScope(TenantUser $user, Student $student): void
    {
        $allowed = ScopeResolver::canAccess($user, 'students.update', $student)
            || ScopeResolver::canAccess($user, 'users.suspend', $student);

        if (! $allowed) {
            throw new AuthorizationException('Forbidden. This student is outside your scope.');
        }
    }
}
