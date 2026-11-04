<?php

namespace App\Http\Controllers\Api\Identity;

use App\Domain\Identity\Services\UserManagementService;
use App\Http\Controllers\Controller;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        protected UserManagementService $userService
    ) {}

    /**
     * List users with filtering and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('users.view')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view users.');
        }

        $filters = $request->only(['persona', 'role', 'status', 'branch_id', 'search', 'page', 'per_page']);
        $users = $this->userService->listUsers($filters, $user);

        return ApiResponse::paginated($users);
    }

    /**
     * Show a user with full profile and permissions.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if ($user->id !== $id && ! $user->hasPermissionTo('users.view')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view this user.');
        }

        $targetUser = TenantUser::with([
            'roles.permissions',
            'student.parents.user',
            'student.classes',
            'staff.branches',
            'staff.assignments',
            'parentProfile.students.user',
        ])->findOrFail($id);

        return ApiResponse::success(['user' => $targetUser]);
    }

    /**
     * Reset password for a tenant user.
     */
    public function resetPassword(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('users.update')) {
            throw new AuthorizationException('Forbidden. You do not have permission to reset user passwords.');
        }

        $targetUser = TenantUser::findOrFail($id);
        $validated = $request->validate([
            'password' => 'nullable|string|min:6',
        ]);

        $tempPassword = $this->userService->resetPassword(
            $targetUser,
            $validated['password'] ?? null,
            $user
        );

        return ApiResponse::success([
            'message' => 'Password reset successfully.',
            'temporary_password' => $tempPassword,
        ]);
    }
}
