<?php

namespace Tests\Feature;

use App\Support\Authorization\PermissionCatalog;
use Tests\TestCase;

/**
 * PermissionCatalogIntegrityTest (R1-A2)
 *
 * Verifies that the canonical permission catalog in `config/authorization.php`
 * is the single source of truth:
 *  1. Every permission checked in `routes/api.php` (`tenant.can:...`) must exist in the catalog.
 *  2. Every permission checked in controllers/models (`hasPermissionTo(...)`) must exist in the catalog.
 *  3. Every permission assigned in `config('authorization.roles')` must exist in the catalog.
 *  4. Every scope assigned in system roles must be an allowed scope for that permission.
 */
class PermissionCatalogIntegrityTest extends TestCase
{
    /** @test */
    public function test_catalog_contains_all_permissions_checked_in_routes(): void
    {
        $routesPath = base_path('routes/api.php');
        $this->assertFileExists($routesPath);

        $content = file_get_contents($routesPath);
        preg_match_all("/tenant\.can:([a-zA-Z0-9_\.]+)/", $content, $matches);

        $routePermissions = array_unique($matches[1] ?? []);
        $this->assertNotEmpty($routePermissions, 'At least one tenant.can check should exist in routes.');

        $missing = [];
        foreach ($routePermissions as $perm) {
            if (! PermissionCatalog::has($perm)) {
                $missing[] = $perm;
            }
        }

        $this->assertEmpty(
            $missing,
            'The following route permissions are missing from config/authorization.php: '.implode(', ', $missing)
        );
    }

    /** @test */
    public function test_catalog_contains_all_permissions_checked_in_app_code(): void
    {
        $appPath = app_path();
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($appPath));
        $appPermissions = [];

        foreach ($files as $file) {
            if ($file->isDir() || $file->getExtension() !== 'php') {
                continue;
            }

            $content = file_get_contents($file->getPathname());

            // Match ->hasPermissionTo('...')
            if (preg_match_all("/hasPermissionTo\(['\"]([a-zA-Z0-9_\.]+)['\"]\)/", $content, $matches)) {
                foreach ($matches[1] as $p) {
                    $appPermissions[] = $p;
                }
            }

            // Match authorize(..., '...')
            if (preg_match_all("/authorize\([^,]+,\s*['\"]([a-zA-Z0-9_\.]+)['\"]\)/", $content, $matches)) {
                foreach ($matches[1] as $p) {
                    $appPermissions[] = $p;
                }
            }
        }

        $appPermissions = array_unique($appPermissions);
        $this->assertNotEmpty($appPermissions);

        $missing = [];
        foreach ($appPermissions as $perm) {
            if (! PermissionCatalog::has($perm)) {
                $missing[] = $perm;
            }
        }

        $this->assertEmpty(
            $missing,
            'The following app code permissions are missing from config/authorization.php: '.implode(', ', $missing)
        );
    }

    /** @test */
    public function test_all_system_roles_map_to_valid_permissions_and_scopes(): void
    {
        $roles = PermissionCatalog::roles();
        $this->assertNotEmpty($roles);

        // Required 8 system roles from OD-1
        $requiredRoles = ['owner', 'center_admin', 'branch_manager', 'teacher', 'assistant', 'finance', 'student', 'parent'];
        foreach ($requiredRoles as $required) {
            $this->assertArrayHasKey($required, $roles, "System role [{$required}] is missing from config/authorization.php");
        }

        foreach ($roles as $roleName => $def) {
            $this->assertArrayHasKey('label', $def, "Role [{$roleName}] is missing a label.");
            $this->assertArrayHasKey('permissions', $def, "Role [{$roleName}] is missing permissions array.");

            foreach ($def['permissions'] as $permName => $scope) {
                $this->assertTrue(
                    PermissionCatalog::has($permName),
                    "Role [{$roleName}] references uncataloged permission [{$permName}]."
                );

                $this->assertTrue(
                    PermissionCatalog::isScopeAllowed($permName, $scope),
                    "Role [{$roleName}] assigns disallowed scope [{$scope}] for permission [{$permName}]."
                );
            }
        }
    }

    /** @test */
    public function test_all_permissions_belong_to_known_modules(): void
    {
        $modules = array_keys(PermissionCatalog::modules());
        $permissions = PermissionCatalog::permissions();

        foreach ($permissions as $name => $def) {
            $this->assertArrayHasKey('module', $def, "Permission [{$name}] is missing 'module'.");
            $this->assertContains(
                $def['module'],
                $modules,
                "Permission [{$name}] references unknown module [{$def['module']}]."
            );
        }
    }
}
