<?php

namespace App\Http\Controllers\Api\Identity;

use App\Domain\Identity\Services\UserManagementService;
use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StaffController extends Controller
{
    public function __construct(
        protected UserManagementService $userService
    ) {}

    /**
     * List all staff members.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('staff.manage') && ! $user->hasPermissionTo('users.view')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view staff.');
        }

        $query = Staff::with(['user.roles', 'branches', 'assignments']);

        if ($request->filled('staff_type')) {
            $query->where('staff_type', $request->staff_type);
        }

        if ($request->filled('branch_id')) {
            $branchId = $request->branch_id;
            $query->whereHas('branches', function ($q) use ($branchId) {
                $q->where('branches.id', $branchId);
            });
        }

        $staff = $query->get();

        return ApiResponse::success(['staff' => $staff]);
    }

    /**
     * Show a staff member.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('staff.manage') && ! $user->hasPermissionTo('users.view')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view staff.');
        }

        $staff = Staff::with(['user.roles', 'branches', 'assignments', 'courses', 'classes'])->findOrFail($id);

        return ApiResponse::success(['staff' => $staff]);
    }

    /**
     * Create a new staff member.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('staff.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage staff.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:30',
            'password' => 'nullable|string|min:6',
            'staff_type' => 'required|string|in:teacher,assistant,admin,finance,receptionist',
            'roles' => 'nullable|array',
            'roles.*' => 'string',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'string',
            'branch_ids' => 'nullable|array',
            'branch_ids.*' => 'string',
            'assignments' => 'nullable|array',
            'assignments.*.assignable_type' => 'required|string|in:class,course,student',
            'assignments.*.assignable_id' => 'required|string',
            'assignments.*.role_context' => 'nullable|string|max:50',
            'status' => 'nullable|string|in:active,suspended',
        ]);

        $staff = $this->userService->createStaff($validated, $user);

        return ApiResponse::success(['staff' => $staff], Response::HTTP_CREATED);
    }

    /**
     * Add assignments to a staff member.
     */
    public function assign(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('staff.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage staff assignments.');
        }

        $staff = Staff::findOrFail($id);

        $validated = $request->validate([
            'assignments' => 'required|array|min:1',
            'assignments.*.assignable_type' => 'required|string|in:class,course,student',
            'assignments.*.assignable_id' => 'required|string',
            'assignments.*.role_context' => 'nullable|string|max:50',
        ]);

        $this->userService->assignStaff($staff, $validated['assignments'], $user);

        return ApiResponse::success([
            'staff' => $staff->fresh(['assignments']),
            'message' => 'Assignments updated successfully.',
        ]);
    }
}
