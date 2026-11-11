<?php

namespace App\Domain\Authorization\Services;

use App\Support\Authorization\PermissionCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
        $db = DB::connection('tenant');

        // Set-based on purpose: each statement is a network round trip on a remote database, and the
        // catalog is ~90 permissions and ~300 role/permission links. A per-row upsert made registering
        // a school take minutes; this takes a handful of queries.
        return $db->transaction(function () use ($db, $roleNames) {
            $now = now();

            // 1. Permissions
            $permissionMap = $db->table('permissions')->pluck('id', 'name')->all();
            $existingPerms = $db->table('permissions')->get(['name', 'module', 'description'])->keyBy('name');
            $newPerms = [];
            foreach (PermissionCatalog::permissions() as $name => $def) {
                if (! isset($permissionMap[$name])) {
                    $id = (string) Str::uuid7();
                    $permissionMap[$name] = $id;
                    $newPerms[] = ['id' => $id, 'name' => $name, 'module' => $def['module'],
                        'description' => $def['label'], 'created_at' => $now, 'updated_at' => $now];
                } elseif ($existingPerms[$name]->module !== $def['module'] || $existingPerms[$name]->description !== $def['label']) {
                    $db->table('permissions')->where('name', $name)
                        ->update(['module' => $def['module'], 'description' => $def['label'], 'updated_at' => $now]);
                }
            }
            foreach (array_chunk($newPerms, 200) as $chunk) {
                $db->table('permissions')->insert($chunk);
            }
            $catalogNames = array_flip(array_keys(PermissionCatalog::permissions()));
            $permissionMap = array_intersect_key($permissionMap, $catalogNames);

            // 2. System roles (optionally filtered by profile)
            $catalogRoles = PermissionCatalog::roles();
            if ($roleNames !== null) {
                $catalogRoles = array_intersect_key($catalogRoles, array_flip($roleNames));
            }
            $roleIds = $db->table('roles')->whereIn('name', array_keys($catalogRoles))->pluck('id', 'name')->all();
            $newRoles = [];
            foreach ($catalogRoles as $roleName => $def) {
                $row = ['label' => $def['label'], 'description' => $def['description'] ?? null, 'is_system' => true];
                if (isset($roleIds[$roleName])) {
                    $db->table('roles')->where('id', $roleIds[$roleName])->update($row + ['updated_at' => $now]);
                } else {
                    $id = (string) Str::uuid7();
                    $roleIds[$roleName] = $id;
                    $newRoles[] = ['id' => $id, 'name' => $roleName, 'created_at' => $now, 'updated_at' => $now] + $row;
                }
            }
            foreach (array_chunk($newRoles, 200) as $chunk) {
                $db->table('roles')->insert($chunk);
            }

            // 3. role_permission links: insert missing, fix changed scope, drop links no longer in the catalog
            $existing = [];
            foreach ($db->table('role_permission')->whereIn('role_id', array_values($roleIds))->get(['role_id', 'permission_id', 'scope']) as $link) {
                $existing[$link->role_id][$link->permission_id] = $link->scope;
            }
            $inserts = [];
            foreach ($catalogRoles as $roleName => $def) {
                $roleId = $roleIds[$roleName];
                $wanted = [];
                foreach ($def['permissions'] as $permName => $scope) {
                    if (isset($permissionMap[$permName])) {
                        $wanted[$permissionMap[$permName]] = $scope;
                    }
                }
                foreach ($wanted as $permId => $scope) {
                    if (! array_key_exists($permId, $existing[$roleId] ?? [])) {
                        $inserts[] = ['role_id' => $roleId, 'permission_id' => $permId, 'scope' => $scope,
                            'created_at' => $now, 'updated_at' => $now];
                    } elseif ($existing[$roleId][$permId] !== $scope) {
                        $db->table('role_permission')->where('role_id', $roleId)->where('permission_id', $permId)
                            ->update(['scope' => $scope, 'updated_at' => $now]);
                    }
                }
                $stale = array_keys(array_diff_key($existing[$roleId] ?? [], $wanted));
                if ($stale) {
                    $db->table('role_permission')->where('role_id', $roleId)->whereIn('permission_id', $stale)->delete();
                }
            }
            foreach (array_chunk($inserts, 200) as $chunk) {
                $db->table('role_permission')->insert($chunk);
            }

            return [
                'permissions' => count($permissionMap),
                'roles' => count($catalogRoles),
            ];
        });
    }
}
