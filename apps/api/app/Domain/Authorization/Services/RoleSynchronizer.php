<?php

namespace App\Domain\Authorization\Services;

use App\Models\Permission;
use App\Models\Role;
use App\Support\Authorization\PermissionCatalog;
use Illuminate\Support\Facades\DB;

/**
 * RoleSynchronizer (R1-A3)
 *
 * Idempotently synchronizes the canonical permission catalog and
 * standard system roles into the currently configured tenant database.
 * Does not overwrite or delete custom roles.
 */
class RoleSynchronizer
{
    /**
     * Synchronize permissions and system roles in the current tenant database.
     *
     * @param  string[]|null  $roleNames
     * @return array{permissions: int, roles: int}
     */
    public function sync(?array $roleNames = null): array
    {
        return DB::connection('tenant')->transaction(function () use ($roleNames) {
            // 1. Upsert all permissions from the catalog
            $catalogPermissions = PermissionCatalog::permissions();
            $permissionMap = [];

            foreach ($catalogPermissions as $name => $def) {
                $permission = Permission::updateOrCreate(
                    ['name' => $name],
                    [
                        'module' => $def['module'],
                        'description' => $def['label'],
                    ]
                );

                $permissionMap[$name] = $permission->id;
            }

            // 2. Synchronize system roles (optionally filtered by profile)
            $catalogRoles = PermissionCatalog::roles();
            if ($roleNames !== null) {
                $catalogRoles = array_intersect_key($catalogRoles, array_flip($roleNames));
            }
            $rolesCount = 0;

            foreach ($catalogRoles as $roleName => $def) {
                $role = Role::updateOrCreate(
                    ['name' => $roleName],
                    [
                        'label' => $def['label'],
                        'description' => $def['description'] ?? null,
                        'is_system' => true,
                    ]
                );

                // Build pivot array: permission_id => ['scope' => $scope]
                $syncData = [];
                foreach ($def['permissions'] as $permName => $scope) {
                    if (isset($permissionMap[$permName])) {
                        $syncData[$permissionMap[$permName]] = ['scope' => $scope];
                    }
                }

                $role->permissions()->sync($syncData);
                $rolesCount++;
            }

            return [
                'permissions' => count($permissionMap),
                'roles' => $rolesCount,
            ];
        });
    }
}
