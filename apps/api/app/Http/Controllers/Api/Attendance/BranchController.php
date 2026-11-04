<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Classroom;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BranchController extends Controller
{
    /**
     * List all branches.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('branches.manage') && ! $user->hasPermissionTo('classrooms.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view branches.');
        }

        $query = Branch::with(['classrooms']);

        // Branch scope
        $scope = $user->permissionScope('branches.manage');
        if ($scope === 'branch') {
            $assignedBranchIds = $user->staff?->branches()->pluck('branches.id')->toArray() ?? [];
            $query->whereIn('id', $assignedBranchIds);
        }

        $branches = $query->get();

        return ApiResponse::success(['branches' => $branches]);
    }

    /**
     * Show a branch with its classrooms.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('branches.manage') && ! $user->hasPermissionTo('classrooms.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view branches.');
        }

        $branch = Branch::with('classrooms')->findOrFail($id);

        return ApiResponse::success(['branch' => $branch]);
    }

    /**
     * Create a new branch.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('branches.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage branches.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'status' => 'nullable|string|in:active,inactive',
        ]);

        $branch = Branch::create($validated);

        AuditLogger::log(
            action: 'branch.created',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'Branch',
            entityId: $branch->id,
            payload: $validated,
            actorId: $user->id,
            actorType: 'tenant_user'
        );

        return ApiResponse::success(['branch' => $branch], Response::HTTP_CREATED);
    }

    /**
     * Update a branch.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('branches.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage branches.');
        }

        $branch = Branch::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:50',
            'status' => 'sometimes|string|in:active,inactive',
        ]);

        $branch->update($validated);

        AuditLogger::log(
            action: 'branch.updated',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'Branch',
            entityId: $branch->id,
            payload: $validated,
            actorId: $user->id,
            actorType: 'tenant_user'
        );

        return ApiResponse::success(['branch' => $branch]);
    }

    /**
     * Delete a branch.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('branches.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to delete branches.');
        }

        $branch = Branch::withCount('classrooms')->findOrFail($id);

        if ($branch->classrooms_count > 0) {
            return ApiResponse::error(
                'BRANCH_NOT_EMPTY',
                'Cannot delete branch that has classrooms attached.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $branch->delete();

        AuditLogger::log(
            action: 'branch.deleted',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'Branch',
            entityId: $id,
            payload: ['name' => $branch->name],
            actorId: $user->id,
            actorType: 'tenant_user'
        );

        return ApiResponse::success(['message' => 'Branch deleted successfully.']);
    }

    /**
     * List classrooms in a branch.
     */
    public function classrooms(Request $request, string $id): JsonResponse
    {
        $branch = Branch::with('classrooms')->findOrFail($id);

        return ApiResponse::success(['classrooms' => $branch->classrooms]);
    }

    /**
     * Create a classroom in a branch.
     */
    public function storeClassroom(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('classrooms.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage classrooms.');
        }

        $branch = Branch::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'capacity' => 'nullable|integer|min:1',
            'status' => 'nullable|string|in:active,inactive',
        ]);

        $validated['branch_id'] = $branch->id;
        $classroom = Classroom::create($validated);

        AuditLogger::log(
            action: 'classroom.created',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'Classroom',
            entityId: $classroom->id,
            payload: $validated,
            actorId: $user->id,
            actorType: 'tenant_user'
        );

        return ApiResponse::success(['classroom' => $classroom], Response::HTTP_CREATED);
    }
}
