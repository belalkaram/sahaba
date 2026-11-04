<?php

namespace App\Http\Controllers\Api\Authorization;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleController extends Controller
{
    protected const SCOPE_HIERARCHY = [
        'self' => 1,
        'linked' => 2,
        'own' => 3,
        'assigned' => 4,
        'branch' => 5,
        'tenant' => 6,
    ];

    /**
     * GET /permissions
     * Returns permissions catalog grouped by module. Guard: roles.view
     */
    public function permissions(): JsonResponse
    {
        return ApiResponse::success(PermissionCatalog::groupedByModule());
    }

    /**
     * GET /roles
     * Returns all roles with their permissions, scopes, and user count. Guard: roles.manage
     */
    public function index(): JsonResponse
    {
        $roles = Role::with(['permissions' => function ($q) {
            $q->select('permissions.id', 'permissions.name', 'permissions.module');
        }])
            ->withCount('users')
            ->orderBy('is_system', 'desc')
            ->orderBy('name', 'asc')
            ->get();

        $data = $roles->map(function ($role) {
            return [
                'id' => $role->id,
                'name' => $role->name,
                'label' => $role->label ?? $role->name,
                'description' => $role->description,
                'is_system' => (bool) $role->is_system,
                'users_count' => $role->users_count,
                'permissions' => $role->permissions->mapWithKeys(function ($p) {
                    return [$p->name => $p->pivot->scope ?? 'tenant'];
                }),
            ];
        });

        return ApiResponse::success($data);
    }

    /**
     * GET /roles/{id}
     * Returns a single role with permissions and users count. Guard: roles.view
     */
    public function show(int|string $id): JsonResponse
    {
        $role = Role::with(['permissions'])->withCount('users')->findOrFail($id);

        return ApiResponse::success([
            'id' => $role->id,
            'name' => $role->name,
            'label' => $role->label ?? $role->name,
            'description' => $role->description,
            'is_system' => (bool) $role->is_system,
            'users_count' => $role->users_count,
            'permissions' => $role->permissions->mapWithKeys(function ($p) {
                return [$p->name => $p->pivot->scope ?? 'tenant'];
            }),
        ]);
    }

    /**
     * POST /roles
     * Create custom role. Guard: roles.manage
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:50|regex:/^[a-z0-9_-]+$/',
            'label' => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
            'permissions' => 'nullable|array',
        ]);

        if (Role::where('name', $validated['name'])->exists()) {
            return ApiResponse::error(
                'ROLE_NAME_TAKEN',
                "Role [{$validated['name']}] already exists.",
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $normalizedPerms = $this->normalizePermissions($validated['permissions'] ?? []);
        $this->validatePermissionsAndScopes($normalizedPerms);

        /** @var TenantUser $currentUser */
        $currentUser = $request->user();
        $this->guardPrivilegeEscalation($currentUser, $normalizedPerms);

        $role = Role::create([
            'name' => $validated['name'],
            'label' => $validated['label'],
            'description' => $validated['description'] ?? null,
            'is_system' => false,
        ]);

        $this->syncRolePermissions($role, $normalizedPerms);

        AuditLogger::log(
            action: 'role.created',
            entityType: 'Role',
            entityId: (string) $role->id,
            payload: [
                'name' => $role->name,
                'label' => $role->label,
                'permissions' => $normalizedPerms,
            ]
        );

        return ApiResponse::success([
            'id' => $role->id,
            'name' => $role->name,
            'label' => $role->label,
            'description' => $role->description,
            'is_system' => false,
            'permissions' => $normalizedPerms,
        ], Response::HTTP_CREATED);
    }

    /**
     * PUT /roles/{id}
     * Update custom role. System role name cannot be modified. Guard: roles.manage
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $role = Role::findOrFail($id);

        $rules = [
            'label' => 'sometimes|required|string|max:100',
            'description' => 'nullable|string|max:255',
            'permissions' => 'nullable|array',
        ];

        if (! $role->is_system) {
            $rules['name'] = 'sometimes|required|string|max:50|regex:/^[a-z0-9_-]+$/';
        }

        $validated = $request->validate($rules);

        if (! $role->is_system && isset($validated['name'])) {
            if (Role::where('name', $validated['name'])->where('id', '!=', $role->id)->exists()) {
                return ApiResponse::error(
                    'ROLE_NAME_TAKEN',
                    "Role [{$validated['name']}] already exists.",
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }
            $role->name = $validated['name'];
        }
        if (isset($validated['label'])) {
            $role->label = $validated['label'];
        }
        if (array_key_exists('description', $validated)) {
            $role->description = $validated['description'];
        }
        $role->save();

        if (isset($validated['permissions'])) {
            $normalizedPerms = $this->normalizePermissions($validated['permissions']);
            $this->validatePermissionsAndScopes($normalizedPerms);

            /** @var TenantUser $currentUser */
            $currentUser = $request->user();
            $this->guardPrivilegeEscalation($currentUser, $normalizedPerms);

            $this->syncRolePermissions($role, $normalizedPerms);
        }

        AuditLogger::log(
            action: 'role.updated',
            entityType: 'Role',
            entityId: (string) $role->id,
            payload: [
                'name' => $role->name,
                'label' => $role->label,
                'permissions' => $role->permissions()->get()->mapWithKeys(fn ($p) => [$p->name => $p->pivot->scope]),
            ]
        );

        $role->load('permissions');

        return ApiResponse::success([
            'id' => $role->id,
            'name' => $role->name,
            'label' => $role->label,
            'description' => $role->description,
            'is_system' => (bool) $role->is_system,
            'permissions' => $role->permissions->mapWithKeys(fn ($p) => [$p->name => $p->pivot->scope ?? 'tenant']),
        ]);
    }

    /**
     * DELETE /roles/{id}
     * Delete custom role. System roles cannot be deleted. Guard: roles.manage
     */
    public function destroy(int|string $id): JsonResponse
    {
        $role = Role::findOrFail($id);

        if ($role->is_system) {
            return ApiResponse::error(
                'SYSTEM_ROLE_CANNOT_BE_DELETED',
                'System roles are core to the platform and cannot be deleted.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        if ($role->users()->count() > 0) {
            return ApiResponse::error(
                'ROLE_IN_USE',
                'Cannot delete a role that is currently assigned to users. Reassign users first.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $role->permissions()->detach();
        $role->delete();

        AuditLogger::log(
            action: 'role.deleted',
            entityType: 'Role',
            entityId: (string) $id,
            payload: ['name' => $role->name]
        );

        return ApiResponse::success(['message' => 'Role deleted successfully.']);
    }

    /**
     * GET /users/{id}/roles
     * Returns assigned roles for the user. Guard: roles.view
     */
    public function getUserRoles(int|string $id): JsonResponse
    {
        $user = TenantUser::with('roles')->findOrFail($id);

        return ApiResponse::success($user->roles->map(fn ($r) => [
            'id' => $r->id,
            'name' => $r->name,
            'label' => $r->label ?? $r->name,
            'is_system' => (bool) $r->is_system,
        ]));
    }

    /**
     * PUT /users/{id}/roles
     * Update assigned roles for user. Protects against removing last owner. Guard: roles.manage
     */
    public function updateUserRoles(Request $request, int|string $id): JsonResponse
    {
        $validated = $request->validate([
            'role_ids' => 'required|array',
            'role_ids.*' => 'string',
        ]);

        $roleCount = Role::whereIn('id', $validated['role_ids'])->count();
        if ($roleCount !== count(array_unique($validated['role_ids']))) {
            return ApiResponse::error(
                'INVALID_ROLE_ID',
                'One or more role IDs are invalid.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $targetUser = TenantUser::with('roles')->findOrFail($id);
        $newRoleIds = $validated['role_ids'];

        $ownerRole = Role::where('name', 'owner')->first();
        if ($ownerRole) {
            $isTargetCurrentlyOwner = $targetUser->roles->contains('id', $ownerRole->id);
            $willRemainOwner = in_array($ownerRole->id, $newRoleIds, true);

            if ($isTargetCurrentlyOwner && ! $willRemainOwner) {
                $otherActiveOwners = $ownerRole->users()
                    ->where('tenant_users.id', '!=', $targetUser->id)
                    ->where('tenant_users.status', 'active')
                    ->count();

                if ($otherActiveOwners === 0) {
                    return ApiResponse::error(
                        'LAST_OWNER_CANNOT_BE_REMOVED',
                        'Cannot remove the owner role from the last active organization owner.',
                        Response::HTTP_UNPROCESSABLE_ENTITY
                    );
                }
            }
        }

        /** @var TenantUser $currentUser */
        $currentUser = $request->user();
        if (! $currentUser->hasRole('owner')) {
            $newRoles = Role::with('permissions')->whereIn('id', $newRoleIds)->get();
            $mergedPerms = [];
            foreach ($newRoles as $nr) {
                foreach ($nr->permissions as $p) {
                    $scope = $p->pivot->scope ?? 'tenant';
                    if (! isset($mergedPerms[$p->name]) ||
                        (self::SCOPE_HIERARCHY[$scope] ?? 0) > (self::SCOPE_HIERARCHY[$mergedPerms[$p->name]] ?? 0)
                    ) {
                        $mergedPerms[$p->name] = $scope;
                    }
                }
            }
            $this->guardPrivilegeEscalation($currentUser, $mergedPerms);
        }

        $targetUser->roles()->sync($newRoleIds);

        AuditLogger::log(
            action: 'user_roles.updated',
            entityType: 'TenantUser',
            entityId: (string) $targetUser->id,
            payload: ['role_ids' => $newRoleIds]
        );

        $targetUser->load('roles');

        return ApiResponse::success($targetUser->roles->map(fn ($r) => [
            'id' => $r->id,
            'name' => $r->name,
            'label' => $r->label ?? $r->name,
            'is_system' => (bool) $r->is_system,
        ]));
    }

    /**
     * GET /users/{id}/effective-permissions
     * Returns user's calculated effective permissions with scopes. Guard: roles.view
     */
    public function getUserEffectivePermissions(int|string $id): JsonResponse
    {
        $user = TenantUser::findOrFail($id);

        return ApiResponse::success($user->getPermissionsWithScope());
    }

    /**
     * Normalize input permissions to ['permission_name' => 'scope'].
     */
    protected function normalizePermissions(array $raw): array
    {
        $normalized = [];
        foreach ($raw as $key => $val) {
            if (is_array($val) && isset($val['name'])) {
                $normalized[$val['name']] = $val['scope'] ?? 'tenant';
            } elseif (is_string($key)) {
                $normalized[$key] = is_string($val) ? $val : 'tenant';
            } elseif (is_string($val)) {
                $normalized[$val] = 'tenant';
            }
        }

        return $normalized;
    }

    /**
     * Validate permissions against canonical catalog and verify allowed scopes.
     */
    protected function validatePermissionsAndScopes(array $permissions): void
    {
        foreach ($permissions as $permission => $scope) {
            if (! PermissionCatalog::has($permission)) {
                abort(Response::HTTP_UNPROCESSABLE_ENTITY, "Unknown permission [{$permission}].");
            }

            if (! PermissionCatalog::isScopeAllowed($permission, $scope)) {
                $allowed = implode(', ', PermissionCatalog::getScopes($permission));
                abort(Response::HTTP_UNPROCESSABLE_ENTITY, "Scope [{$scope}] is not allowed for permission [{$permission}]. Allowed scopes: [{$allowed}].");
            }
        }
    }

    /**
     * Prevent privilege escalation: caller cannot grant permissions or higher scopes than they possess.
     */
    protected function guardPrivilegeEscalation(TenantUser $caller, array $targetPermissions): void
    {
        if ($caller->hasRole('owner')) {
            return;
        }

        $callerPerms = $caller->getPermissionsWithScope();

        foreach ($targetPermissions as $perm => $targetScope) {
            if (! isset($callerPerms[$perm])) {
                abort(Response::HTTP_FORBIDDEN, "Privilege escalation: You cannot grant permission [{$perm}] because you do not possess it.");
            }

            $callerScope = $callerPerms[$perm];
            $callerLevel = self::SCOPE_HIERARCHY[$callerScope] ?? 0;
            $targetLevel = self::SCOPE_HIERARCHY[$targetScope] ?? 0;

            if ($targetLevel > $callerLevel) {
                abort(Response::HTTP_FORBIDDEN, "Privilege escalation: You cannot grant scope [{$targetScope}] for [{$perm}] because your highest scope is [{$callerScope}].");
            }
        }
    }

    /**
     * Sync permissions to role with pivot scope.
     */
    protected function syncRolePermissions(Role $role, array $permissions): void
    {
        $records = [];
        foreach ($permissions as $permName => $scope) {
            $permModel = Permission::firstOrCreate(['name' => $permName]);
            $records[$permModel->id] = ['scope' => $scope];
        }

        $role->permissions()->sync($records);
    }
}
