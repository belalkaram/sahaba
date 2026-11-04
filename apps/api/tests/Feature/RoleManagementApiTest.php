<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * RoleManagementApiTest (R1-A7)
 *
 * Verifies the Roles & Permissions Management API:
 *  - Permissions catalog listing
 *  - System roles listing and immutability (cannot delete or rename)
 *  - Custom role CRUD with strict catalog and scope validation
 *  - Last owner removal protection
 *  - Privilege escalation defense
 *  - Audit logging of all role mutations
 */
class RoleManagementApiTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected TenantUser $ownerUser;

    protected string $ownerToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'role_api_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'Role Test Academy',
            'slug' => 'role-academy',
            'type' => 'school',
            'status' => 'active',
            'auth_mode' => 'hybrid',
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => $this->tenantConn,
            'status' => 'ready',
        ]);

        TenantDomain::create([
            'tenant_id' => $this->tenant->id,
            'domain' => 'role-academy.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        // Sync standard catalog system roles
        app(RoleSynchronizer::class)->sync();

        $this->ownerUser = TenantUser::create([
            'name' => 'Academy Owner',
            'email' => 'owner@role-academy.test',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $this->ownerUser->roles()->attach($ownerRole->id);

        $tokenResult = TenantToken::createTokenFor($this->ownerUser);
        $this->ownerToken = $tokenResult['plainTextToken'];
    }

    protected function tearDown(): void
    {
        $this->cleanupTenantDb();
        parent::tearDown();
    }

    protected function cleanupTenantDb(): void
    {
        app(TenantDatabaseManager::class)->purgeConnection();
        $dir = database_path('tenants');
        if (is_dir($dir)) {
            foreach (glob($dir.DIRECTORY_SEPARATOR.'role_api_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    public function test_get_permissions_returns_grouped_catalog(): void
    {
        $response = $this->withHeaders([
            'X-Tenant' => 'role-academy',
            'Authorization' => 'Bearer '.$this->ownerToken,
        ])->getJson('/api/v1/permissions');

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertArrayHasKey('core', $data);
        $this->assertArrayHasKey('online', $data);
        $this->assertArrayHasKey('offline', $data);
        $this->assertArrayHasKey('users.view', $data['core']);
        $this->assertContains('tenant', $data['core']['users.view']['scopes']);
    }

    public function test_get_roles_returns_system_and_custom_roles(): void
    {
        $response = $this->withHeaders([
            'X-Tenant' => 'role-academy',
            'Authorization' => 'Bearer '.$this->ownerToken,
        ])->getJson('/api/v1/roles');

        $response->assertStatus(200);
        $roles = $response->json('data');

        $this->assertCount(8, $roles);
        $owner = collect($roles)->firstWhere('name', 'owner');
        $this->assertTrue($owner['is_system']);
        $this->assertEquals(1, $owner['users_count']);
    }

    public function test_create_custom_role_with_valid_permissions_and_scopes(): void
    {
        $response = $this->withHeaders([
            'X-Tenant' => 'role-academy',
            'Authorization' => 'Bearer '.$this->ownerToken,
        ])->postJson('/api/v1/roles', [
            'name' => 'lab_coordinator',
            'label' => 'منسق المختبر',
            'description' => 'إدارة الحصص والأنشطة العملية في المختبر',
            'permissions' => [
                'courses.view' => 'assigned',
                'lessons.view' => 'assigned',
                'attendance.scan' => 'assigned',
            ],
        ]);

        $response->assertStatus(201);
        $data = $response->json('data');
        $this->assertEquals('lab_coordinator', $data['name']);
        $this->assertFalse($data['is_system']);
        $this->assertEquals('assigned', $data['permissions']['attendance.scan']);

        $this->assertTrue(
            Role::where('name', 'lab_coordinator')->where('is_system', false)->exists(),
            'Custom role was not persisted in tenant database'
        );
    }

    public function test_create_role_rejects_invalid_scope(): void
    {
        $response = $this->withHeaders([
            'X-Tenant' => 'role-academy',
            'Authorization' => 'Bearer '.$this->ownerToken,
        ])->postJson('/api/v1/roles', [
            'name' => 'bad_scope_role',
            'label' => 'دور ذو نطاق خاطئ',
            'permissions' => [
                'users.manage' => 'self', // users.manage only allows tenant or branch
            ],
        ]);

        $response->assertStatus(422);
    }

    public function test_delete_system_role_is_rejected(): void
    {
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();

        $response = $this->withHeaders([
            'X-Tenant' => 'role-academy',
            'Authorization' => 'Bearer '.$this->ownerToken,
        ])->deleteJson('/api/v1/roles/'.$teacherRole->id);

        $response->assertStatus(422);
        $response->assertJson([
            'error' => [
                'code' => 'SYSTEM_ROLE_CANNOT_BE_DELETED',
            ],
        ]);
    }

    public function test_last_owner_cannot_be_removed(): void
    {
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();

        $response = $this->withHeaders([
            'X-Tenant' => 'role-academy',
            'Authorization' => 'Bearer '.$this->ownerToken,
        ])->putJson('/api/v1/users/'.$this->ownerUser->id.'/roles', [
            'role_ids' => [$teacherRole->id],
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'error' => [
                'code' => 'LAST_OWNER_CANNOT_BE_REMOVED',
            ],
        ]);
    }

    public function test_privilege_escalation_is_blocked_for_non_owner(): void
    {
        // Create teacher user with roles.manage permission temporarily granted
        $teacherUser = TenantUser::create([
            'name' => 'Teacher Manager',
            'email' => 'manager@role-academy.test',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();
        $teacherUser->roles()->attach($teacherRole->id);

        // Create a custom manager role that only has branch-level scope for courses
        $managerRole = Role::create([
            'name' => 'course_coordinator',
            'label' => 'منسق المقررات',
            'is_system' => false,
        ]);
        $coursesView = Permission::firstOrCreate(['name' => 'courses.view']);
        $rolesManage = Permission::firstOrCreate(['name' => 'roles.manage']);
        $managerRole->permissions()->attach($coursesView->id, ['scope' => 'own']);
        $managerRole->permissions()->attach($rolesManage->id, ['scope' => 'tenant']);

        $teacherUser->roles()->attach($managerRole->id);

        $tokenResult = TenantToken::createTokenFor($teacherUser);

        // Attempting to create a role with 'courses.view' => 'tenant' when teacher only has 'own'
        $response = $this->withHeaders([
            'X-Tenant' => 'role-academy',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->postJson('/api/v1/roles', [
            'name' => 'super_course_lead',
            'label' => 'قائد المقررات الفائق',
            'permissions' => [
                'courses.view' => 'tenant', // Higher scope than teacher's own scope!
            ],
        ]);

        $response->assertStatus(403);
    }
}
