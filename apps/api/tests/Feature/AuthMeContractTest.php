<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\ParentProfile;
use App\Models\Role;
use App\Models\Staff;
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

/**
 * AuthMeContractTest (R1-A6)
 *
 * Validates the canonical auth contract per `03-target-access-model.md` §7:
 *  - user (id, name, email, phone, status)
 *  - persona ('staff' | 'student' | 'parent')
 *  - profiles (student, staff with branch_ids, parent)
 *  - roles ([{ name, label }])
 *  - permissions (map of permission_name => scope)
 *  - tenant (id, slug, name, modules, auth_mode, branding)
 *  - experience ('admin' | 'staff' | 'student' | 'parent')
 *  - support_session ({ id, expires_at } | null)
 */
class AuthMeContractTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'auth_contract_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'Future Language School',
            'slug' => 'future-school',
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
            'domain' => 'future-school.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        // Sync standard catalog system roles
        app(RoleSynchronizer::class)->sync();
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'auth_contract_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    public function test_owner_auth_me_contract_and_admin_experience(): void
    {
        $user = TenantUser::create([
            'name' => 'School Owner',
            'email' => 'owner@future-school.test',
            'phone' => '+201011112222',
            'password' => Hash::make('secret123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $user->roles()->attach($ownerRole->id);

        $tokenResult = TenantToken::createTokenFor($user);

        $response = $this->withHeaders([
            'X-Tenant' => 'future-school',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/auth/me');

        $response->assertStatus(200);

        // Verify Top-Level Structure
        $response->assertJsonStructure([
            'data' => [
                'user' => ['id', 'name', 'email', 'phone', 'status'],
                'persona',
                'profiles' => ['student', 'staff', 'parent'],
                'roles' => [['name', 'label']],
                'permissions',
                'tenant' => ['id', 'slug', 'name', 'modules', 'auth_mode', 'branding'],
                'experience',
                'support_session',
            ],
        ]);

        $data = $response->json('data');
        $this->assertEquals('staff', $data['persona']);
        $this->assertEquals('admin', $data['experience']);
        $this->assertNull($data['support_session']);
        $this->assertIsArray($data['permissions']);
        $this->assertEquals('tenant', $data['permissions']['users.view']);
        $this->assertEquals('future-school', $data['tenant']['slug']);
        $this->assertContains('online', $data['tenant']['modules']);
    }

    public function test_teacher_auth_me_contract_and_staff_experience(): void
    {
        $user = TenantUser::create([
            'name' => 'Teacher Sara',
            'email' => 'sara@future-school.test',
            'phone' => '+201099998888',
            'password' => Hash::make('secret123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();
        $user->roles()->attach($teacherRole->id);

        $staff = Staff::create([
            'user_id' => $user->id,
            'staff_type' => 'teacher',
            'status' => 'active',
        ]);

        $tokenResult = TenantToken::createTokenFor($user);

        $response = $this->withHeaders([
            'X-Tenant' => 'future-school',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/auth/me');

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertEquals('staff', $data['persona']);
        $this->assertEquals('staff', $data['experience']);
        $this->assertNotNull($data['profiles']['staff']);
        $this->assertEquals('teacher', $data['profiles']['staff']['staff_type']);
        $this->assertEquals('own', $data['permissions']['courses.update']);
        $this->assertEquals('own', $data['permissions']['courses.view']);
    }

    public function test_student_auth_me_contract_and_student_experience(): void
    {
        $user = TenantUser::create([
            'name' => 'Student Omar',
            'email' => 'omar@future-school.test',
            'password' => Hash::make('secret123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentRole = Role::where('name', 'student')->firstOrFail();
        $user->roles()->attach($studentRole->id);

        $student = Student::create([
            'user_id' => $user->id,
            'student_code' => 'STU-FUTURE-001',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);

        $tokenResult = TenantToken::createTokenFor($user);

        $response = $this->withHeaders([
            'X-Tenant' => 'future-school',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/auth/me');

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertEquals('student', $data['persona']);
        $this->assertEquals('student', $data['experience']);
        $this->assertNotNull($data['profiles']['student']);
        $this->assertEquals('STU-FUTURE-001', $data['profiles']['student']['student_code']);
        $this->assertEquals('Grade 10', $data['profiles']['student']['grade_level']);
        $this->assertEquals('self', $data['permissions']['courses.view']);
    }

    public function test_parent_auth_me_contract_and_parent_experience(): void
    {
        $user = TenantUser::create([
            'name' => 'Parent Ali',
            'email' => 'ali@future-school.test',
            'password' => Hash::make('secret123'),
            'type' => 'parent',
            'status' => 'active',
        ]);
        $parentRole = Role::where('name', 'parent')->firstOrFail();
        $user->roles()->attach($parentRole->id);

        $parent = ParentProfile::create([
            'user_id' => $user->id,
            'status' => 'active',
        ]);

        $tokenResult = TenantToken::createTokenFor($user);

        $response = $this->withHeaders([
            'X-Tenant' => 'future-school',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/auth/me');

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertEquals('parent', $data['persona']);
        $this->assertEquals('parent', $data['experience']);
        $this->assertNotNull($data['profiles']['parent']);
        $this->assertEquals($parent->id, $data['profiles']['parent']['id']);
        $this->assertEquals('linked', $data['permissions']['courses.view']);
    }

    public function test_support_token_populates_support_session(): void
    {
        $user = TenantUser::create([
            'name' => 'Platform Support Agent',
            'email' => 'support@platform.test',
            'password' => Hash::make('secret123'),
            'type' => 'support',
            'status' => 'active',
        ]);
        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $user->roles()->attach($ownerRole->id);

        $tokenResult = TenantToken::createTokenFor($user, 'support_token', 120);

        $response = $this->withHeaders([
            'X-Tenant' => 'future-school',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/auth/me');

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertNotNull($data['support_session']);
        $this->assertEquals($tokenResult['token']->id, $data['support_session']['id']);
        $this->assertNotNull($data['support_session']['expires_at']);
    }

    public function test_login_endpoint_returns_identical_canonical_auth_contract(): void
    {
        $user = TenantUser::create([
            'name' => 'Login Tester',
            'email' => 'login@future-school.test',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $user->roles()->attach($ownerRole->id);

        $response = $this->withHeaders([
            'X-Tenant' => 'future-school',
        ])->postJson('/api/v1/auth/login', [
            'identifier' => 'login@future-school.test',
            'password' => 'password123',
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertArrayHasKey('token', $data);
        $this->assertEquals('Bearer', $data['token_type']);
        $this->assertEquals('staff', $data['persona']);
        $this->assertEquals('admin', $data['experience']);
        $this->assertArrayHasKey('permissions', $data);
        $this->assertArrayHasKey('tenant', $data);
        $this->assertArrayHasKey('profiles', $data);
    }
}
