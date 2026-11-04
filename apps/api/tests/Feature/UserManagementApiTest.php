<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Branch;
use App\Models\GlobalIdentity;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Student;
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

class UserManagementApiTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected TenantUser $adminUser;

    protected string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'user_mgmt_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'User Mgmt Academy',
            'slug' => 'user-academy',
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
            'domain' => 'user-academy.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        // Sync standard system roles
        app(RoleSynchronizer::class)->sync();

        // Admin User (Owner)
        $this->adminUser = TenantUser::create([
            'name' => 'Center Admin',
            'email' => 'admin@user-academy.test',
            'phone' => '+966500000001',
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'user_mgmt_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    public function test_list_users_with_filters_and_pagination(): void
    {
        // Create student and teacher
        TenantUser::create([
            'name' => 'Student Sarah',
            'email' => 'sarah@test.com',
            'phone' => '+966511111111',
            'password' => 'secret',
            'type' => 'student',
            'status' => 'active',
        ]);

        TenantUser::create([
            'name' => 'Teacher Tariq',
            'email' => 'tariq@test.com',
            'phone' => '+966522222222',
            'password' => 'secret',
            'type' => 'staff',
            'status' => 'active',
        ]);

        $response = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->getJson('/api/v1/users?persona=student');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertNotEmpty($data);
        foreach ($data as $item) {
            $this->assertEquals('student', $item['type']);
        }
    }

    public function test_create_student_generates_code_and_links_global_identity(): void
    {
        $response = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students', [
            'name' => 'Fahad Al-Otaibi',
            'email' => 'fahad@test.com',
            'phone' => '+966533333333',
            'grade_level' => '10',
            'parent_name' => 'Abu Fahad',
            'parent_phone' => '+966544444444',
            'relation_type' => 'father',
        ]);

        $response->assertCreated();
        $student = $response->json('data.student');

        $this->assertNotNull($student['id']);
        $this->assertStringStartsWith('STU-', $student['student_code']);
        $this->assertEquals('10', $student['grade_level']);
        $this->assertEquals('Fahad Al-Otaibi', $student['user']['name']);

        // Verify parent was linked
        $this->assertNotEmpty($student['parents']);
        $this->assertEquals('+966544444444', $student['parents'][0]['user']['phone']);

        // Verify global identity link in control DB
        $globalId = GlobalIdentity::where('phone', '+966533333333')->first();
        $this->assertNotNull($globalId);
    }

    public function test_update_student_details(): void
    {
        $createRes = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students', [
            'name' => 'Reem Khalid',
            'email' => 'reem@test.com',
            'grade_level' => '9',
        ]);
        $studentId = $createRes->json('data.student.id');

        $response = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->putJson("/api/v1/students/{$studentId}", [
            'name' => 'Reem Khalid Al-Ghamdi',
            'grade_level' => '10',
        ]);

        $response->assertOk();
        $this->assertEquals('Reem Khalid Al-Ghamdi', $response->json('data.student.user.name'));
        $this->assertEquals('10', $response->json('data.student.grade_level'));
    }

    public function test_suspend_and_activate_student(): void
    {
        $createRes = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students', [
            'name' => 'Omar Hani',
            'email' => 'omar@test.com',
        ]);
        $studentId = $createRes->json('data.student.id');

        // Suspend
        $suspendRes = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson("/api/v1/students/{$studentId}/suspend");
        $suspendRes->assertOk();
        $this->assertEquals('suspended', $suspendRes->json('data.student.status'));

        // Activate
        $activateRes = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson("/api/v1/students/{$studentId}/activate");
        $activateRes->assertOk();
        $this->assertEquals('active', $activateRes->json('data.student.status'));
    }

    public function test_create_staff_with_roles_and_branches(): void
    {
        $branch = Branch::create(['name' => 'Main Branch', 'code' => 'MAIN']);

        $response = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/staff', [
            'name' => 'Yousef Al-Harbi',
            'email' => 'yousef@test.com',
            'phone' => '+966555555555',
            'staff_type' => 'teacher',
            'roles' => ['teacher'],
            'branch_ids' => [$branch->id],
        ]);

        $response->assertCreated();
        $staff = $response->json('data.staff');
        $this->assertEquals('teacher', $staff['staff_type']);
        $this->assertEquals('Yousef Al-Harbi', $staff['user']['name']);
        $this->assertCount(1, $staff['branches']);
        $this->assertEquals($branch->id, $staff['branches'][0]['id']);
    }

    public function test_assign_staff_to_classes(): void
    {
        $branch = Branch::create(['name' => 'North Branch', 'code' => 'NORTH']);
        $class = SchoolClass::create(['name' => 'Physics 101', 'code' => 'PHY101', 'branch_id' => $branch->id]);

        $createRes = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/staff', [
            'name' => 'Mona Assistant',
            'email' => 'mona@test.com',
            'staff_type' => 'assistant',
            'roles' => ['assistant'],
        ]);
        $staffId = $createRes->json('data.staff.id');

        $response = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson("/api/v1/staff/{$staffId}/assignments", [
            'assignments' => [
                [
                    'assignable_type' => 'class',
                    'assignable_id' => $class->id,
                    'role_context' => 'lab_assistant',
                ],
            ],
        ]);

        $response->assertOk();
        $assignments = $response->json('data.staff.assignments');
        $this->assertCount(1, $assignments);
        $this->assertEquals('class', $assignments[0]['assignable_type']);
        $this->assertEquals($class->id, $assignments[0]['assignable_id']);
    }

    public function test_create_parent_and_link_children(): void
    {
        $studentRes = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students', [
            'name' => 'Salma Nasser',
            'email' => 'salma@test.com',
        ]);
        $studentId = $studentRes->json('data.student.id');

        $response = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/parents', [
            'name' => 'Nasser Al-Ghamdi',
            'email' => 'nasser@test.com',
            'phone' => '+966566666666',
            'children' => [
                ['student_id' => $studentId, 'relation_type' => 'father'],
            ],
        ]);

        $response->assertCreated();
        $parent = $response->json('data.parent');
        $this->assertEquals('Nasser Al-Ghamdi', $parent['user']['name']);
        $this->assertCount(1, $parent['students']);
        $this->assertEquals($studentId, $parent['students'][0]['id']);

        // Unlink child
        $parentId = $parent['id'];
        $unlinkRes = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->deleteJson("/api/v1/parents/{$parentId}/children/{$studentId}");
        $unlinkRes->assertOk();
        $this->assertCount(0, $unlinkRes->json('data.parent.students'));
    }

    public function test_reset_user_password(): void
    {
        $user = TenantUser::create([
            'name' => 'Password Reset Target',
            'email' => 'reset@test.com',
            'password' => Hash::make('oldpassword'),
            'type' => 'staff',
            'status' => 'active',
        ]);

        $response = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson("/api/v1/users/{$user->id}/reset-password", [
            'password' => 'newSecretPass123',
        ]);

        $response->assertOk();
        $this->assertEquals('newSecretPass123', $response->json('data.temporary_password'));

        $fresh = $user->fresh();
        $this->assertTrue(Hash::check('newSecretPass123', $fresh->password));
    }

    public function test_duplicate_email_or_phone_rejected(): void
    {
        $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students', [
            'name' => 'Original User',
            'email' => 'unique@test.com',
            'phone' => '+966577777777',
        ])->assertCreated();

        // Duplicate email
        $dupEmail = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students', [
            'name' => 'Duplicate Email',
            'email' => 'unique@test.com',
        ]);
        $dupEmail->assertStatus(422);

        // Duplicate phone
        $dupPhone = $this->withHeaders([
            'X-Tenant' => 'user-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students', [
            'name' => 'Duplicate Phone',
            'phone' => '+966577777777',
        ]);
        $dupPhone->assertStatus(422);
    }
}
