<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClassroomController extends Controller
{
    /**
     * List all classrooms.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('classrooms.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view classrooms.');
        }

        $classrooms = Classroom::with('branch')->get();

        return ApiResponse::success(['classrooms' => $classrooms]);
    }

    /**
     * Show a classroom.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $classroom = Classroom::with('branch')->findOrFail($id);

        return ApiResponse::success(['classroom' => $classroom]);
    }

    /**
     * Update a classroom.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('classrooms.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage classrooms.');
        }

        $classroom = Classroom::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'capacity' => 'nullable|integer|min:1',
            'status' => 'sometimes|string|in:active,inactive',
            'branch_id' => 'nullable|string',
        ]);

        $classroom->update($validated);

        AuditLogger::log(
            action: 'classroom.updated',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'Classroom',
            entityId: $classroom->id,
            payload: $validated,
            actorId: $user->id,
            actorType: 'tenant_user'
        );

        return ApiResponse::success(['classroom' => $classroom]);
    }

    /**
     * Delete a classroom.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('classrooms.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage classrooms.');
        }

        $classroom = Classroom::findOrFail($id);
        $classroom->delete();

        AuditLogger::log(
            action: 'classroom.deleted',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'Classroom',
            entityId: $id,
            payload: ['name' => $classroom->name],
            actorId: $user->id,
            actorType: 'tenant_user'
        );

        return ApiResponse::success(['message' => 'Classroom deleted successfully.']);
    }
}
