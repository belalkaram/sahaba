<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Branch;
use App\Models\Classroom;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantFeature;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BranchClassroomApiTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected TenantUser $adminUser;

    protected string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'branch_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'Branch Academy',
            'slug' => 'branch-academy',
            'type' => 'school',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => $this->tenantConn,
            'status' => 'ready',
        ]);

        TenantDomain::create([
            'tenant_id' => $this->tenant->id,
            'domain' => 'branch-academy.localhost',
            'active' => true,
        ]);

        // Enable offline module
        TenantFeature::create([
            'tenant_id' => $this->tenant->id,
            'feature_key' => 'offline',
            'enabled' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        app(RoleSynchronizer::class)->sync();

        $this->adminUser = TenantUser::create([
            'name' => 'Branch Admin',
            'email' => 'admin@branch-academy.test',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $this->adminUser->roles()->attach($ownerRole->id);

        $tokenResult = TenantToken::createTokenFor($this->adminUser);
        $this->adminToken = $tokenResult['plainTextToken'];
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'branch_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    public function test_branch_crud_operations(): void
    {
        // 1. Create branch
        $createRes = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/branches', [
            'name' => 'Riyadh Main Branch',
            'code' => 'RUH-01',
        ]);
        $createRes->assertCreated();
        $branchId = $createRes->json('data.branch.id');

        // 2. Read branch
        $getRes = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->getJson("/api/v1/branches/{$branchId}");
        $getRes->assertOk();
        $this->assertEquals('Riyadh Main Branch', $getRes->json('data.branch.name'));

        // 3. Update branch
        $updateRes = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->putJson("/api/v1/branches/{$branchId}", [
            'name' => 'Riyadh Central Branch',
        ]);
        $updateRes->assertOk();
        $this->assertEquals('Riyadh Central Branch', $updateRes->json('data.branch.name'));

        // 4. Delete branch
        $deleteRes = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->deleteJson("/api/v1/branches/{$branchId}");
        $deleteRes->assertOk();
        $this->assertEquals(0, Branch::count());
    }

    public function test_classroom_crud_in_branch(): void
    {
        $branch = Branch::create(['name' => 'Jeddah Branch', 'code' => 'JED']);

        // 1. Create classroom in branch
        $createRes = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson("/api/v1/branches/{$branch->id}/classrooms", [
            'name' => 'Lab A1',
            'capacity' => 25,
        ]);
        $createRes->assertCreated();
        $classroomId = $createRes->json('data.classroom.id');
        $this->assertEquals($branch->id, $createRes->json('data.classroom.branch_id'));

        // 2. List classrooms in branch
        $listRes = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->getJson("/api/v1/branches/{$branch->id}/classrooms");
        $listRes->assertOk();
        $this->assertCount(1, $listRes->json('data.classrooms'));

        // 3. Update classroom
        $updateRes = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->putJson("/api/v1/classrooms/{$classroomId}", [
            'capacity' => 30,
        ]);
        $updateRes->assertOk();
        $this->assertEquals(30, $updateRes->json('data.classroom.capacity'));

        // 4. Delete classroom
        $deleteRes = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->deleteJson("/api/v1/classrooms/{$classroomId}");
        $deleteRes->assertOk();
        $this->assertEquals(0, Classroom::count());
    }

    public function test_cannot_delete_branch_with_classrooms(): void
    {
        $branch = Branch::create(['name' => 'Dammam Branch', 'code' => 'DMM']);
        Classroom::create(['branch_id' => $branch->id, 'name' => 'Room 101', 'capacity' => 20]);

        $response = $this->withHeaders([
            'X-Tenant' => 'branch-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->deleteJson("/api/v1/branches/{$branch->id}");

        $response->assertStatus(422);
        $this->assertEquals('BRANCH_NOT_EMPTY', $response->json('error.code'));
        $this->assertEquals(1, Branch::count());
    }
}
